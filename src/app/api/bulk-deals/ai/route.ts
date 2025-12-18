import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import OpenAI from "openai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function rupeeCompact(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`
  return `₹${value.toLocaleString("en-IN")}`
}

async function loadDeals(start: string, end: string) {
  try {
    const projectRoot = process.cwd()
    const dbPath = path.join(projectRoot, "python-services", "data", "bulk-deals", "bulk_deals_database.json")
    const dbFile = await fs.readFile(dbPath, "utf-8")
    const database = JSON.parse(dbFile)
    
    return (database.deals || []).filter((d: any) => {
      const date = d.date || ""
      return date >= start && date <= end
    })
  } catch (e) {
    console.error("Failed to load deals:", e)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, dateRange, totalDeals } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: "Query required" }, { status: 400 })
    }

    // Load deals for context
    const deals = await loadDeals(dateRange?.start || "2024-01-01", dateRange?.end || new Date().toISOString().split("T")[0])
    
    // Calculate summary stats for context
    const buyDeals = deals.filter((d: any) => d.side === "BUY" || d.side === "B" || d.side === "P")
    const sellDeals = deals.filter((d: any) => d.side === "SELL" || d.side === "S")
    
    const totalBuyValue = buyDeals.reduce((sum: number, d: any) => 
      sum + (Number(d.quantity) || 0) * (Number(d.price) || 0), 0)
    const totalSellValue = sellDeals.reduce((sum: number, d: any) => 
      sum + (Number(d.quantity) || 0) * (Number(d.price) || 0), 0)
    
    // Top investors
    const investorMap = new Map<string, { name: string; value: number; buyValue: number; sellValue: number; count: number }>()
    for (const d of deals) {
      const value = (Number(d.quantity) || 0) * (Number(d.price) || 0)
      const existing = investorMap.get(d.clientName) || { name: d.clientName, value: 0, buyValue: 0, sellValue: 0, count: 0 }
      existing.value += value
      existing.count++
      if (d.side === "BUY" || d.side === "B" || d.side === "P") existing.buyValue += value
      else existing.sellValue += value
      investorMap.set(d.clientName, existing)
    }
    const topInvestors = Array.from(investorMap.values()).sort((a, b) => b.value - a.value).slice(0, 10)
    
    // Top companies
    const companyMap = new Map<string, { name: string; code: string; value: number; buyValue: number; sellValue: number }>()
    for (const d of deals) {
      const value = (Number(d.quantity) || 0) * (Number(d.price) || 0)
      const key = d.scripCode || d.securityName
      const existing = companyMap.get(key) || { name: d.securityName, code: d.scripCode, value: 0, buyValue: 0, sellValue: 0 }
      existing.value += value
      if (d.side === "BUY" || d.side === "B" || d.side === "P") existing.buyValue += value
      else existing.sellValue += value
      companyMap.set(key, existing)
    }
    const topCompanies = Array.from(companyMap.values()).sort((a, b) => b.value - a.value).slice(0, 10)
    
    // Big money deals
    const bigMoneyDeals = deals.filter((d: any) => (Number(d.quantity) || 0) * (Number(d.price) || 0) >= 1e8)
    
    // Build context for AI
    const context = `
BULK DEALS DATABASE CONTEXT:
- Date Range: ${dateRange?.start} to ${dateRange?.end}
- Total Deals: ${deals.length}
- Total Buy Value: ${rupeeCompact(totalBuyValue)}
- Total Sell Value: ${rupeeCompact(totalSellValue)}
- Big Money Deals (≥₹10Cr): ${bigMoneyDeals.length}

TOP 10 INVESTORS BY VALUE:
${topInvestors.map((inv, i) => `${i+1}. ${inv.name}: ${rupeeCompact(inv.value)} (Buy: ${rupeeCompact(inv.buyValue)}, Sell: ${rupeeCompact(inv.sellValue)}, ${inv.count} deals)`).join('\n')}

TOP 10 COMPANIES BY DEAL VALUE:
${topCompanies.map((c, i) => `${i+1}. ${c.name} (${c.code}): ${rupeeCompact(c.value)} (Buy: ${rupeeCompact(c.buyValue)}, Sell: ${rupeeCompact(c.sellValue)})`).join('\n')}

RECENT BIG MONEY DEALS:
${bigMoneyDeals.slice(0, 5).map((d: any) => `- ${d.clientName} ${d.side === 'BUY' || d.side === 'B' || d.side === 'P' ? 'bought' : 'sold'} ${d.securityName} for ${rupeeCompact((Number(d.quantity) || 0) * (Number(d.price) || 0))} on ${d.date}`).join('\n')}
`

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Speedy AI, a financial intelligence assistant specialized in analyzing bulk deals data from Indian stock exchanges (NSE/BSE).

You have access to a database of ${deals.length} bulk deals.

Your responses should be:
- Concise and actionable (2-4 sentences max)
- Data-driven with specific numbers
- Professional and insightful

When asked about investors or companies, provide specific names and values.
When asked about patterns, identify accumulation/distribution trends.
Always mention specific deal values in crores (Cr) or lakhs (L).

${context}`
        },
        {
          role: "user",
          content: query
        }
      ],
      max_tokens: 300,
      temperature: 0.3,
    })

    const response = completion.choices[0]?.message?.content || "I couldn't analyze the data."
    
    // Extract suggestions from response (investors and companies mentioned)
    const suggestions: { type: "person" | "company"; name: string; code?: string }[] = []
    
    // Add top investors as suggestions if query is about investors
    if (query.toLowerCase().includes("investor") || query.toLowerCase().includes("buyer") || query.toLowerCase().includes("seller") || query.toLowerCase().includes("who")) {
      topInvestors.slice(0, 3).forEach(inv => {
        suggestions.push({ type: "person", name: inv.name })
      })
    }
    
    // Add top companies if query is about companies
    if (query.toLowerCase().includes("stock") || query.toLowerCase().includes("company") || query.toLowerCase().includes("accumul")) {
      topCompanies.slice(0, 3).forEach(c => {
        suggestions.push({ type: "company", name: c.name, code: c.code })
      })
    }

    return NextResponse.json({
      response,
      suggestions,
      stats: {
        totalDeals: deals.length,
        buyValue: totalBuyValue,
        sellValue: totalSellValue,
        bigMoneyDeals: bigMoneyDeals.length,
      }
    })
  } catch (error: any) {
    console.error("Bulk deals AI error:", error)
    return NextResponse.json(
      { error: "Failed to process query", message: error?.message },
      { status: 500 }
    )
  }
}
