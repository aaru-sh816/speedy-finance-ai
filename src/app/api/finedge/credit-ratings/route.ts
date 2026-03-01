import { NextRequest, NextResponse } from "next/server"
import { getCreditRatings, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

function isBseScripCode(s: string): boolean {
  return /^\d{5,6}$/.test(String(s).trim())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get("symbol")
    const from_date = searchParams.get("from_date") ?? undefined
    const to_date = searchParams.get("to_date") ?? undefined
    let symbol = symbolParam ?? undefined
    if (symbol && isBseScripCode(symbol)) {
      const nse = await resolveNseSymbol(symbol)
      symbol = nse ?? symbol
    }
    const data = await getCreditRatings({ symbol, from_date, to_date })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge credit-ratings]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch credit ratings" },
      { status: 500 }
    )
  }
}
