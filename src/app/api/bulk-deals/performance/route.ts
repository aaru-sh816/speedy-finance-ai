import { NextRequest, NextResponse } from "next/server"
import { classifyInvestor, type InvestorType } from "@/lib/bulk-deals/investorClassifier"

export const dynamic = "force-dynamic"

interface Deal {
  date: string
  scripCode: string
  securityName: string
  clientName: string
  side: string
  quantity: number
  price: number
  exchange: string
}

interface DealWithPerformance extends Deal {
  currentPrice: number | null
  returnPct: number | null
  absoluteGain: number | null
  dealValue: number
  isWinner: boolean | null
  dayHigh: number | null
  dayLow: number | null
  weekHigh52: number | null
  weekLow52: number | null
  volume: string | null
  quoteError?: string
}

interface InvestorStats {
  name: string
  type: InvestorType
  totalDeals: number
  buyDeals: number
  sellDeals: number
  totalValue: number
  buyValue: number
  sellValue: number
  winners: number
  losers: number
  winRate: number
  avgReturn: number
  totalPnL: number
  deals: DealWithPerformance[]
}

async function fetchQuote(scripCode: string): Promise<any> {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"
  try {
    const res = await fetch(`${bseServiceUrl}/api/quote/${scripCode}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) return data.data
    }
  } catch (e) {
    console.error(`Quote fetch failed for ${scripCode}:`, e)
  }
  return null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get("days") || "1")
  const investorType = searchParams.get("type") as InvestorType | "all" | null
  
  try {
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Fetch deals from history API
    const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"
    const dealsRes = await fetch(
      `${bseServiceUrl}/api/bulk-deals/database?start=${formatDate(startDate)}&end=${formatDate(endDate)}`,
      { signal: AbortSignal.timeout(30000) }
    )
    
    if (!dealsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 })
    }
    
    const dealsData = await dealsRes.json()
    const deals: Deal[] = dealsData.deals || []
    
    // Get unique scrip codes and fetch quotes in parallel (limit to avoid rate limiting)
    const uniqueScripCodes = [...new Set(deals.map(d => d.scripCode))].slice(0, 50)
    const quotePromises = uniqueScripCodes.map(code => 
      fetchQuote(code).then(quote => ({ code, quote }))
    )
    const quoteResults = await Promise.all(quotePromises)
    const quotesMap = new Map<string, any>()
    for (const { code, quote } of quoteResults) {
      if (quote) quotesMap.set(code, quote)
    }
    
    // Process deals with performance data
    const dealsWithPerformance: DealWithPerformance[] = deals.map(deal => {
      const quote = quotesMap.get(deal.scripCode)
      const dealValue = (deal.quantity || 0) * (deal.price || 0)
      
      if (!quote || !deal.price) {
        return {
          ...deal,
          currentPrice: null,
          returnPct: null,
          absoluteGain: null,
          dealValue,
          isWinner: null,
          dayHigh: null,
          dayLow: null,
          weekHigh52: null,
          weekLow52: null,
          volume: null,
          quoteError: quote ? undefined : "Quote unavailable"
        }
      }
      
      const currentPrice = parseFloat(quote.currentValue || quote.ltp || quote.lastPrice || 0)
      const returnPct = deal.price > 0 ? ((currentPrice - deal.price) / deal.price) * 100 : 0
      const absoluteGain = (currentPrice - deal.price) * (deal.quantity || 0)
      
      // For BUY: positive return = winner, For SELL: negative return = winner (sold before drop)
      const isBuy = deal.side?.toUpperCase() === 'BUY'
      const isWinner = isBuy ? returnPct > 0 : returnPct < 0
      
      return {
        ...deal,
        currentPrice,
        returnPct,
        absoluteGain: isBuy ? absoluteGain : -absoluteGain,
        dealValue,
        isWinner,
        dayHigh: parseFloat(quote.dayHigh || 0) || null,
        dayLow: parseFloat(quote.dayLow || 0) || null,
        weekHigh52: parseFloat(quote.weekHigh52 || quote['52WeekHigh'] || 0) || null,
        weekLow52: parseFloat(quote.weekLow52 || quote['52WeekLow'] || 0) || null,
        volume: quote.totalTradedQuantity || quote.volume || null,
      }
    })
    
    // Group by investor and calculate stats
    const investorMap = new Map<string, InvestorStats>()
    
    for (const deal of dealsWithPerformance) {
      const classification = classifyInvestor(deal.clientName)
      
      // Filter by investor type if specified
      if (investorType && investorType !== "all" && classification.type !== investorType) {
        continue
      }
      
      const existing = investorMap.get(deal.clientName) || {
        name: deal.clientName,
        type: classification.type,
        totalDeals: 0,
        buyDeals: 0,
        sellDeals: 0,
        totalValue: 0,
        buyValue: 0,
        sellValue: 0,
        winners: 0,
        losers: 0,
        winRate: 0,
        avgReturn: 0,
        totalPnL: 0,
        deals: []
      }
      
      existing.totalDeals++
      existing.totalValue += deal.dealValue
      existing.deals.push(deal)
      
      const isBuy = deal.side?.toUpperCase() === 'BUY'
      if (isBuy) {
        existing.buyDeals++
        existing.buyValue += deal.dealValue
      } else {
        existing.sellDeals++
        existing.sellValue += deal.dealValue
      }
      
      if (deal.isWinner !== null) {
        if (deal.isWinner) existing.winners++
        else existing.losers++
      }
      
      if (deal.absoluteGain !== null) {
        existing.totalPnL += deal.absoluteGain
      }
      
      investorMap.set(deal.clientName, existing)
    }
    
    // Calculate final stats for each investor
    const investors: InvestorStats[] = Array.from(investorMap.values()).map(inv => {
      const totalWithQuotes = inv.winners + inv.losers
      const winRate = totalWithQuotes > 0 ? (inv.winners / totalWithQuotes) * 100 : 0
      
      const returnsWithQuotes = inv.deals
        .filter(d => d.returnPct !== null)
        .map(d => d.returnPct!)
      const avgReturn = returnsWithQuotes.length > 0 
        ? returnsWithQuotes.reduce((a, b) => a + b, 0) / returnsWithQuotes.length 
        : 0
      
      return {
        ...inv,
        winRate,
        avgReturn
      }
    })
    
    // Sort by total value
    investors.sort((a, b) => b.totalValue - a.totalValue)
    
    // Calculate summary
    const summary = {
      totalDeals: dealsWithPerformance.length,
      totalValue: dealsWithPerformance.reduce((sum, d) => sum + d.dealValue, 0),
      dealsWithQuotes: dealsWithPerformance.filter(d => d.currentPrice !== null).length,
      winners: dealsWithPerformance.filter(d => d.isWinner === true).length,
      losers: dealsWithPerformance.filter(d => d.isWinner === false).length,
      avgReturn: (() => {
        const returns = dealsWithPerformance.filter(d => d.returnPct !== null).map(d => d.returnPct!)
        return returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
      })(),
      totalPnL: dealsWithPerformance.reduce((sum, d) => sum + (d.absoluteGain || 0), 0),
      individualInvestors: investors.filter(i => i.type === 'individual').length,
      institutionalInvestors: investors.filter(i => i.type === 'institutional').length,
    }
    
    return NextResponse.json({
      success: true,
      deals: dealsWithPerformance,
      investors: investors.slice(0, 50), // Top 50 investors
      summary,
      dateRange: { start: formatDate(startDate), end: formatDate(endDate) }
    })
    
  } catch (error: any) {
    console.error("Performance API error:", error)
    return NextResponse.json(
      { error: "Failed to calculate performance", message: error.message },
      { status: 500 }
    )
  }
}
