"use client"

import { useState, useEffect, useCallback } from "react"
import { PortfolioAISummary } from "./portfolio-ai-summary"
import { motion } from "framer-motion"
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  AlertTriangle,
  Plus,
  RefreshCw,
  ChevronRight,
  IndianRupee,
} from "lucide-react"
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip } from "recharts"

const CHART_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#38bdf8", "#c084fc", "#4ade80"]
import Link from "next/link"
import {
  getPortfolio,
  getHoldings,
  addHoldingAsManual,
} from "@/lib/portfolio"
import {
  computePortfolioMetrics,
  enrichHoldingsWithQuotes,
  getConcentrationRisks,
} from "@/lib/portfolio/compute"
import type { HoldingWithQuote } from "@/lib/portfolio/types"

export function PortfolioDashboard() {
  const [holdings, setHoldings] = useState<HoldingWithQuote[]>([])
  const [metrics, setMetrics] = useState<{ totalInvested: number; currentValue: number; pnl: number; pnlPercent: number; cagr?: number } | null>(null)
  const [risks, setRisks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const portfolio = getPortfolio()
  const rawHoldings = getHoldings()

  const fetchQuotes = useCallback(async () => {
    if (rawHoldings.length === 0) {
      setHoldings([])
      setMetrics(null)
      setRisks([])
      setLoading(false)
      return
    }
    try {
      const scripCodes = rawHoldings.map((h) => h.scripCode).filter(Boolean)
      const res = await fetch(`/api/bse/quotes/bulk?symbols=${scripCodes.join(",")}`, { cache: "no-store" })
      const data = await res.json()
      const quotes: Record<string, { price: number }> = {}
      for (const q of data.quotes ?? []) {
        if (q.symbol && q.price != null) quotes[q.symbol] = { price: q.price }
      }
      const enriched = enrichHoldingsWithQuotes(rawHoldings, quotes)
      const m = computePortfolioMetrics(rawHoldings, quotes)
      const r = getConcentrationRisks(enriched)
      setHoldings(enriched)
      setMetrics(m)
      setRisks(r)
    } catch {
      const enriched = enrichHoldingsWithQuotes(rawHoldings, {})
      const m = computePortfolioMetrics(rawHoldings, {})
      setHoldings(enriched)
      setMetrics(m)
      setRisks([])
    } finally {
      setLoading(false)
    }
  }, [rawHoldings])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 border border-zinc-800"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{portfolio?.name ?? "My Portfolio"}</h1>
            <p className="text-zinc-500 text-sm">Total portfolio value</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-white">
                <IndianRupee className="inline w-6 h-6" />
                {metrics?.currentValue != null ? metrics.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}
              </p>
              <p className="text-sm text-zinc-500">
                Invested: ₹{metrics?.totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${(metrics?.pnl ?? 0) >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {(metrics?.pnl ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="font-semibold">
                {metrics?.pnlPercent != null ? `${metrics.pnlPercent >= 0 ? "+" : ""}${metrics.pnlPercent.toFixed(2)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
        {metrics?.cagr != null && metrics.cagr !== 0 && (
          <p className="mt-4 text-sm text-zinc-500">
            CAGR: <span className={metrics.cagr >= 0 ? "text-emerald-400" : "text-rose-400"}>{metrics.cagr.toFixed(1)}%</span>
          </p>
        )}
      </motion.div>

      {/* Allocation pie chart */}
      {holdings.length > 0 && (() => {
        const pieData = holdings.map((h, i) => ({
          name: h.symbol ?? h.scripCode ?? `Holding ${i + 1}`,
          value: h.allocationPercent ?? 0,
        })).filter((d) => d.value > 0)
        if (pieData.length === 0) return null
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl p-4 border border-zinc-800 bg-zinc-900/40"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white">Allocation</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
                    formatter={(value: number | undefined) => [value != null ? `${value.toFixed(1)}%` : "", "Allocation"]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )
      })()}

      {/* Risk cards */}
      {risks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-amber-400">Concentration risks</h3>
          </div>
          <ul className="space-y-1 text-sm text-amber-300/90">
            {risks.slice(0, 5).map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Holdings table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white">Holdings</h2>
          <a
            href="/portfolio#add"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <Plus className="w-4 h-4" /> Add holding
          </a>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                <th className="px-4 py-3 font-medium sticky left-0 bg-zinc-900/95 backdrop-blur z-10">Symbol</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Avg</th>
                <th className="px-4 py-3 font-medium">LTP</th>
                <th className="px-4 py-3 font-medium text-right">P&L</th>
                <th className="px-4 py-3 font-medium text-right">Allocation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.scripCode} className="border-b border-zinc-800/80 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 sticky left-0 bg-zinc-900/95 backdrop-blur z-10">
                    <Link href={`/company/${h.scripCode}`} className="font-medium text-white hover:text-cyan-400">
                      {h.symbol}
                    </Link>
                    <p className="text-xs text-zinc-500 truncate max-w-[140px]">{h.name}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{h.quantity}</td>
                  <td className="px-4 py-3 text-zinc-300">₹{h.avgPrice.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-zinc-300">₹{h.ltp != null ? h.ltp.toLocaleString("en-IN") : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {h.pnl >= 0 ? "+" : ""}₹{h.pnl.toLocaleString("en-IN")} ({h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{h.allocationPercent.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <Link href={`/company/${h.scripCode}`} className="text-cyan-400 hover:text-cyan-300">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* AI summary */}
      <PortfolioAISummary
        holdings={holdings}
        metrics={metrics}
        risks={risks}
        loading={loading}
      />
    </div>
  )
}
