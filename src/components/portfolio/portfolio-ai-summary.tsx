"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2 } from "lucide-react"
import type { HoldingWithQuote } from "@/lib/portfolio/types"

interface PortfolioAISummaryProps {
  holdings: HoldingWithQuote[]
  metrics: { totalInvested: number; currentValue: number; pnlPercent: number; cagr?: number } | null
  risks: string[]
  loading: boolean
}

export function PortfolioAISummary({ holdings, metrics, risks, loading }: PortfolioAISummaryProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    if (holdings.length === 0 || !metrics) {
      setAiSummary(null)
      return
    }
    setAiLoading(true)
    setAiError(null)
    fetch("/api/ai/portfolio-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalInvested: metrics.totalInvested,
        currentValue: metrics.currentValue,
        pnlPercent: metrics.pnlPercent,
        cagr: metrics.cagr,
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          allocationPercent: h.allocationPercent,
          pnlPercent: h.pnlPercent,
        })),
        risks,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAiSummary(data.summary ?? null)
      })
      .catch((e) => {
        setAiError(e?.message ?? "Failed")
        setAiSummary(`You are ${(metrics.pnlPercent ?? 0) >= 0 ? "up" : "down"} ${Math.abs(metrics.pnlPercent ?? 0).toFixed(1)}% since inception, with ${holdings.length} holdings.`)
      })
      .finally(() => setAiLoading(false))
  }, [holdings, metrics, risks])

  const fallbackText =
    holdings.length > 0 && metrics
      ? `You are ${(metrics.pnlPercent ?? 0) >= 0 ? "up" : "down"} ${Math.abs(metrics.pnlPercent ?? 0).toFixed(1)}% since inception, with ${holdings.length} holdings.`
      : "Add holdings to get AI-powered insights."

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-6 bg-zinc-900/40 border border-zinc-800 flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
        {aiLoading ? (
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        ) : (
          <Sparkles className="w-6 h-6 text-cyan-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white mb-1">AI portfolio insights</h3>
        <p className="text-sm text-zinc-500">
          {aiLoading ? "Analyzing your portfolio..." : aiSummary ?? fallbackText}
        </p>
      </div>
    </motion.div>
  )
}
