import { NextRequest, NextResponse } from "next/server"
import { getFinancials, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"
import type { StatementType, StatementCode, Period } from "@/lib/finedge"

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
    const statement_code = (searchParams.get("statement_code") || "pl") as StatementCode
    const period = (searchParams.get("period") || "annual") as Period
    const data = await getFinancials(nseSymbol, {
      statement_type,
      statement_code,
      period,
    })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge financials]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch financials" },
      { status: 500 }
    )
  }
}
