import { NextResponse } from "next/server"
import { getBseLookupFromApi, getNseLookupFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"

export interface LookupItem {
  symbol: string
  name: string
  isin?: string
  scripCode?: string
  exchange: "BSE" | "NSE" | "Both"
}

const MIN_QUERY_LENGTH = 1
const MAX_QUERY_LENGTH = 100

/**
 * GET /api/lookup?q=reliance
 * Unified symbol lookup: BSE + NSE via nse-bse-api. Returns combined list.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [], error: "Query too short" }, { status: 400 })
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ results: [], error: "Query too long" }, { status: 400 })
  }
  try {
    const [bseRow, nseData] = await Promise.all([
      getBseLookupFromApi(q),
      getNseLookupFromApi(q),
    ])
    const results: LookupItem[] = []
    if (bseRow?.symbol && bseRow?.bse_code) {
      results.push({
        symbol: String(bseRow.symbol).toUpperCase(),
        name: String(bseRow.company_name ?? bseRow.symbol),
        isin: bseRow.isin,
        scripCode: bseRow.bse_code,
        exchange: "BSE",
      })
    }
    if (nseData && typeof nseData === "object") {
      const obj = nseData as Record<string, unknown>
      const nseList = (Array.isArray(obj.symbols) ? obj.symbols : Array.isArray(obj.data) ? obj.data : []) as Array<{ symbol?: string; identifier?: string; name?: string }>
      for (const s of nseList.slice(0, 15)) {
        const sym = (s.symbol ?? s.identifier ?? "").toString().trim()
        if (sym && /^[A-Z0-9&.-]+$/i.test(sym) && !results.some((r) => r.symbol.toUpperCase() === sym.toUpperCase())) {
          results.push({
            symbol: String(sym).toUpperCase(),
            name: (s.name ?? sym).toString(),
            exchange: "NSE",
          })
        }
      }
    }
    return NextResponse.json({
      results,
      count: results.length,
      query: q,
      source: "nse-bse-api",
    })
  } catch (e) {
    console.error("[Lookup] Error:", e)
    return NextResponse.json(
      { results: [], error: (e as Error).message },
      { status: 500 }
    )
  }
}
