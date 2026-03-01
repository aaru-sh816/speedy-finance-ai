import { NextRequest, NextResponse } from "next/server"
import { bseClient } from "@/lib/bse/client"
import { getBseIndicesByDateFromApi, getBseIndicesFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = 'force-dynamic'
export const revalidate = 120

const VALID_CATEGORIES = [
  'market_cap/broad',
  'sector_and_industry',
  'thematics',
  'strategy',
  'sustainability',
  'volatility',
  'composite',
  'government',
  'corporate',
  'money_market'
]

/**
 * BSE indices: data is taken only from nse-bse-api (unified-market).
 * 1) getBseIndicesByDateFromApi -> BSE.fetchAllIndicesDataByDate (IndexArchDailyAll/w)
 * 2) getBseIndicesFromApi -> BSE.fetchIndexNames (FillddlIndex/w)
 * Python (bseClient) is fallback only. No direct api.bseindia.com calls in this route.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get("category") || "market_cap/broad"

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { 
        error: "Invalid category",
        validCategories: VALID_CATEGORIES 
      },
      { status: 400 }
    )
  }

  function mapApiToIndices(fallbackData: Record<string, { indexname?: string; currentvalue?: unknown; change?: unknown; pchange?: unknown }[]>) {
    return Object.values(fallbackData).flat().map((r) => ({
      name: String(r.indexname ?? ""),
      currentValue: String(r.currentvalue ?? ""),
      change: String(r.change ?? ""),
      pChange: String(r.pchange ?? ""),
      scripFlag: "",
    }))
  }

  const cast = (d: Record<string, { indexname?: string; currentvalue?: unknown; change?: unknown; pchange?: unknown }[]>) =>
    mapApiToIndices(d)
  const json = (indices: ReturnType<typeof mapApiToIndices>, source: string) =>
    NextResponse.json({
      success: true,
      category,
      data: { indices, updatedOn: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      source,
    })

  try {
    // 1) nse-bse-api: daily data by date (IndexArchDailyAll)
    const apiData = await getBseIndicesByDateFromApi(new Date())
    const hasApiData = Object.keys(apiData).length > 0 && Object.values(apiData).flat().length > 0
    if (hasApiData) {
      return json(cast(apiData as Record<string, { indexname?: string; currentvalue?: unknown; change?: unknown; pchange?: unknown }[]>), "nse-bse-api")
    }
  } catch (apiErr) {
    console.warn("Indices getBseIndicesByDateFromApi failed:", (apiErr as Error)?.message)
  }

  try {
    // 2) nse-bse-api: index names/list (FillddlIndex) – often works when daily by date is empty
    const namesData = await getBseIndicesFromApi()
    const hasNames = Object.keys(namesData).length > 0 && Object.values(namesData).flat().length > 0
    if (hasNames) {
      return json(cast(namesData as Record<string, { indexname?: string; currentvalue?: unknown; change?: unknown; pchange?: unknown }[]>), "nse-bse-api")
    }
  } catch (namesErr) {
    console.warn("Indices getBseIndicesFromApi failed:", (namesErr as Error)?.message)
  }

  try {
    const isHealthy = await bseClient.healthCheck()
    if (isHealthy) {
      const indices = await bseClient.getIndices(category)
      return NextResponse.json({
        success: true,
        category,
        data: indices,
        timestamp: new Date().toISOString(),
        source: "bse-python",
      })
    }
  } catch (pythonErr) {
    console.warn("Indices Python fallback failed:", (pythonErr as Error)?.message)
  }

  try {
    const fallbackData = await getBseIndicesByDateFromApi(new Date())
    const indices = mapApiToIndices(fallbackData as Record<string, { indexname?: string; currentvalue?: unknown; change?: unknown; pchange?: unknown }[]>)
    if (indices.length > 0) {
      return NextResponse.json({
        success: true,
        category,
        data: { indices, updatedOn: new Date().toISOString() },
        timestamp: new Date().toISOString(),
        source: "nse-bse-api",
      })
    }
  } catch (_) {
    // ignore
  }

  // Return 200 with empty indices so UI can show empty state instead of error
  return NextResponse.json({
    success: true,
    category,
    data: { indices: [], updatedOn: new Date().toISOString() },
    timestamp: new Date().toISOString(),
    source: "none",
    message: "Both nse-bse-api and BSE Python failed; showing empty list.",
  })
}
