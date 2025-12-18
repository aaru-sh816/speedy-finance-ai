import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const revalidate = 45

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol parameter is required" },
      { status: 400 }
    )
  }

  try {
    const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
    const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`BSE service returned ${res.status}`)
    }

    const json = await res.json()

    if (!json.success) {
      throw new Error(json.error || 'BSE quote response unsuccessful')
    }

    const data = json.data || {}

    const price =
      data.currentValue ??
      data.lastPrice ??
      data.ltp ??
      data.price ??
      null

    const change = data.change ?? null
    const changePercent = data.pChange ?? data.percentChange ?? null

    const volume =
      data.totalTradedQuantity ??
      data.volumeTradedToday ??
      data.volume ??
      data.totalTradedVolume ??
      null

    const dayHigh = data.dayHigh ?? data.high ?? null
    const dayLow = data.dayLow ?? data.low ?? null

    const marketCap =
      data.marketCapFull ??
      data.marketCapFreeFloat ??
      data.marketCap ??
      data.mktCap ??
      null

    // Transform to match existing Quote interface
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price: price != null ? Number(price) : null,
      change: change != null ? Number(change) : null,
      changePercent: changePercent != null ? Number(changePercent) : null,
      volume: volume != null ? Number(volume) : null,
      dayHigh: dayHigh != null ? Number(dayHigh) : null,
      dayLow: dayLow != null ? Number(dayLow) : null,
      marketCap: marketCap != null ? Number(marketCap) : null,
      open: data.previousOpen != null ? Number(data.previousOpen) : (data.open != null ? Number(data.open) : null),
      previousClose: data.previousClose != null ? Number(data.previousClose) : (data.prevClose != null ? Number(data.prevClose) : null),
      fiftyTwoWeekHigh: data.weekHigh52 != null
        ? Number(data.weekHigh52)
        : (data.fiftyTwoWeekHigh != null
          ? Number(data.fiftyTwoWeekHigh)
          : (data['52WeekHigh'] != null ? Number(data['52WeekHigh']) : null)),
      fiftyTwoWeekLow: data.weekLow52 != null
        ? Number(data.weekLow52)
        : (data.fiftyTwoWeekLow != null
          ? Number(data.fiftyTwoWeekLow)
          : (data['52WeekLow'] != null ? Number(data['52WeekLow']) : null)),
      timestamp: new Date().toISOString(),
      raw: data
    })
  } catch (error: any) {
    console.error(`Quote API error for ${symbol}:`, error)
    return NextResponse.json(
      { 
        error: "Failed to fetch quote",
        message: error?.message,
        symbol 
      },
      { status: 500 }
    )
  }
}
