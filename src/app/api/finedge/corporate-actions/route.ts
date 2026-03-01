import { NextRequest, NextResponse } from "next/server"
import { getCorporateActionsAll, resolveNseSymbol } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

function isBseScripCode(s: string): boolean {
  return /^\d{5,6}$/.test(String(s).trim())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let symbol = searchParams.get("symbol") ?? undefined
    if (symbol && isBseScripCode(symbol)) {
      symbol = (await resolveNseSymbol(symbol)) ?? symbol
    }
    const action = searchParams.get("action") ?? undefined
    const from_date = searchParams.get("from_date") ?? undefined
    const to_date = searchParams.get("to_date") ?? undefined
    const data = await getCorporateActionsAll({
      symbol,
      action,
      from_date,
      to_date,
    })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge corporate-actions]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch corporate actions" },
      { status: 500 }
    )
  }
}
