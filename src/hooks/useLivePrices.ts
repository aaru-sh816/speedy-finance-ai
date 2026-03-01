'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface LivePrice {
  price: number
  change: number | null
  changePercent: number | null
}

// Module-level cache so it's shared across all hook instances
const priceCache = new Map<string, { data: LivePrice; expiry: number }>()
const CACHE_TTL = 60_000 // 1 minute

export function useLivePrices(scripCodes: string[]) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({})
  const fetchingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPrices = useCallback(async (codes: string[]) => {
    if (fetchingRef.current || codes.length === 0) return
    fetchingRef.current = true

    try {
      const now = Date.now()
      const cached: Record<string, LivePrice> = {}
      const toFetch: string[] = []

      for (const code of codes) {
        const entry = priceCache.get(code)
        if (entry && entry.expiry > now) {
          cached[code] = entry.data
        } else {
          toFetch.push(code)
        }
      }

      if (toFetch.length > 0) {
        const res = await fetch('/api/bse/quotes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: toFetch }),
        })

        if (res.ok) {
          const data = await res.json()
          const quotes = data.quotes || data.results || data || []
          for (const q of quotes) {
            const code = q.symbol || q.scripCode
            if (code && q.price != null) {
              const livePrice: LivePrice = {
                price: q.price,
                change: q.change ?? null,
                changePercent: q.changePercent ?? null,
              }
              priceCache.set(code, { data: livePrice, expiry: now + CACHE_TTL })
              cached[code] = livePrice
            }
          }
        }
      }

      setPrices(cached)
    } catch {
      // Silent fail - prices are best-effort
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    const uniqueCodes = [...new Set(scripCodes.filter(Boolean))]
    if (uniqueCodes.length === 0) return

    fetchPrices(uniqueCodes)

    intervalRef.current = setInterval(() => {
      fetchPrices(uniqueCodes)
    }, 60_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [scripCodes.join(','), fetchPrices])

  return prices
}

/**
 * Compute P&L from entry price to current price
 */
export function computePnL(entryPrice: number | undefined, currentPrice: number | undefined): {
  pnl: number
  pnlPercent: number
  isPositive: boolean
} | null {
  if (!entryPrice || !currentPrice || entryPrice <= 0) return null
  const pnl = currentPrice - entryPrice
  const pnlPercent = (pnl / entryPrice) * 100
  return { pnl, pnlPercent, isPositive: pnl >= 0 }
}
