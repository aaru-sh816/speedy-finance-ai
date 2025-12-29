import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface YesterdayDeal {
  date: string
  scripCode: string
  securityName: string
  clientName: string
  side: string
  quantity: number
  dealPrice: number
  exchange: string
  baselineClose: number | null
  currentPrice: number | null
  changeFromBaseline: number | null
  changePct: number | null
  volume: string | null
  dayHigh: number | null
  dayLow: number | null
}

interface BaselineCache {
  [scripCode: string]: {
    price: number
    timestamp: string
  }
}

async function fetchQuote(scripCode: string): Promise<any> {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:8080"
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

function getYesterdayDate(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
}

function isMarketHours(): boolean {
  const now = new Date()
  const istHour = now.getHours() + (now.getTimezoneOffset() / 60) + 5.5
  const istMinutes = now.getMinutes()
  const totalMinutes = istHour * 60 + istMinutes
  
  const marketOpen = 9 * 60 + 15
  const marketClose = 15 * 60 + 30
  
  return totalMinutes >= marketOpen && totalMinutes <= marketClose
}

export async function GET(request: NextRequest) {
  try {
    const yesterdayDate = getYesterdayDate()
    const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:8080"
    
    const dealsRes = await fetch(
      `${bseServiceUrl}/api/bulk-deals/database?start=${yesterdayDate}&end=${yesterdayDate}`,
      { signal: AbortSignal.timeout(30000) }
    )
    
    if (!dealsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch yesterday's deals" }, { status: 500 })
    }
    
    const dealsData = await dealsRes.json()
    const deals: any[] = dealsData.deals || []
    
    if (deals.length === 0) {
      return NextResponse.json({
        success: true,
        deals: [],
        summary: {
          totalDeals: 0,
          moversUp: 0,
          moversDown: 0,
          avgChange: 0,
          topGainer: null,
          topLoser: null,
        },
        isMarketHours: isMarketHours(),
        yesterdayDate,
      })
    }
    
    const uniqueScripCodes = [...new Set(deals.map(d => d.scripCode))]
    
    const quotePromises = uniqueScripCodes.map(code => 
      fetchQuote(code).then(quote => ({ code, quote }))
    )
    const quoteResults = await Promise.all(quotePromises)
    const quotesMap = new Map<string, any>()
    for (const { code, quote } of quoteResults) {
      if (quote) quotesMap.set(code, quote)
    }
    
    const yesterdayDeals: YesterdayDeal[] = deals.map(deal => {
      const quote = quotesMap.get(deal.scripCode)
      
      const currentPrice = quote ? parseFloat(quote.currentValue || quote.ltp || quote.lastPrice || 0) : null
      const prevClose = quote ? parseFloat(quote.previousClose || quote.prevClose || 0) : null
      
      const baselineClose = prevClose || null
      
      const changeFromBaseline = baselineClose && currentPrice 
        ? currentPrice - baselineClose 
        : null
      const changePct = baselineClose && currentPrice && baselineClose > 0
        ? ((currentPrice - baselineClose) / baselineClose) * 100
        : null
      
      return {
        date: deal.date,
        scripCode: deal.scripCode,
        securityName: deal.securityName,
        clientName: deal.clientName,
        side: deal.side,
        quantity: deal.quantity || 0,
        dealPrice: deal.price || 0,
        exchange: deal.exchange,
        baselineClose,
        currentPrice,
        changeFromBaseline,
        changePct,
        volume: quote?.totalTradedQuantity || quote?.volume || null,
        dayHigh: quote ? parseFloat(quote.dayHigh || 0) || null : null,
        dayLow: quote ? parseFloat(quote.dayLow || 0) || null : null,
      }
    })
    
    const dealsWithQuotes = yesterdayDeals.filter(d => d.changePct !== null)
    const moversUp = dealsWithQuotes.filter(d => d.changePct! > 0)
    const moversDown = dealsWithQuotes.filter(d => d.changePct! < 0)
    
    const avgChange = dealsWithQuotes.length > 0
      ? dealsWithQuotes.reduce((sum, d) => sum + (d.changePct || 0), 0) / dealsWithQuotes.length
      : 0
    
    const topGainer = dealsWithQuotes.length > 0
      ? dealsWithQuotes.reduce((max, d) => (d.changePct! > (max.changePct || -Infinity) ? d : max))
      : null
    
    const topLoser = dealsWithQuotes.length > 0
      ? dealsWithQuotes.reduce((min, d) => (d.changePct! < (min.changePct || Infinity) ? d : min))
      : null
    
    yesterdayDeals.sort((a, b) => (b.changePct || -Infinity) - (a.changePct || -Infinity))
    
    return NextResponse.json({
      success: true,
      deals: yesterdayDeals,
      summary: {
        totalDeals: deals.length,
        dealsWithQuotes: dealsWithQuotes.length,
        moversUp: moversUp.length,
        moversDown: moversDown.length,
        avgChange,
        topGainer: topGainer ? {
          scripCode: topGainer.scripCode,
          securityName: topGainer.securityName,
          changePct: topGainer.changePct,
          changeFromBaseline: topGainer.changeFromBaseline,
        } : null,
        topLoser: topLoser ? {
          scripCode: topLoser.scripCode,
          securityName: topLoser.securityName,
          changePct: topLoser.changePct,
          changeFromBaseline: topLoser.changeFromBaseline,
        } : null,
      },
      isMarketHours: isMarketHours(),
      yesterdayDate,
    })
    
  } catch (error: any) {
    console.error("Yesterday movers API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch yesterday's movers", message: error.message },
      { status: 500 }
    )
  }
}
