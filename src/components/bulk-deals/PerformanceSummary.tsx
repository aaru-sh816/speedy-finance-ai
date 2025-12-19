"use client"

import { TrendingUp, TrendingDown, Target, Trophy, Users, Building2, Zap, BarChart3 } from "lucide-react"

interface Summary {
  totalDeals: number
  totalValue: number
  dealsWithQuotes: number
  winners: number
  losers: number
  avgReturn: number
  totalPnL: number
  individualInvestors: number
  institutionalInvestors: number
}

interface Props {
  summary: Summary | null
  loading?: boolean
}

function rupeeCompact(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "-"
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

function clsx(...v: (string | false | undefined)[]) { 
  return v.filter(Boolean).join(" ") 
}

export function PerformanceSummary({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    )
  }

  const winRate = summary.winners + summary.losers > 0 
    ? (summary.winners / (summary.winners + summary.losers)) * 100 
    : 0

  const cards = [
    {
      label: "Total Deals",
      value: summary.totalDeals.toLocaleString(),
      subValue: `${summary.dealsWithQuotes} with quotes`,
      icon: BarChart3,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20"
    },
    {
      label: "Total Value",
      value: rupeeCompact(summary.totalValue),
      subValue: "Deal volume",
      icon: Target,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      label: "Avg Return",
      value: `${summary.avgReturn >= 0 ? "+" : ""}${summary.avgReturn.toFixed(2)}%`,
      subValue: "Since deal date",
      icon: summary.avgReturn >= 0 ? TrendingUp : TrendingDown,
      color: summary.avgReturn >= 0 ? "text-emerald-400" : "text-rose-400",
      bg: summary.avgReturn >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
      border: summary.avgReturn >= 0 ? "border-emerald-500/20" : "border-rose-500/20"
    },
    {
      label: "Total P&L",
      value: `${summary.totalPnL >= 0 ? "+" : ""}${rupeeCompact(summary.totalPnL)}`,
      subValue: "Unrealized",
      icon: Zap,
      color: summary.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400",
      bg: summary.totalPnL >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
      border: summary.totalPnL >= 0 ? "border-emerald-500/20" : "border-rose-500/20"
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      subValue: `${summary.winners}W / ${summary.losers}L`,
      icon: Trophy,
      color: winRate >= 50 ? "text-amber-400" : "text-zinc-400",
      bg: winRate >= 50 ? "bg-amber-500/10" : "bg-zinc-500/10",
      border: winRate >= 50 ? "border-amber-500/20" : "border-zinc-500/20"
    },
    {
      label: "Investors",
      value: (summary.individualInvestors + summary.institutionalInvestors).toString(),
      subValue: `👤${summary.individualInvestors} 🏢${summary.institutionalInvestors}`,
      icon: Users,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20"
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, i) => (
        <div 
          key={i}
          className={clsx(
            "rounded-xl p-4 border transition-all hover:scale-[1.02]",
            card.bg, card.border
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={clsx("h-4 w-4", card.color)} />
            <span className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">{card.label}</span>
          </div>
          <div className={clsx("text-lg sm:text-xl font-bold", card.color)}>{card.value}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{card.subValue}</div>
        </div>
      ))}
    </div>
  )
}
