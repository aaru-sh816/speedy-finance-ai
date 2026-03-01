import { NextResponse } from "next/server"
import { getNseBulkDealsFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function POST() {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"

  try {
    const response = await fetch(`${bseServiceUrl}/api/bulk-deals/database/fetch-today`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000), // 60 second timeout for scraping
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[FetchToday] Python service error:", error)
      const today = new Date()
      const nseDeals = await getNseBulkDealsFromApi(today, today)
      const normalized = nseDeals.map((d: any) => ({
        date: formatDate(today),
        scrip_code: d.symbol ?? d.Symbol,
        scripCode: d.symbol ?? d.Symbol,
        security_name: d.securityName ?? d.Symbol ?? d.symbol,
        securityName: d.securityName ?? d.Symbol ?? d.symbol,
        client_name: d.clientName ?? d.ClientName,
        clientName: d.clientName ?? d.ClientName,
        deal_type: d.dealType ?? d.BuySell,
        quantity: Number(d.quantity ?? d.Quantity ?? 0),
        price: Number(d.price ?? d.Price ?? 0),
        exchange: "nse",
      }))
      return NextResponse.json({
        success: true,
        source: "nse-bse-api",
        message: "BSE service unavailable; showing NSE bulk deals for today",
        deals: normalized,
        count: normalized.length,
      })
    }

    const data = await response.json()
    console.log("[FetchToday] Result:", data)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[FetchToday] Error:", error.message)
    const today = new Date()
    try {
      const nseDeals = await getNseBulkDealsFromApi(today, today)
      const normalized = nseDeals.map((d: any) => ({
        date: formatDate(today),
        scrip_code: d.symbol ?? d.Symbol,
        scripCode: d.symbol ?? d.Symbol,
        security_name: d.securityName ?? d.Symbol ?? d.symbol,
        securityName: d.securityName ?? d.Symbol ?? d.symbol,
        client_name: d.clientName ?? d.ClientName,
        clientName: d.clientName ?? d.ClientName,
        deal_type: d.dealType ?? d.BuySell,
        quantity: Number(d.quantity ?? d.Quantity ?? 0),
        price: Number(d.price ?? d.Price ?? 0),
        exchange: "nse",
      }))
      return NextResponse.json({
        success: true,
        source: "nse-bse-api",
        message: "BSE service unavailable; showing NSE bulk deals for today",
        deals: normalized,
        count: normalized.length,
      })
    } catch (nseErr) {
      return NextResponse.json(
        { success: false, error: error.message || "Service unavailable" },
        { status: 500 }
      )
    }
  }
}
