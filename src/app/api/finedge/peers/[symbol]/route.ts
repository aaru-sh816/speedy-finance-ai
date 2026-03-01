import { NextRequest, NextResponse } from "next/server"
import { getPeers, resolveNseSymbol } from "@/lib/finedge"
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
    const group = searchParams.get("group") as "sector" | "industry" | "sub_industry" | "macro_sector" | null
    const data = await getPeers(nseSymbol, group ?? undefined)
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge peers]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch peers" },
      { status: 500 }
    )
  }
}
