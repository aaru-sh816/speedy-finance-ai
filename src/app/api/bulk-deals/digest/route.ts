import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function rupeeCompact(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`
  if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get("date")
    
    // Default to today
    const targetDate = dateParam || formatDate(new Date())
    
    // Load database
    const projectRoot = process.cwd()
    const dbPath = path.join(projectRoot, "python-services", "data", "bulk-deals", "bulk_deals_database.json")
    
    const dbFile = await fs.readFile(dbPath, "utf-8")
    const database = JSON.parse(dbFile)
    const allDeals = database.deals || []
    
    // Filter by date
    const dayDeals = allDeals.filter((d: any) => d.date === targetDate)
    
    if (dayDeals.length === 0) {
      return NextResponse.json({
        success: true,
        date: targetDate,
        summary: `No bulk deals recorded for ${targetDate}`,
        stats: null,
        topDeals: [],
        topInvestors: [],
      })
    }
    
    // Calculate stats
    const buyDeals = dayDeals.filter((d: any) => d.side === 'BUY' || d.side === 'B' || d.side === 'P')
    const sellDeals = dayDeals.filter((d: any) => d.side === 'SELL' || d.side === 'S')
    
    const totalBuyValue = buyDeals.reduce((sum: number, d: any) => 
      sum + (Number(d.quantity) || 0) * (Number(d.price) || 0), 0)
    const totalSellValue = sellDeals.reduce((sum: number, d: any) => 
      sum + (Number(d.quantity) || 0) * (Number(d.price) || 0), 0)
    
    const uniqueCompanies = new Set(dayDeals.map((d: any) => d.scripCode || d.securityName)).size
    const uniqueInvestors = new Set(dayDeals.map((d: any) => d.clientName)).size
    
    // Top deals by value
    const dealsWithValue = dayDeals.map((d: any) => ({
      ...d,
      value: (Number(d.quantity) || 0) * (Number(d.price) || 0)
    }))
    
    const topDeals = dealsWithValue
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 10)
      .map((d: any) => ({
        company: d.securityName,
        code: d.scripCode,
        investor: d.clientName,
        side: d.side === 'BUY' || d.side === 'B' || d.side === 'P' ? 'BUY' : 'SELL',
        value: d.value,
        valueFormatted: rupeeCompact(d.value),
        quantity: d.quantity,
        price: d.price,
      }))
    
    // Top investors
    const investorMap = new Map<string, { name: string; totalValue: number; buyValue: number; sellValue: number; dealCount: number }>()
    for (const d of dayDeals) {
      const value = (Number(d.quantity) || 0) * (Number(d.price) || 0)
      const existing = investorMap.get(d.clientName) || { name: d.clientName, totalValue: 0, buyValue: 0, sellValue: 0, dealCount: 0 }
      existing.totalValue += value
      existing.dealCount++
      if (d.side === 'BUY' || d.side === 'B' || d.side === 'P') existing.buyValue += value
      else existing.sellValue += value
      investorMap.set(d.clientName, existing)
    }
    
    const topInvestors = Array.from(investorMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(inv => ({
        ...inv,
        totalValueFormatted: rupeeCompact(inv.totalValue),
        buyValueFormatted: rupeeCompact(inv.buyValue),
        sellValueFormatted: rupeeCompact(inv.sellValue),
      }))
    
    // Big money deals (>= ₹10 Cr)
    const bigMoneyDeals = dealsWithValue.filter((d: any) => d.value >= 1e8)
    
    // Generate text summary
    const summary = `
📊 **Bulk Deals Digest - ${targetDate}**

**Overview:**
- Total Deals: ${dayDeals.length}
- Total Buy Value: ${rupeeCompact(totalBuyValue)}
- Total Sell Value: ${rupeeCompact(totalSellValue)}
- Unique Companies: ${uniqueCompanies}
- Unique Investors: ${uniqueInvestors}
${bigMoneyDeals.length > 0 ? `- 🔥 Big Money Deals (≥₹10Cr): ${bigMoneyDeals.length}` : ''}

**Top Deal:**
${topDeals[0] ? `${topDeals[0].investor} ${topDeals[0].side === 'BUY' ? 'bought' : 'sold'} ${topDeals[0].company} worth ${topDeals[0].valueFormatted}` : 'None'}

**Top Investors Today:**
${topInvestors.slice(0, 5).map((inv, i) => `${i + 1}. ${inv.name} - ${inv.totalValueFormatted} (${inv.dealCount} deals)`).join('\n')}
`.trim()
    
    return NextResponse.json({
      success: true,
      date: targetDate,
      summary,
      stats: {
        totalDeals: dayDeals.length,
        buyDeals: buyDeals.length,
        sellDeals: sellDeals.length,
        totalBuyValue,
        totalSellValue,
        totalBuyValueFormatted: rupeeCompact(totalBuyValue),
        totalSellValueFormatted: rupeeCompact(totalSellValue),
        uniqueCompanies,
        uniqueInvestors,
        bigMoneyDeals: bigMoneyDeals.length,
      },
      topDeals,
      topInvestors,
    })
  } catch (error: any) {
    console.error("Digest API error:", error)
    return NextResponse.json(
      { error: "Failed to generate digest", message: error?.message },
      { status: 500 }
    )
  }
}
