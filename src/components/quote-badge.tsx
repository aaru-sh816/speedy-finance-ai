"use client"

import { useEffect, useState } from "react"

type Quote = {
  symbol: string
  price: number | null
  change?: number | null
  changePercent?: number | null
  timestamp: string
}

export function QuoteBadge({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let active = true
    const ctrl = new AbortController()
    async function run() {
      try {
        setLoading(true)
        const res = await fetch(`/api/bse/quote?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store", signal: ctrl.signal })
        if (!active) return
        if (res.ok) {
          const data = await res.json()
          // Transform BSE response to Quote format
          setQuote({
            symbol: data.symbol,
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            timestamp: data.timestamp
          })
        } else {
          setQuote(null)
        }
      } catch {
        if (active) setQuote(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
      ctrl.abort()
    }
  }, [symbol])

  const cls = (q: Quote | null) => {
    const delta = q?.change ?? 0
    return delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-zinc-500"
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      {loading && <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />}
      {!loading && quote?.price != null ? (
        <>
          <span className="tabular-nums">{quote.price}</span>
          {typeof quote.changePercent === 'number' && (
            <span className={cls(quote)}>{quote.changePercent > 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%</span>
          )}
        </>
      ) : (
        !loading && <span className="text-zinc-400">—</span>
      )}
    </span>
  )
}
