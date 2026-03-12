import { NextRequest, NextResponse } from "next/server"
import { getSegmentRevenue, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

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
    const period = (searchParams.get("period") || "annual") as "quarterly" | "annual" | "ttm"
    const statement_type = searchParams.get("statement_type") || "c"
    const statement_code = searchParams.get("statement_code") || "pl"
    const data = await getSegmentRevenue(nseSymbol, { period, statement_type, statement_code })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge segment-revenue]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch segment revenue" },
      { status: 500 }
    )
  }
}
