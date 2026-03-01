import { NextRequest, NextResponse } from "next/server"
import { bseClient } from "@/lib/bse/client"
import { getBseQuoteFromApi, getBse52WeekFromApi, getBseMarketCapFromApi } from "@/lib/nse-bse/unified-market"
import { fetchBseCompanyHeader } from "@/lib/bse/company-header"

export const dynamic = 'force-dynamic'
export const revalidate = 30

/** Build enhanced-quote payload from nse-bse-api (quote + 52w + mcap from listSecurities). No market depth. */
async function fallbackEnhancedQuote(scripCode: string): Promise<{
  success: true;
  data: Record<string, unknown>;
  source: "nse-bse-api";
}> {
  const [quote, week52, header, mcapFromList] = await Promise.all([
    getBseQuoteFromApi(scripCode),
    getBse52WeekFromApi(scripCode),
    fetchBseCompanyHeader(scripCode),
    getBseMarketCapFromApi(scripCode),
  ])
  if (!quote) {
    throw new Error("No quote from nse-bse-api")
  }
  const marketCap = header?.marketCap != null ? String(header.marketCap) : (mcapFromList != null ? String(mcapFromList) : undefined)
  const volume = quote.volume != null ? quote.volume : null
  return {
    success: true,
    data: {
      scripCode,
      securityID: header?.symbol ?? scripCode,
      companyName: header?.companyName ?? "",
      currentValue: quote.price,
      change: quote.change ?? 0,
      pChange: quote.changePercent ?? 0,
      previousClose: quote.previousClose,
      previousOpen: quote.open ?? null,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      weekHigh52: week52?.fifty2WeekHigh ?? null,
      weekLow52: week52?.fifty2WeekLow ?? null,
      totalTradedQuantity: volume,
      totalTradedValue: null,
      marketCapFull: marketCap ?? null,
      marketCapFreeFloat: null,
      buy: {},
      sell: {},
      updatedOn: new Date().toISOString(),
      _source: "nse-bse-api",
      _marketDepthNote: "Live market depth requires BSE Python service (BSE_SERVICE_URL).",
    },
    source: "nse-bse-api",
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const scripCode = searchParams.get("scripCode")

  if (!scripCode) {
    return NextResponse.json(
      { error: "scripCode parameter is required" },
      { status: 400 }
    )
  }

  // Prefer Python service for full quote + market depth
  try {
    const isHealthy = await bseClient.healthCheck()
    if (isHealthy) {
      const quote = await bseClient.getQuote(scripCode)
      return NextResponse.json({
        success: true,
        data: quote,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (_) {
    // Fall through to nse-bse-api fallback
  }

  // Fallback: nse-bse-api (quote + 52-week + marketCap). No live depth.
  try {
    const result = await fallbackEnhancedQuote(scripCode)
    return NextResponse.json({
      success: result.success,
      data: result.data,
      timestamp: new Date().toISOString(),
      source: result.source,
    })
  } catch (error: unknown) {
    const err = error as Error
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.info(`Enhanced quote timeout for ${scripCode}`)
      return NextResponse.json({ error: "Request timeout" }, { status: 504 })
    }
    console.warn(`Enhanced quote error for ${scripCode}:`, err.message)
    return NextResponse.json(
      { error: "Failed to fetch enhanced quote", message: err?.message },
      { status: 500 },
    )
  }
}
