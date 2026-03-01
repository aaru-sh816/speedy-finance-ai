import { NextRequest, NextResponse } from "next/server"
import {
  getBseQuoteFromApi,
  getBse52WeekFromApi,
  getBseMarketCapFromApi,
} from "@/lib/nse-bse/unified-market"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface QuoteResult {
  symbol: string
  price: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
  dayHigh: number | null
  dayLow: number | null
  marketCap: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  previousClose: number | null
  timestamp: string
  source: string
  error?: string
}

interface CacheEntry {
  data: QuoteResult
  expiry: number
}

// Persistent cache for quotes
const quoteCache = new Map<string, CacheEntry>()
// Map to track in-flight requests to prevent redundant fetches
const pendingRequests = new Map<string, Promise<QuoteResult>>()

const CACHE_TTL_MS = 60 * 1000
const MAX_CACHE_SIZE = 5000 // Increased size

function isBseScripCode(symbol: string): boolean {
  return /^\d{5,6}$/.test(symbol)
}

function parseNumber(val: any): number | null {
  if (val == null || val === '') return null
  if (typeof val === 'number') return isNaN(val) ? null : val
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  return null
}

function getCachedQuote(symbol: string): QuoteResult | null {
  const entry = quoteCache.get(symbol)
  if (entry && entry.expiry > Date.now()) {
    return entry.data
  }
  if (entry) {
    quoteCache.delete(symbol)
  }
  return null
}

function setCachedQuote(symbol: string, data: QuoteResult): void {
  // Simple LRU-ish eviction
  if (quoteCache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(quoteCache.keys())
    const toDelete = keys.slice(0, 100) // Delete 100 oldest entries
    toDelete.forEach(k => quoteCache.delete(k))
  }
  quoteCache.set(symbol, {
    data,
    expiry: Date.now() + CACHE_TTL_MS
  })
}

/**
 * Coalesced fetch: If multiple requests for the same symbol arrive simultaneously,
 * they will all wait for the same single fetch to complete.
 */
async function fetchSingleQuoteCoalesced(symbol: string): Promise<QuoteResult> {
  const cached = getCachedQuote(symbol)
  if (cached) return { ...cached, source: cached.source + '-cached' }

  // Check if there is already a fetch in progress for this symbol
  const pending = pendingRequests.get(symbol)
  if (pending) {
    const result = await pending
    return { ...result, source: result.source + '-coalesced' }
  }

  // No pending request, start a new one
  const fetchPromise = (async () => {
    try {
      const result = await fetchSingleQuote(symbol)
      return result
    } finally {
      // Clean up the pending map once done
      pendingRequests.delete(symbol)
    }
  })()

  pendingRequests.set(symbol, fetchPromise)
  return fetchPromise
}

async function fetchSingleQuote(symbol: string, timeout: number = 10000): Promise<QuoteResult> {
  const cached = getCachedQuote(symbol)
  if (cached) {
    return { ...cached, source: cached.source + '-cached' }
  }

  // BSE scrip codes: nse-bse-api with 52-week and marketCap from listSecurities
  if (isBseScripCode(symbol)) {
    const [bseQuote, week52, mcap] = await Promise.all([
      getBseQuoteFromApi(symbol),
      getBse52WeekFromApi(symbol),
      getBseMarketCapFromApi(symbol),
    ])
    if (bseQuote) {
      const result: QuoteResult = {
        symbol: bseQuote.symbol,
        price: bseQuote.price,
        change: bseQuote.change,
        changePercent: bseQuote.changePercent,
        volume: bseQuote.volume,
        dayHigh: bseQuote.dayHigh,
        dayLow: bseQuote.dayLow,
        marketCap: mcap ?? bseQuote.marketCap ?? null,
        fiftyTwoWeekHigh: week52?.fifty2WeekHigh ?? null,
        fiftyTwoWeekLow: week52?.fifty2WeekLow ?? null,
        previousClose: bseQuote.previousClose,
        timestamp: new Date().toISOString(),
        source: 'nse-bse-api',
      }
      setCachedQuote(symbol, result)
      return result
    }
    // Optional Python service
    try {
      const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
      const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          const data = json.data
          const result: QuoteResult = {
            symbol: symbol.toUpperCase(),
            price: parseNumber(data.currentValue ?? data.lastPrice ?? data.ltp ?? data.price),
            change: parseNumber(data.change),
            changePercent: parseNumber(data.pChange ?? data.percentChange),
            volume: parseNumber(data.totalTradedQuantity ?? data.volume ?? data.totalTradedVolume),
            dayHigh: parseNumber(data.dayHigh ?? data.high),
            dayLow: parseNumber(data.dayLow ?? data.low),
            marketCap: parseNumber(data.marketCapFull ?? data.marketCap ?? data.mktCap),
            fiftyTwoWeekHigh: parseNumber(data.weekHigh52 ?? data.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: parseNumber(data.weekLow52 ?? data.fiftyTwoWeekLow),
            previousClose: parseNumber(data.previousClose ?? data.prevClose),
            timestamp: new Date().toISOString(),
            source: 'bse-python',
          }
          setCachedQuote(symbol, result)
          return result
        }
      }
    } catch (_) {}
    return {
      symbol: symbol.toUpperCase(),
      price: null,
      change: null,
      changePercent: null,
      volume: null,
      dayHigh: null,
      dayLow: null,
      marketCap: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      previousClose: null,
      timestamp: new Date().toISOString(),
      source: 'error',
      error: 'Failed to fetch BSE quote',
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const bseServiceUrl = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
    const res = await fetch(`${bseServiceUrl}/api/quote/${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`BSE service returned ${res.status}`)
    }

    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || 'BSE quote response unsuccessful')
    }

    const data = json.data || {}
    const result: QuoteResult = {
      symbol: symbol.toUpperCase(),
      price: parseNumber(data.currentValue ?? data.lastPrice ?? data.ltp ?? data.price),
      change: parseNumber(data.change),
      changePercent: parseNumber(data.pChange ?? data.percentChange),
      volume: parseNumber(data.totalTradedQuantity ?? data.volumeTradedToday ?? data.volume ?? data.totalTradedVolume),
      dayHigh: parseNumber(data.dayHigh ?? data.high),
      dayLow: parseNumber(data.dayLow ?? data.low),
      marketCap: parseNumber(data.marketCapFull ?? data.marketCapFreeFloat ?? data.marketCap ?? data.mktCap),
      fiftyTwoWeekHigh: parseNumber(data.weekHigh52 ?? data.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: parseNumber(data.weekLow52 ?? data.fiftyTwoWeekLow),
      previousClose: parseNumber(data.previousClose ?? data.prevClose),
      timestamp: new Date().toISOString(),
      source: 'bse-python',
    }

    setCachedQuote(symbol, result)
    return result
  } catch (error: any) {
    clearTimeout(timeoutId)
    return {
      symbol: symbol.toUpperCase(),
      price: null,
      change: null,
      changePercent: null,
      volume: null,
      dayHigh: null,
      dayLow: null,
      marketCap: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      previousClose: null,
      timestamp: new Date().toISOString(),
      source: 'error',
      error: error.message || 'Failed to fetch quote',
    }
  }
}

async function fetchWithConcurrency<T>(
  items: string[],
  fetcher: (item: string) => Promise<T>,
  concurrency: number = 10
): Promise<T[]> {
  const results: T[] = []
  const queue = [...items]
  const inFlight: Promise<void>[] = []

  const processNext = async (): Promise<void> => {
    if (queue.length === 0) return
    
    const item = queue.shift()!
    try {
      const result = await fetcher(item)
      results.push(result)
    } catch (error) {
      results.push({ symbol: item, error: 'Failed' } as T)
    }
    
    await processNext()
  }

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    inFlight.push(processNext())
  }

  await Promise.all(inFlight)
  return results
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbolsParam = searchParams.get("symbols")

  if (!symbolsParam) {
    return NextResponse.json(
      { error: "symbols parameter is required (comma-separated)" },
      { status: 400 }
    )
  }

  const symbols = [...new Set(
    symbolsParam
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0)
  )]

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "No valid symbols provided" },
      { status: 400 }
    )
  }

  if (symbols.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 symbols allowed per request" },
      { status: 400 }
    )
  }

  const startTime = Date.now()

  const cachedResults: QuoteResult[] = []
  const uncachedSymbols: string[] = []

  for (const symbol of symbols) {
    const cached = getCachedQuote(symbol)
    if (cached) {
      cachedResults.push({ ...cached, source: cached.source + '-cached' })
    } else {
      uncachedSymbols.push(symbol)
    }
  }

  const fetchedResults = uncachedSymbols.length > 0
    ? await fetchWithConcurrency(uncachedSymbols, fetchSingleQuoteCoalesced, 10)
    : []

  const quotesMap = new Map<string, QuoteResult>()
  for (const result of [...cachedResults, ...fetchedResults]) {
    quotesMap.set(result.symbol, result)
  }

  const orderedResults = symbols.map(s => quotesMap.get(s.toUpperCase())!)

  const duration = Date.now() - startTime
  const cacheHits = cachedResults.length
  const cacheMisses = uncachedSymbols.length
  const errors = orderedResults.filter(r => r.error).length

  return NextResponse.json({
    quotes: orderedResults,
    meta: {
      total: symbols.length,
      cacheHits,
      cacheMisses,
      errors,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const symbols = body.symbols

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "symbols array is required in request body" },
        { status: 400 }
      )
    }

    const uniqueSymbols = [...new Set(symbols.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0))]

    if (uniqueSymbols.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 symbols allowed per request" },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    const cachedResults: QuoteResult[] = []
    const uncachedSymbols: string[] = []

    for (const symbol of uniqueSymbols) {
      const cached = getCachedQuote(symbol)
      if (cached) {
        cachedResults.push({ ...cached, source: cached.source + '-cached' })
      } else {
        uncachedSymbols.push(symbol)
      }
    }

    const fetchedResults = uncachedSymbols.length > 0
      ? await fetchWithConcurrency(uncachedSymbols, fetchSingleQuote, 10)
      : []

    const quotesMap = new Map<string, QuoteResult>()
    for (const result of [...cachedResults, ...fetchedResults]) {
      quotesMap.set(result.symbol, result)
    }

    const orderedResults = uniqueSymbols.map(s => quotesMap.get(s.toUpperCase())!)

    const duration = Date.now() - startTime

    return NextResponse.json({
      quotes: orderedResults,
      meta: {
        total: uniqueSymbols.length,
        cacheHits: cachedResults.length,
        cacheMisses: uncachedSymbols.length,
        errors: orderedResults.filter(r => r.error).length,
        durationMs: duration,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Invalid request body", message: error.message },
      { status: 400 }
    )
  }
}
