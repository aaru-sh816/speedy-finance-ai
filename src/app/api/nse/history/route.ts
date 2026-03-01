import { NextRequest, NextResponse } from "next/server"
import { getNseHistoricalFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"

const MAX_HISTORY_DAYS = 365
const VALID_EQUITY_SYMBOL = /^[A-Z0-9&.-]{1,30}$/

/**
 * GET /api/nse/history?symbol=RELIANCE&from=2024-01-01&to=2024-12-31
 * NSE equity historical data via nse-bse-api.
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim()?.toUpperCase()
  const fromStr = request.nextUrl.searchParams.get("from")
  const toStr = request.nextUrl.searchParams.get("to")
  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol", example: "?symbol=RELIANCE&from=2024-01-01&to=2024-12-31" },
      { status: 400 }
    )
  }
  if (!VALID_EQUITY_SYMBOL.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format" }, { status: 400 })
  }
  const toDate = toStr ? new Date(toStr) : new Date()
  const fromDate = fromStr ? new Date(fromStr) : new Date(toDate.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  if (fromDate.getTime() > toDate.getTime()) {
    return NextResponse.json({ error: "from date must be before to date" }, { status: 400 })
  }
  const daysDiff = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)
  if (daysDiff > MAX_HISTORY_DAYS) {
    return NextResponse.json({ error: `Date range cannot exceed ${MAX_HISTORY_DAYS} days` }, { status: 400 })
  }
  try {
    const data = await getNseHistoricalFromApi({
      symbol,
      from_date: fromDate,
      to_date: toDate,
    })
    return NextResponse.json({
      success: true,
      symbol,
      data,
      source: "nse-bse-api",
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error("[NSE history] Error:", e)
    return NextResponse.json(
      { error: "Failed to fetch NSE historical data", symbol },
      { status: 500 }
    )
  }
}
