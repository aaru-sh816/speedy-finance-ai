import { NextRequest, NextResponse } from "next/server"
import { getIndexValuationHistory } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const index_symbol = searchParams.get("index_symbol")
    const from_date = searchParams.get("from_date")
    const to_date = searchParams.get("to_date")
    if (!index_symbol || !from_date || !to_date) {
      return NextResponse.json(
        { error: "index_symbol, from_date, and to_date are required" },
        { status: 400 }
      )
    }
    const data = await getIndexValuationHistory(index_symbol, from_date, to_date)
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge index valuation-history]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch index valuation history" },
      { status: 500 }
    )
  }
}
