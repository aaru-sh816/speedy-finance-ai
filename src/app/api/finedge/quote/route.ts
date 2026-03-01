import { NextRequest, NextResponse } from "next/server"
import { getQuote, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"
export const revalidate = 60

function isBseScripCode(s: string): boolean {
  return /^\d{5,6}$/.test(String(s).trim())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get("symbol")
    let symbols = symbolParam
      ? symbolParam.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined
    if (symbols && symbols.length > 0) {
      const resolved = await Promise.all(
        symbols.map(async (s) => (isBseScripCode(s) ? (await resolveNseSymbol(s)) ?? s : s))
      )
      symbols = resolved.filter(Boolean) as string[]
    }
    const data = await getQuote(symbols)
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge quote]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch quote" },
      { status: 500 }
    )
  }
}
