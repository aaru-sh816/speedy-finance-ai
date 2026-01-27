import { NextRequest, NextResponse } from "next/server"

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

  // First try NSE for non-numeric symbols (likely NSE tickers)
  if (!isBseScripCode(symbol)) {
    const nseQuote = await tryNseQuote(symbol)
    if (nseQuote) {
      return NextResponse.json(nseQuote)
    }
    
    // Try Google Finance as fallback
    const googleQuote = await tryGoogleFinance(symbol)
    if (googleQuote) {
      return NextResponse.json(googleQuote)
    }
  }

    try {
      const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:8080'
      const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
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

    let marketCap =
      data.marketCapFull ??
      data.marketCapFreeFloat ??
      data.marketCap ??
      data.mktCap ??
      null

    // Fallback for market cap if missing and it's a BSE code
    if (marketCap == null && isBseScripCode(symbol)) {
      try {
        const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:8080'
        // Correct endpoint in app.py is /api/company/<scrip_code>
        const headerRes = await fetch(`${bseServiceUrl}/api/company/${symbol}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        })
        if (headerRes.ok) {
          const headerJson = await headerRes.json()
          if (headerJson.success && headerJson.data?.quote) {
            const q = headerJson.data.quote
            marketCap = q.marketCapFull || q.marketCapFreeFloat || q.marketCap || q.mktCap || null
          }
        }
      } catch (e) {
        // Ignore header fallback error
      }
    }

    // Secondary fallback using direct BSE ScripHeaderData API
    if (marketCap == null && isBseScripCode(symbol)) {
      try {
        const bseHeaderUrl = `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?scripcode=${symbol}`
        const directHeaderRes = await fetch(bseHeaderUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bseindia.com/',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(3000)
        })
        if (directHeaderRes.ok) {
          const hData = await directHeaderRes.json()
          // Extract MCap from BSE header data - usually in 'MktCapFull' or 'MktCapFF'
          marketCap = hData.MktCapFull || hData.MktCapFF || hData.CurrMktCap || null
        }
      } catch (e) {}
    }

    const parseNumber = (val: any) => {
      if (val == null || val === '') return null
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
        const num = parseFloat(cleaned)
        return isNaN(num) ? null : num
      }
      return null
    }

    // Transform to match existing Quote interface
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price: parseNumber(price),
      change: parseNumber(change),
      changePercent: parseNumber(changePercent),
      volume: parseNumber(volume),
      dayHigh: parseNumber(dayHigh),
      dayLow: parseNumber(dayLow),
      marketCap: parseNumber(marketCap),
      open: parseNumber(data.previousOpen ?? data.open),
      previousClose: parseNumber(data.previousClose ?? data.prevClose),
        fiftyTwoWeekHigh: parseNumber(data.weekHigh52 ?? data.fiftyTwoWeekHigh ?? data['52weekHigh'] ?? data['52WeekHigh']),
        fiftyTwoWeekLow: parseNumber(data.weekLow52 ?? data.fiftyTwoWeekLow ?? data['52weekLow'] ?? data['52WeekLow']),
      timestamp: new Date().toISOString(),
      raw: data
    })
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.includes('BSE service returned')) {
        // Reduced noise: log as info instead of warn for common timeouts
        console.info(`Quote API issue for ${symbol}, trying fallbacks: ${error.message}`)
        
        // Try direct BSE API as fallback
        try {
          const bseDirectUrl = `https://api.bseindia.com/BseIndiaAPI/api/StockTrading/w?flag=&quotetype=EQ&scripcode=${encodeURIComponent(symbol)}`
          const directRes = await fetch(bseDirectUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.bseindia.com/',
              'Accept': 'application/json',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
          })
          
          if (directRes.ok) {
            const directData = await directRes.json()
            if (directData && (directData.CurrRate || directData.LTP)) {
              return NextResponse.json({
                symbol: symbol.toUpperCase(),
                price: Number(directData.CurrRate || directData.LTP || 0),
                change: Number(directData.Change || 0),
                changePercent: Number(directData.PcntChange || directData.PercentChange || 0),
                volume: Number(directData.TradQnty || directData.Volume || 0),
                dayHigh: Number(directData.High || 0),
                dayLow: Number(directData.Low || 0),
                previousClose: Number(directData.PrevClose || directData.YesterdayClose || 0),
                timestamp: new Date().toISOString(),
                source: 'bse-direct'
              })
            }
          }
        } catch (e) {
          // Silent fallback failure
        }
        
        // Final fallback: try Google Finance
        const googleQuote = await tryGoogleFinance(symbol)
        if (googleQuote) {
          return NextResponse.json(googleQuote)
        }
      }

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return NextResponse.json(
          { error: "Request timeout", symbol },
          { status: 504 }
        )
      }
      
      // Log as warning instead of error for individual quote failures
      console.warn(`Quote API error for ${symbol}:`, error.message || error)

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

