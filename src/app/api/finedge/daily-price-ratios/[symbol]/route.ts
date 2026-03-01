import { NextRequest, NextResponse } from "next/server"
import { getDailyPriceRatios, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"
import type { StatementType } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    if (!symbol) {
      return NextResponse.json(
        { error: "symbol is required" },
        { status: 400 }
      )
    }
    const nseSymbol = await resolveNseSymbol(symbol)
    if (!nseSymbol) {
      return NextResponse.json(
        { error: "Symbol not found or could not resolve to NSE" },
        { status: 404 }
      )
    }
    const { searchParams } = new URL(request.url)
    const statement_type = (searchParams.get("statement_type") || "c") as StatementType
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")
    const opts: { statement_type: StatementType; from?: number; to?: number } = { statement_type }
    if (fromStr) {
      const from = parseInt(fromStr, 10)
      if (!isNaN(from)) opts.from = from
    }
    if (toStr) {
      const to = parseInt(toStr, 10)
      if (!isNaN(to)) opts.to = to
    }
    const data = await getDailyPriceRatios(nseSymbol, opts)
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge daily-price-ratios]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch daily price ratios" },
      { status: 500 }
    )
  }
}
