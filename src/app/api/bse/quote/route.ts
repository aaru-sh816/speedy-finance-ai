import { NextRequest, NextResponse } from "next/server"
import {
  getBseQuoteFromApi,
  getBse52WeekFromApi,
  getBseMarketCapFromApi,
  getNseQuoteFromApi,
} from "@/lib/nse-bse/unified-market"
import { fetchBseCompanyHeader } from "@/lib/bse/company-header"

export const dynamic = 'force-dynamic'
export const revalidate = 45

// Check if symbol looks like BSE scrip code (numeric)
function isBseScripCode(symbol: string): boolean {
  return /^\d{5,6}$/.test(symbol)
}

// Try NSE quote
async function tryNseQuote(symbol: string) {
  try {
    const nseUrl = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`
    const nseRes = await fetch(nseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
      },
      cache: 'no-store',
    })
    
    if (nseRes.ok) {
      const data = await nseRes.json()
      if (data?.priceInfo?.lastPrice) {
        return {
          symbol: symbol.toUpperCase(),
          price: Number(data.priceInfo.lastPrice || 0),
          change: Number(data.priceInfo.change || 0),
          changePercent: Number(data.priceInfo.pChange || 0),
          volume: Number(data.preOpenMarket?.totalTradedVolume || 0),
          dayHigh: Number(data.priceInfo.intraDayHighLow?.max || 0),
          dayLow: Number(data.priceInfo.intraDayHighLow?.min || 0),
          previousClose: Number(data.priceInfo.previousClose || 0),
          timestamp: new Date().toISOString(),
          source: 'nse'
        }
      }
    }
  } catch (e) {
    // Ignore NSE errors
  }
  return null
}

// Try Google Finance as universal fallback
async function tryGoogleFinance(symbol: string) {
  try {
    const suffixes = ['NSE', 'BOM']
    for (const suffix of suffixes) {
      const googleUrl = `https://www.google.com/finance/quote/${symbol}:${suffix}`
      const res = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        cache: 'no-store',
      })
      
      if (res.ok) {
        const html = await res.text()
        // Extract price from Google Finance HTML (crude but works)
        const priceMatch = html.match(/data-last-price="([\d.]+)"/)
        const changeMatch = html.match(/data-last-normal-market-change-percent="([-\d.]+)"/)
        const prevCloseMatch = html.match(/data-previous-close="([\d.]+)"/)
        
        if (priceMatch) {
          const price = Number(priceMatch[1])
          const prevClose = prevCloseMatch ? Number(prevCloseMatch[1]) : null
          const changePercent = changeMatch ? Number(changeMatch[1]) : null
          
          return {
            symbol: symbol.toUpperCase(),
            price,
            change: prevClose ? price - prevClose : null,
            changePercent,
            volume: null,
            dayHigh: null,
            dayLow: null,
            previousClose: prevClose,
            timestamp: new Date().toISOString(),
            source: `google-${suffix.toLowerCase()}`
          }
        }
      }
    }
  } catch (e) {
    // Ignore Google Finance errors
  }
  return null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol parameter is required" },
      { status: 400 }
    )
  }

  const parseNumber = (val: any): number | null => {
    if (val == null || val === "") return null
    if (typeof val === "number") return isNaN(val) ? null : val
    if (typeof val === "string") {
      const cleaned = val.replace(/,/g, "").replace(/[^\d.-]/g, "").trim()
      const num = parseFloat(cleaned)
      return isNaN(num) ? null : num
    }
    return null
  }

  // BSE scrip codes: use nse-bse-api only; enrich with 52-week and marketCap (listSecurities + ComHeader fallback)
  if (isBseScripCode(symbol)) {
    const [bseApiQuote, week52, companyHeader, mcapFromList] = await Promise.all([
      getBseQuoteFromApi(symbol),
      getBse52WeekFromApi(symbol),
      fetchBseCompanyHeader(symbol),
      getBseMarketCapFromApi(symbol),
    ])
    if (bseApiQuote) {
      let marketCap = parseNumber(companyHeader?.marketCap) ?? mcapFromList ?? null
      let volume = bseApiQuote.volume

      // If marketCap/volume still missing, try Python service (optional)
      if ((marketCap == null || volume == null) && process.env.BSE_SERVICE_URL) {
        try {
          const bseServiceUrl = process.env.BSE_SERVICE_URL
          const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(3000),
          })
          if (res.ok) {
            const json = await res.json()
            if (json.success && json.data) {
              const data = json.data
              marketCap = marketCap ?? parseNumber(data.marketCapFull ?? data.marketCapFreeFloat ?? data.marketCap ?? data.mktCap)
              volume = volume ?? parseNumber(data.totalTradedQuantity ?? data.volume ?? data.totalTradedVolume)
            }
          }
        } catch (_) {}
      }

      return NextResponse.json({
        symbol: bseApiQuote.symbol,
        price: bseApiQuote.price,
        change: bseApiQuote.change,
        changePercent: bseApiQuote.changePercent,
        volume,
        dayHigh: bseApiQuote.dayHigh,
        dayLow: bseApiQuote.dayLow,
        previousClose: bseApiQuote.previousClose,
        fiftyTwoWeekHigh: week52?.fifty2WeekHigh ?? null,
        fiftyTwoWeekLow: week52?.fifty2WeekLow ?? null,
        marketCap: marketCap ?? bseApiQuote.marketCap ?? null,
        timestamp: new Date().toISOString(),
        source: "nse-bse-api",
      })
    }
    // Optional: try Python service if configured
    try {
      const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
      const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          const data = json.data
          return NextResponse.json({
            symbol: symbol.toUpperCase(),
            price: parseNumber(data.currentValue ?? data.lastPrice ?? data.ltp ?? data.price),
            change: parseNumber(data.change),
            changePercent: parseNumber(data.pChange ?? data.percentChange),
            volume: parseNumber(data.totalTradedQuantity ?? data.volume ?? data.totalTradedVolume),
            dayHigh: parseNumber(data.dayHigh ?? data.high),
            dayLow: parseNumber(data.dayLow ?? data.low),
            previousClose: parseNumber(data.previousClose ?? data.prevClose),
            fiftyTwoWeekHigh: parseNumber(data.weekHigh52 ?? data.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: parseNumber(data.weekLow52 ?? data.fiftyTwoWeekLow),
            marketCap: parseNumber(data.marketCapFull ?? data.marketCapFreeFloat ?? data.marketCap ?? data.mktCap),
            timestamp: new Date().toISOString(),
            source: "bse-python",
          })
        }
      }
    } catch (_) {}
    const googleQuote = await tryGoogleFinance(symbol)
    if (googleQuote) return NextResponse.json(googleQuote)
    return NextResponse.json(
      { error: "Failed to fetch BSE quote", symbol },
      { status: 404 }
    )
  }

  // NSE path: try nse-bse-api then direct NSE then Google
  if (!isBseScripCode(symbol)) {
    // Try nse-bse-api NSE quote (direct, no external service)
    const nseApiQuote = await getNseQuoteFromApi(symbol)
    if (nseApiQuote) {
      return NextResponse.json({
        symbol: nseApiQuote.symbol,
        price: nseApiQuote.price,
        change: nseApiQuote.change,
        changePercent: nseApiQuote.changePercent,
        volume: nseApiQuote.volume,
        dayHigh: nseApiQuote.dayHigh,
        dayLow: nseApiQuote.dayLow,
        previousClose: nseApiQuote.previousClose,
        fiftyTwoWeekHigh: nseApiQuote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: nseApiQuote.fiftyTwoWeekLow,
        timestamp: new Date().toISOString(),
        source: "nse-bse-api",
      })
    }
    const nseQuote = await tryNseQuote(symbol)
    if (nseQuote) {
      return NextResponse.json(nseQuote)
    }
    
    // Try Google Finance as fallback
    const googleQuote = await tryGoogleFinance(symbol)
    if (googleQuote) {
      return NextResponse.json(googleQuote)
    }
    return NextResponse.json(
      { error: "Failed to fetch quote", symbol },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { error: "Failed to fetch quote", symbol },
    { status: 404 }
  )
}

