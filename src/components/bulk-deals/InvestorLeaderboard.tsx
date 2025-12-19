"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  TrendingUp, TrendingDown, Users, Building2, Crown, 
  Trophy, Medal, Award, ChevronRight, Sparkles, 
  ArrowUpRight, ArrowDownRight, BarChart3, Target,
  Zap, Star, Flame, Brain, Bell
} from "lucide-react"
import { Sparkline, generateMockSparklineData } from "./Sparkline"
import { FollowButton } from "./FollowButton"
import { predictDealSuccess, getPredictionDisplay, type DealFeatures } from "@/lib/bulk-deals/aiPredictions"

type InvestorType = "all" | "individual" | "institutional"

interface Deal {
  currentPrice: number | null
  weekHigh52: number | null
  weekLow52: number | null
  weekHigh52Distance?: number
  weekLow52Distance?: number
  volumeSpike?: number
  side: string
  dealValue: number
}

interface Investor {
  name: string
  type: "individual" | "institutional" | "unknown"
  totalDeals: number
  buyDeals: number
  sellDeals: number
  totalValue: number
  buyValue: number
  sellValue: number
  winners: number
  losers: number
  winRate: number
  avgReturn: number
  totalPnL: number
  deals?: Deal[]
}

interface Props {
  investors: Investor[]
  loading?: boolean
  onRefresh?: () => void
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

const getRankBadge = (rank: number) => {
  if (rank === 1) return { icon: Crown, bg: "bg-gradient-to-br from-amber-400 to-orange-500", text: "text-black" }
  if (rank === 2) return { icon: Medal, bg: "bg-gradient-to-br from-slate-300 to-slate-400", text: "text-black" }
  if (rank === 3) return { icon: Award, bg: "bg-gradient-to-br from-amber-600 to-amber-700", text: "text-white" }
  return { icon: null, bg: "bg-zinc-700", text: "text-zinc-300" }
}

export function InvestorLeaderboard({ investors, loading, onRefresh }: Props) {
  const [activeType, setActiveType] = useState<InvestorType>("all")
  const [showAll, setShowAll] = useState(false)

  const filteredInvestors = investors.filter(inv => {
    if (activeType === "all") return true
    return inv.type === activeType
  })

  const displayInvestors = showAll ? filteredInvestors : filteredInvestors.slice(0, 10)

  const tabs: { type: InvestorType; label: string; icon: any; count: number }[] = [
    { type: "all", label: "All", icon: Users, count: investors.length },
    { type: "individual", label: "Individual", icon: Users, count: investors.filter(i => i.type === "individual").length },
    { type: "institutional", label: "Institutional", icon: Building2, count: investors.filter(i => i.type === "institutional").length },
  ]

  if (loading) {
    return (
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-5 rounded bg-zinc-700 animate-pulse" />
          <div className="h-5 w-32 rounded bg-zinc-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 sm:mb-8">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">Smart Money Tracker</h2>
          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-medium border border-cyan-500/20">
            <Sparkles className="h-3 w-3 mr-1" /> LIVE
          </span>
        </div>

        {/* Type Tabs - Scrollable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.type}
              onClick={() => setActiveType(tab.type)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                activeType === tab.type
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 text-white"
                  : "bg-zinc-800/50 border border-white/5 text-zinc-400 hover:text-white hover:border-white/20"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span className={clsx(
                "px-1.5 py-0.5 rounded-md text-[10px]",
                activeType === tab.type ? "bg-white/10" : "bg-zinc-700/50"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Investor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {displayInvestors.map((inv, i) => {
          const rank = i + 1
          const badge = getRankBadge(rank)
          const isPositive = inv.avgReturn > 0
          const hasGoodWinRate = inv.winRate >= 60

          return (
            <Link
              key={inv.name}
              href={`/bulk-deals/person/${encodeURIComponent(inv.name)}`}
              className={clsx(
                "group relative overflow-hidden rounded-xl p-4 transition-all duration-300",
                "bg-zinc-800/50 hover:bg-zinc-800 border hover:border-cyan-500/30",
                rank <= 3 ? "border-amber-500/20" : "border-white/5",
                "hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-0.5"
              )}
            >
              {/* Rank Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                  badge.bg, badge.text
                )}>
                  {badge.icon ? <badge.icon className="h-4 w-4" /> : rank}
                </div>
                
                {/* Type Badge */}
                <span className={clsx(
                  "px-2 py-0.5 rounded-md text-[10px] font-medium",
                  inv.type === "individual" 
                    ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                )}>
                  {inv.type === "individual" ? "👤" : "🏢"}
                </span>
              </div>

              {/* Investor Name */}
              <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors mb-2">
                {inv.name.split(' ').slice(0, 3).join(' ')}
              </h3>

              {/* Total Value + Sparkline */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg sm:text-xl font-bold text-white">
                  {rupeeCompact(inv.totalValue)}
                </div>
                <Sparkline 
                  data={generateMockSparklineData(100, 100 + inv.avgReturn, 8)} 
                  width={50} 
                  height={20} 
                />
              </div>

              {/* AI Prediction Badge */}
              {(() => {
                // Use the most recent deal or aggregate deal features
                const latestDeal = inv.deals && inv.deals.length > 0 
                  ? inv.deals.find(d => d.weekHigh52Distance !== undefined && d.weekLow52Distance !== undefined) || inv.deals[0]
                  : null
                
                const features: DealFeatures = {
                  investorType: inv.type,
                  investorHistoricalWinRate: inv.winRate,
                  investorAvgReturn: inv.avgReturn,
                  investorTotalDeals: inv.totalDeals,
                  side: inv.buyDeals > inv.sellDeals ? "BUY" : "SELL",
                  dealValue: inv.totalValue,
                  // Add real stock features from latest deal if available
                  ...(latestDeal && {
                    weekHigh52Distance: latestDeal.weekHigh52Distance,
                    weekLow52Distance: latestDeal.weekLow52Distance,
                    volumeSpike: latestDeal.volumeSpike,
                  })
                }
                
                const prediction = predictDealSuccess(features, inv.name)
                const display = getPredictionDisplay(prediction)
                return (
                  <div className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold mb-2",
                    display.bgColor, display.color
                  )}>
                    <Brain className="h-3 w-3" />
                    <span>AI: {prediction.score}%</span>
                    <span>{display.emoji}</span>
                  </div>
                )
              })()}

              {/* Performance Metrics */}
              <div className="space-y-1.5">
                {/* Return */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Return</span>
                  <span className={clsx(
                    "flex items-center gap-0.5 text-xs font-semibold",
                    isPositive ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPositive ? "+" : ""}{inv.avgReturn.toFixed(1)}%
                  </span>
                </div>

                {/* Win Rate */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Win Rate</span>
                  <div className="flex items-center gap-1">
                    {hasGoodWinRate && <Flame className="h-3 w-3 text-orange-400" />}
                    <span className={clsx(
                      "text-xs font-semibold",
                      hasGoodWinRate ? "text-emerald-400" : "text-zinc-400"
                    )}>
                      {inv.winRate.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* P&L */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">P&L</span>
                  <span className={clsx(
                    "text-xs font-semibold",
                    inv.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {inv.totalPnL >= 0 ? "+" : ""}{rupeeCompact(inv.totalPnL)}
                  </span>
                </div>
              </div>

              {/* Buy/Sell Split Bar */}
              <div className="mt-3 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-emerald-400">↑{inv.buyDeals}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${inv.totalDeals > 0 ? (inv.buyDeals / inv.totalDeals) * 100 : 50}%` }}
                    />
                  </div>
                  <span className="text-rose-400">↓{inv.sellDeals}</span>
                </div>
              </div>

              {/* Hover Arrow */}
              <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-4 w-4 text-cyan-400" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Show More Button */}
      {filteredInvestors.length > 10 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 rounded-xl bg-zinc-800/50 border border-white/10 hover:border-cyan-500/30 text-sm text-zinc-400 hover:text-white transition-all"
          >
            {showAll ? "Show Less" : `Show All ${filteredInvestors.length} Investors`}
          </button>
        </div>
      )}
    </div>
  )
}
