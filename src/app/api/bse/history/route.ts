import { NextResponse } from "next/server"
import { metrics } from "@/lib/infra/metrics"
import { getBseLookupFromApi, getBseListSecuritiesFromApi } from "@/lib/nse-bse/unified-market"

/** Resolve BSE scrip code to symbol via nse-bse-api (no direct BSE URL). */
async function resolveSymbolFromScripCode(scripCode: string): Promise<string | null> {
  const lookup = await getBseLookupFromApi(scripCode)
  if (lookup?.symbol && /^[A-Z0-9&-]+$/i.test(String(lookup.symbol))) {
    return String(lookup.symbol).toUpperCase()
  }
  const list = await getBseListSecuritiesFromApi({ scripcode: scripCode, segment: "Equity", status: "Active" })
  const first = list[0]
  if (first?.symbol && /^[A-Z0-9&-]+$/i.test(first.symbol)) {
    return first.symbol.toUpperCase()
  }
  return null
}

async function getSymbolFromPythonService(scripCode: string): Promise<string | null> {
    try {
      const BSE_SERVICE_URL = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
      const res = await fetch(`${BSE_SERVICE_URL}/api/quote/${scripCode}`, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data.success || !data.data) return null
      
      // bsedata returns securityID which is the BSE symbol
      const symbol = data.data.securityID || data.data.scripId || data.data.companyName?.split(' ')[0]
      return symbol && /^[A-Z0-9&-]+$/i.test(symbol) ? symbol.toUpperCase() : null
    } catch {
      return null
    }
  }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let symbol = searchParams.get("symbol")
  const scripCode = searchParams.get("scripCode")
  const fromDate = searchParams.get("fromDate") // YYYY-MM-DD
  const toDate = searchParams.get("toDate") // YYYY-MM-DD

  if (!symbol && !scripCode) {
    return NextResponse.json({ error: "Missing symbol or scripCode" }, { status: 400 })
  }

    try {
      // If symbol is just a scrip code (numeric), try to resolve the actual trading symbol
      let resolvedSymbol = symbol
      if (scripCode && (!symbol || symbol === scripCode || /^\d+$/.test(symbol || ''))) {
        let bseSymbol: string | null = null
        bseSymbol = await resolveSymbolFromScripCode(scripCode)
        if (!bseSymbol) bseSymbol = await getSymbolFromPythonService(scripCode)
        
        if (bseSymbol) {
          resolvedSymbol = bseSymbol
          console.log(`[History] Resolved scripCode ${scripCode} to symbol ${bseSymbol}`)
        }
      }
      
      // Determine the Yahoo Finance ticker candidates
      // BSE stocks use .BO suffix. We prefer Symbol for Yahoo Finance.
      const tickers = []
      
      // Candidate 1: Resolved symbol for BSE (most reliable)
      if (resolvedSymbol && resolvedSymbol !== scripCode) {
        tickers.push(`${resolvedSymbol}.BO`)
      }
      
      // Candidate 2: Original symbol for BSE
      if (symbol && symbol !== resolvedSymbol && symbol !== scripCode) {
        tickers.push(`${symbol}.BO`)
      }
      
      // Candidate 3: Resolved symbol for NSE (often more reliable on Yahoo)
      if (resolvedSymbol && resolvedSymbol !== scripCode) {
        tickers.push(`${resolvedSymbol}.NS`)
      }
      
      // Candidate 4: Original symbol for NSE
      if (symbol && symbol !== resolvedSymbol) {
        tickers.push(`${symbol}.NS`)
      }
      
      // Candidate 5: Scrip Code for BSE (fallback - rarely works)
      if (scripCode) tickers.push(`${scripCode}.BO`)
      
      // Candidate 6: Scrip Code for NSE (rare but possible)
      if (scripCode) tickers.push(`${scripCode}.NS`)
      
      // Dedup tickers while maintaining order
      const uniqueTickers = [...new Set(tickers)]
      
      // Convert dates to Unix timestamps
      const startTs = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000)
      const endTs = toDate ? Math.floor(new Date(toDate).getTime() / 1000) : Math.floor(Date.now() / 1000)

      let resultData = null

      for (const ticker of uniqueTickers) {
          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTs}&period2=${endTs}&interval=1d&events=div%7Csplit`
          
          try {
              console.log(`[History] Fetching from Yahoo: ${yahooUrl}`)
              const response = await fetch(yahooUrl, {
                  headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
                  },
              })

                if (!response.ok) {
                    // Only log as warning if it's not a 404, as 404 is common for some ticker suffixes
                    if (response.status !== 404) {
                        console.warn(`Yahoo API error for ${ticker}: ${response.status}`)
                    }
                    continue
                }

              const data = await response.json()
              const result = data?.chart?.result?.[0]
              
              if (result && result.timestamp && result.indicators?.quote?.[0]) {
                  const q = result.indicators.quote[0]
                  // Verify we have actual data points
                  if (q.close && q.close.some((v: any) => v != null)) {
                    resultData = result
                    console.log(`[History] Successfully fetched data using ticker: ${ticker}`)
                    break 
                  }
              }
          } catch (e: any) {
              console.warn(`Fetch error for ${ticker}:`, e.message)
          }
      }
      
      if (!resultData) {
          return NextResponse.json({ 
              error: "No historical data found for this symbol on any exchange",
              tickers_tried: uniqueTickers 
          }, { status: 404 })
      }

      const timestamps = resultData.timestamp || []
      const indicators = resultData.indicators.quote[0]
      const { open, high, low, close, volume } = indicators

      // Format for Lightweight Charts
      const formattedData = timestamps.map((ts: number, i: number) => {
        // Skip points with missing prices
        if (close[i] == null) return null

        return {
          date: new Date(ts * 1000).toISOString(),
          open: open[i] ?? close[i],
          high: high[i] ?? close[i],
          low: low[i] ?? close[i],
          close: close[i],
          volume: volume[i] ?? 0,
        }
      }).filter((d: any) => d !== null)

      if (formattedData.length === 0) {
        return NextResponse.json({ 
            error: "Historical data was empty for this symbol",
            tickers_tried: uniqueTickers 
        }, { status: 404 })
      }

      return NextResponse.json({
          symbol,
          scripCode,
          data: formattedData
      })
    } catch (e: any) {
      metrics().recordError("BSEHistoryAPIError")
      console.error("BSE history API error:", e)
      return NextResponse.json({ error: `Failed to process historical data: ${e.message}` }, { status: 500 })
    }
}
