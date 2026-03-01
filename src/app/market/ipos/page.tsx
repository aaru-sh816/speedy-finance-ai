"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FeyNav } from "@/components/fey/FeyNav"
import { FileText, ArrowLeft } from "lucide-react"

export default function MarketIPOsPage() {
  const [current, setCurrent] = useState<unknown[]>([])
  const [upcoming, setUpcoming] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/nse/ipos")
      .then((res) => res.json())
      .then((data) => {
        setCurrent(Array.isArray(data?.current) ? data.current : [])
        setUpcoming(Array.isArray(data?.upcoming) ? data.upcoming : [])
        setError(data?.error ?? null)
        setSource(data?.source ?? null)
      })
      .catch((e) => {
        setError(e.message)
        setCurrent([])
        setUpcoming([])
      })
      .finally(() => setLoading(false))
  }, [])

  const renderIpoList = (list: unknown[]) => {
    const items = list as Array<Record<string, unknown>>
    const hasName = items.some((i) => typeof i.companyName === "string" || typeof i.symbol === "string" || typeof i.name === "string")
    if (hasName && items.length > 0) {
      return (
        <ul className="space-y-2" aria-label="IPO list">
          {items.map((item, idx) => {
            const name = (item.companyName ?? item.name ?? item.symbol ?? item.issueName ?? "—") as string
            const symbol = (item.symbol ?? item.tradingSymbol ?? "") as string
            const date = (item.openDate ?? item.closeDate ?? item.date ?? "") as string
            return (
              <li key={idx} className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-cyan-500/20 transition-colors">
                <div className="font-medium text-white">{name}</div>
                {(symbol || date) && (
                  <div className="text-xs text-zinc-500 mt-1">
                    {symbol && <span>{symbol}</span>}
                    {symbol && date && " · "}
                    {date && <span>{String(date)}</span>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )
    }
    return (
      <pre className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-xs overflow-auto max-h-80" role="region" aria-label="Raw IPO data">
        {JSON.stringify(list, null, 2)}
      </pre>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <FeyNav />
      <main className="max-w-4xl mx-auto px-6 pt-28 pb-12">
        <Link href="/market" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-medium mb-8 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Back to Market
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-cyan-500" aria-hidden />
          <h1 className="text-2xl font-bold">NSE IPOs</h1>
        </div>
        <p className="text-zinc-500 text-sm mb-4">
          Current and upcoming NSE IPOs. Source: {source ?? "nse-bse-api"}.
        </p>
        {loading && <p className="text-zinc-500" role="status">Loading...</p>}
        {error && <p className="text-rose-400" role="alert">{error}</p>}
        {!loading && !error && (
          <div className="space-y-8">
            <section aria-labelledby="current-ipos-heading">
              <h2 id="current-ipos-heading" className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Current</h2>
              {current.length === 0 ? (
                <p className="text-zinc-500">No current IPOs.</p>
              ) : (
                renderIpoList(current)
              )}
            </section>
            <section aria-labelledby="upcoming-ipos-heading">
              <h2 id="upcoming-ipos-heading" className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="text-zinc-500">No upcoming IPOs.</p>
              ) : (
                renderIpoList(upcoming)
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
