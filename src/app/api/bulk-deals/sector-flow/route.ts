import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function loadDatabase() {
  const projectRoot = process.cwd()
  const dbPath = path.join(projectRoot, "python-services", "data", "bulk-deals", "bulk_deals_database.json")
  try {
    const dbFile = await fs.readFile(dbPath, "utf-8")
    const database = JSON.parse(dbFile)
    return database.deals || []
  } catch (err) {
    return []
  }
}

// Minimal mapping for demo purposes, in a real app this would come from a DB
const SECTOR_MAPPING: Record<string, string> = {
  "500325": "Energy",
  "532540": "IT Services",
  "500180": "Banking",
  "500209": "IT Services",
  "532174": "Banking",
  "500696": "FMCG",
  "500112": "Banking",
  "532454": "Telecom",
  "512599": "Conglomerate",
  "532215": "Banking",
  "532538": "Cement",
  "500114": "Consumer Durables",
  "500520": "Automobile",
  "500124": "Pharmaceuticals",
  "500470": "Steel",
  "532555": "Power",
  "533278": "Mining",
  "524715": "Pharmaceuticals",
  "532281": "IT Services",
  "500034": "Finance",
  "500820": "Paints",
  "532898": "Power",
  "500570": "Automobile",
  "532187": "Banking",
  "532977": "Automobile",
  "500182": "Automobile",
  "532488": "Pharmaceuticals",
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "90", 10)
    
    const deals = await loadDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]

    const sectorStats: Record<string, { buy: number; sell: number; deals: number; companies: Set<string> }> = {}

    deals.forEach((d: any) => {
      const dealDate = d.date || d.deal_date || ""
      if (dealDate < cutoffStr) return

      const scripCode = d.scrip_code || d.scripCode
      const sector = SECTOR_MAPPING[scripCode] || "Others"
      const side = (d.side || d.deal_type || "").toUpperCase() === "BUY" || d.side === "B" || d.side === "P" ? "BUY" : "SELL"
      const value = (d.quantity || 0) * (d.price || d.trade_price || 0)

      if (!sectorStats[sector]) {
        sectorStats[sector] = { buy: 0, sell: 0, deals: 0, companies: new Set() }
      }

      if (side === "BUY") {
        sectorStats[sector].buy += value
      } else {
        sectorStats[sector].sell += value
      }
      sectorStats[sector].deals++
      sectorStats[sector].companies.add(scripCode)
    })

    const result = Object.entries(sectorStats).map(([name, stats]) => ({
      name,
      buy: stats.buy,
      sell: stats.sell,
      net: stats.buy - stats.sell,
      dealCount: stats.deals,
      companyCount: stats.companies.size
    })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

    return NextResponse.json({
      success: true,
      days,
      data: result
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
