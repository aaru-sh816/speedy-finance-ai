"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { FeyNav } from "@/components/fey/FeyNav"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { BarChart3, ArrowLeft } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { SkeletonLoader } from "@/components/skeleton-loader"
import { ErrorState } from "@/components/error-state"

type IndexRow = {
  name?: string
  currentValue?: string
  change?: string
  pChange?: string
  scripFlag?: string
}

type FinEdgeIndexRow = {
  index_name?: string
  index_symbol?: string
  close_price?: number
  change_pct?: number
  pe?: number
  pb?: number
  div_yield?: number
  volume?: number
}

type FinEdgePriceReturnsRow = {
  index_name?: string
  index_symbol?: string
  "1M"?: number
  "3M"?: number
  "6M"?: number
  "1Y"?: number
  "3Y"?: number
  "5Y"?: number
}

export default function IndicesPage() {
  const [indices, setIndices] = useState<IndexRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState("market_cap/broad")
  const [source, setSource] = useState<"bse" | "finedge">("bse")
  const [finedgeDaily, setFinedgeDaily] = useState<FinEdgeIndexRow[]>([])
  const [finedgeReturns, setFinedgeReturns] = useState<FinEdgePriceReturnsRow[]>([])

  const categories = [
    { value: "market_cap/broad", label: "Market cap / Broad" },
    { value: "sector_and_industry", label: "Sector & industry" },
    { value: "thematics", label: "Thematics" },
    { value: "strategy", label: "Strategy" },
    { value: "volatility", label: "Volatility" },
    { value: "composite", label: "Composite" },
  ]

  const refetch = useCallback(() => {
    if (source === "finedge") {
      setLoading(true)
      setError(null)
      fetchWithTimeout("/api/finedge/indices", { timeoutMs: 15000 })
        .then((res) => res.json())
        .then((data) => {
          setFinedgeDaily(data?.dailyFeed ?? [])
          setFinedgeReturns(data?.priceReturns ?? [])
          setIndices([])
          setError(data?.error ?? null)
        })
        .catch((e) => {
          setError(e.message)
          setFinedgeDaily([])
          setFinedgeReturns([])
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(true)
      setError(null)
      fetchWithTimeout(`/api/bse/indices?category=${encodeURIComponent(category)}`, { timeoutMs: 20000 })
        .then((res) => res.json())
        .then((data) => {
          const list = data?.data?.indices ?? data?.data
          setIndices(Array.isArray(list) ? list : [])
          setFinedgeDaily([])
          setFinedgeReturns([])
          setError(data?.error ?? null)
        })
        .catch((e) => {
          setError(e.message)
          setIndices([])
        })
        .finally(() => setLoading(false))
    }
  }, [category, source])

  useEffect(() => { refetch() }, [refetch])

  return (
    <div className="min-h-screen bg-black text-white">
      <FeyNav />
      <main className="max-w-4xl mx-auto px-6 pt-28 pb-12">
        <Link href="/market" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-medium mb-8 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Back to Market
        </Link>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-500" aria-hidden />
            <h1 className="text-2xl font-bold">Indices</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSource("bse")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                source === "bse"
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              BSE
            </button>
            <button
              onClick={() => setSource("finedge")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                source === "finedge"
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              FinEdge
            </button>
          </div>
        </div>
        {source === "bse" ? (
          <p className="text-zinc-500 text-sm mb-4">Key indices from BSE. Source: BSE / nse-bse-api.</p>
        ) : (
          <p className="text-zinc-500 text-sm mb-4">Key indices with P/E, P/B, dividend yield, and multi-period returns. Source: FinEdge.</p>
        )}
        {source === "bse" && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mb-6 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Index category"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        )}
        {loading && <div role="status" aria-label="Loading indices"><SkeletonLoader variant="list" rows={8} className="space-y-2" /></div>}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && source === "bse" && (
          indices.length === 0 ? (
            <p className="text-zinc-500">No indices for this category.</p>
          ) : (
            <ul className="space-y-2" aria-label="BSE indices list">
              {indices.map((row, i) => {
                const name = row.name ?? `Index ${i + 1}`
                const val = row.currentValue ?? ""
                const ch = row.change ?? ""
                const pCh = parseFloat(row.pChange ?? "0")
                const isUp = pCh >= 0
                return (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800"
                  >
                    <span className="font-medium text-white">{name}</span>
                    <div className="text-right">
                      <span className="text-white tabular-nums">{val}</span>
                      {(ch || row.pChange) && (
                        <span className={`ml-2 text-sm tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {isUp ? "+" : ""}{row.pChange ?? ch}%
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
        {!loading && !error && source === "finedge" && (
          finedgeDaily.length === 0 ? (
            <p className="text-zinc-500">No indices available.</p>
          ) : (
            <div className="space-y-6">
            {finedgeReturns.length > 0 && finedgeReturns.length <= 10 && (
              <div className="bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50">
                  <h2 className="text-sm font-black tracking-widest uppercase text-cyan-400">Index Returns Comparison</h2>
                </div>
                <div className="h-64 px-4 py-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={finedgeReturns.slice(0, 8).map((r) => ({
                        name: (r.index_name ?? r.index_symbol ?? "").slice(0, 14),
                        "1M": r["1M"] ?? 0,
                        "3M": r["3M"] ?? 0,
                        "6M": r["6M"] ?? 0,
                        "1Y": r["1Y"] ?? 0,
                        "5Y": r["5Y"] ?? 0,
                      }))}
                      margin={{ top: 4, right: 30, left: 0, bottom: 4 }}
                    >
                      <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} angle={-35} textAnchor="end" height={60} />
                      <YAxis stroke="#71717a" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
                        formatter={(value: number | undefined) => [value != null ? `${value.toFixed(1)}%` : "", ""]}
                      />
                      <Bar dataKey="1Y" fill="#22d3ee" radius={[4, 4, 0, 0]} name="1Y" />
                      <Bar dataKey="5Y" fill="#a78bfa" radius={[4, 4, 0, 0]} name="5Y" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <ul className="space-y-2" aria-label="FinEdge indices list">
              {finedgeDaily.map((row, i) => {
                const name = row.index_name ?? row.index_symbol ?? `Index ${i + 1}`
                const val = row.close_price ?? 0
                const pCh = row.change_pct ?? 0
                const isUp = pCh >= 0
                const returns = finedgeReturns.find((r) => r.index_symbol === row.index_symbol)
                return (
                  <li
                    key={`${name}-${i}`}
                    className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{name}</span>
                      <div className="text-right flex items-center gap-3">
                        <span className="text-white tabular-nums">{val.toLocaleString()}</span>
                        <span className={`text-sm tabular-nums font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {isUp ? "+" : ""}{pCh.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {row.pe != null && (
                        <span className="text-zinc-400">P/E: <span className="text-cyan-400 font-medium">{row.pe.toFixed(1)}</span></span>
                      )}
                      {row.pb != null && (
                        <span className="text-zinc-400">P/B: <span className="text-cyan-400 font-medium">{row.pb.toFixed(1)}</span></span>
                      )}
                      {row.div_yield != null && (
                        <span className="text-zinc-400">Div Yield: <span className="text-amber-400 font-medium">{row.div_yield.toFixed(1)}%</span></span>
                      )}
                      {returns && (
                        <>
                          {returns["1M"] != null && (
                            <span className="text-zinc-500">1M: <span className={returns["1M"] >= 0 ? "text-emerald-400" : "text-rose-400"}>{returns["1M"] >= 0 ? "+" : ""}{returns["1M"]?.toFixed(1)}%</span></span>
                          )}
                          {returns["1Y"] != null && (
                            <span className="text-zinc-500">1Y: <span className={returns["1Y"] >= 0 ? "text-emerald-400" : "text-rose-400"}>{returns["1Y"] >= 0 ? "+" : ""}{returns["1Y"]?.toFixed(1)}%</span></span>
                          )}
                          {returns["5Y"] != null && (
                            <span className="text-zinc-500">5Y: <span className={returns["5Y"] >= 0 ? "text-emerald-400" : "text-rose-400"}>{returns["5Y"] >= 0 ? "+" : ""}{returns["5Y"]?.toFixed(1)}%</span></span>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            </div>
          )
        )}
      </main>
    </div>
  )
}
