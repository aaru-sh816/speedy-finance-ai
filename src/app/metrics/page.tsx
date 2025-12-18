"use client"

import { useEffect, useState } from "react"

type Metrics = {
  metrics: {
    cacheHits: number
    cacheMisses: number
    requestSuccesses: number
    requestFailures: number
    averageBatchSize: number
    averageResponseTime: number
    cacheHitRate: number
    successRate: number
    requestsPerSecond: number
    errorTypes: Record<string, number>
  }
  quoteCache: { size: number; hits: number; misses: number; evictions: number }
}

export default function MetricsPage() {
  const [data, setData] = useState<Metrics | null>(null)

  useEffect(() => {
    let active = true
    const tick = async () => {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" })
        if (!active) return
        if (res.ok) setData(await res.json())
      } catch {}
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">System Metrics</h1>
      {!data && (
        <p className="mt-3 text-sm text-zinc-500">Loading metrics…</p>
      )}
      {data && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-5 bg-gradient-to-b from-transparent to-foreground/[0.03]">
            <p className="text-xs text-zinc-500">Cache Hit Rate</p>
            <p className="mt-2 text-3xl font-semibold">{Math.round(data.metrics.cacheHitRate*100)}%</p>
            <p className="text-xs text-zinc-500">Hits {data.metrics.cacheHits} / Misses {data.metrics.cacheMisses}</p>
          </div>
          <div className="rounded-2xl border p-5 bg-gradient-to-b from-transparent to-foreground/[0.03]">
            <p className="text-xs text-zinc-500">Success Rate</p>
            <p className="mt-2 text-3xl font-semibold">{Math.round(data.metrics.successRate*100)}%</p>
            <p className="text-xs text-zinc-500">Req/s {data.metrics.requestsPerSecond.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border p-5 bg-gradient-to-b from-transparent to-foreground/[0.03]">
            <p className="text-xs text-zinc-500">Avg Response</p>
            <p className="mt-2 text-3xl font-semibold">{data.metrics.averageResponseTime.toFixed(0)} ms</p>
            <p className="text-xs text-zinc-500">Avg Batch {data.metrics.averageBatchSize.toFixed(1)}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-5">
            <p className="text-sm font-medium">Quote Cache</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>Size</div><div className="text-right tabular-nums">{data.quoteCache.size}</div>
              <div>Hits</div><div className="text-right tabular-nums">{data.quoteCache.hits}</div>
              <div>Misses</div><div className="text-right tabular-nums">{data.quoteCache.misses}</div>
              <div>Evictions</div><div className="text-right tabular-nums">{data.quoteCache.evictions}</div>
            </div>
          </div>
          <div className="rounded-2xl border p-5">
            <p className="text-sm font-medium">Error Types</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {Object.keys(data.metrics.errorTypes).length === 0 && (
                <li className="text-zinc-500">None</li>
              )}
              {Object.entries(data.metrics.errorTypes).map(([k,v]) => (
                <li key={k} className="flex items-center justify-between"><span>{k}</span><span className="tabular-nums">{v}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-10 text-xs text-zinc-500">Updates every 3s</p>
    </main>
  )
}
