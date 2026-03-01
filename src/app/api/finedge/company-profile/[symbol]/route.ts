import { NextResponse } from "next/server"
import { getCompanyProfile, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
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
    const profile = await getCompanyProfile(nseSymbol)
    return NextResponse.json(profile, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge company-profile]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch company profile" },
      { status: 500 }
    )
  }
}
