import { getOrCreateCache } from "@/lib/infra/cache"
import { getOrCreateBucket } from "@/lib/infra/rateLimiter"
import { metrics } from "@/lib/infra/metrics"

export type Quote = {
  symbol: string
  price: number | null
  change?: number | null
  changePercent?: number | null
  volume?: number | null
  dayHigh?: number | null
  dayLow?: number | null
  marketCap?: number | null  // Added from speedywhatsapp.py
  open?: number | null
  previousClose?: number | null
  timestamp: string
  raw?: any
}

const QUOTES_TTL_MS = 45_000
const QUOTES_MAX_SIZE = 2000
const quoteCache = getOrCreateCache<string, Quote>("quotes", QUOTES_MAX_SIZE, QUOTES_TTL_MS)

export function getQuoteCacheStats() {
  return quoteCache.stats()
}

function jitter(ms: number) {
  const spread = ms * 0.2
  return ms + Math.random() * spread
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0
  let wait = 300
  // We use a global bucket per-host
  const host = process.env.RAPID_API_HOST || new URL(typeof input === "string" ? input : input.toString()).host
  const bucket = getOrCreateBucket(`host:${host}`, 50, 50) // 50 rps burst

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await bucket.consume(1)
    try {
      const start = performance.now?.() ?? Date.now()
      const res = await fetch(input, init)
      const end = performance.now?.() ?? Date.now()
      metrics().recordRequestSuccess(end - start)
      if (!res.ok && res.status >= 500 && attempt < retries) {
        attempt++
        await new Promise((r) => setTimeout(r, jitter(wait)))
        wait *= 2
        continue
      }
      if (!res.ok) {
        metrics().recordRequestFailure()
      }
      return res
    } catch (e) {
      metrics().recordError((e as Error).name || "FetchError")
      if (attempt >= retries) throw e
      attempt++
      await new Promise((r) => setTimeout(r, jitter(wait)))
      wait *= 2
    }
  }
}

function parseQuote(symbol: string, data: any): Quote {
  // Try several shapes safely - supports RapidAPI and other common formats
  const nowIso = new Date().toISOString()
  
  // Parse price - handle RapidAPI format
  const price =
    data?.lastPrice ??
    data?.price ??
    data?.data?.price ??
    data?.quote?.price ??
    data?.c ??
    null

  // Parse OHLC data
  const dayHigh = data?.ohlc?.high ?? data?.h ?? data?.dayHigh ?? null
  const dayLow = data?.ohlc?.low ?? data?.l ?? data?.dayLow ?? null
  const prevClose = data?.ohlc?.close ?? data?.previousClose ?? data?.close ?? null
  const open = data?.ohlc?.open ?? data?.open ?? null
  
  // Parse change - if not provided directly, calculate from price and prevClose
  let change = data?.change ?? data?.d ?? null
  let changePercent = data?.pChange ?? data?.dp ?? data?.changePercent ?? null
  
  // Calculate change percentage if we have price and prevClose but no changePercent
  if (price != null && prevClose != null && changePercent == null) {
    const priceNum = typeof price === "number" ? price : Number(price)
    const prevNum = typeof prevClose === "number" ? prevClose : Number(prevClose)
    if (prevNum > 0) {
      changePercent = ((priceNum - prevNum) / prevNum) * 100
      if (change == null) {
        change = priceNum - prevNum
      }
    }
  }
  
  const volume = data?.volumeTradedToday ?? data?.volume ?? data?.v ?? null

  return {
    symbol,
    price: typeof price === "number" ? price : (price != null ? Number(price) : null),
    change: typeof change === "number" ? change : (change != null ? Number(change) : null),
    changePercent: typeof changePercent === "number" ? Number(changePercent.toFixed(2)) : (changePercent != null ? Number(Number(changePercent).toFixed(2)) : null),
    volume: typeof volume === "number" ? volume : (volume != null ? Number(volume) : null),
    dayHigh: typeof dayHigh === "number" ? dayHigh : (dayHigh != null ? Number(dayHigh) : null),
    dayLow: typeof dayLow === "number" ? dayLow : (dayLow != null ? Number(dayLow) : null),
    timestamp: data?.timestamp ?? data?.lastTradedTime ?? nowIso,
    raw: data,
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const sym = (symbol || "").trim().toUpperCase()
  if (!sym) return null

  const cached = quoteCache.get(sym)
  if (cached) {
    metrics().recordCacheHit()
    return cached
  }
  metrics().recordCacheMiss()

  // Use BSE quote API endpoint instead of RapidAPI
  console.log(`[Quotes] Fetching quote for ${sym} from BSE service`)

  try {
    // Call our BSE quote API endpoint which uses the Python service
    const res = await fetch(`/api/bse/quote?symbol=${encodeURIComponent(sym)}`, {
      cache: "no-store",
    })

    if (!res.ok) {
      console.log(`[Quotes] BSE API returned ${res.status} for ${sym}`)
      metrics().recordError(`HTTP_${res.status}`)
      return null
    }

    const data = await res.json()
    
    if (data.error) {
      console.error(`[Quotes] BSE API error for ${sym}:`, data.error)
      metrics().recordError("APIError")
      return null
    }

    const q: Quote = {
      symbol: sym,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      dayHigh: data.dayHigh,
      dayLow: data.dayLow,
      marketCap: data.marketCap,
      open: data.open,
      previousClose: data.previousClose,
      timestamp: data.timestamp,
      raw: data.raw,
    }

    console.log(`[Quotes] ✅ Got quote for ${sym}: ₹${q.price} (${(q.changePercent ?? 0) >= 0 ? '+' : ''}${q.changePercent ?? 0}%)${q.marketCap ? ` MCap: ₹${q.marketCap}Cr` : ''}`)
    quoteCache.set(sym, q)
    return q
  } catch (e) {
    console.error(`[Quotes] Error fetching quote for ${sym}:`, e)
    metrics().recordError((e as Error).name || "FetchError")
    return null
  }
}
