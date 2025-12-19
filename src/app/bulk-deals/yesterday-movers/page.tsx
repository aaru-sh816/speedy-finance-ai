"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Activity,
  AlertCircle, Clock, Filter, Search, X, Zap
} from "lucide-react"
import { SidebarNav } from "@/components/sidebar-nav"

interface YesterdayDeal {
  date: string
  scripCode: string
  securityName: string
  clientName: string
  side: string
  quantity: number
  dealPrice: number
  exchange: string
  baselineClose: number | null
  currentPrice: number | null
  changeFromBaseline: number | null
  changePct: number | null
  volume: string | null
  dayHigh: number | null
  dayLow: number | null
}

interface Summary {
  totalDeals: number
  dealsWithQuotes: number
  moversUp: number
  moversDown: number
  avgChange: number
  topGainer: {
    scripCode: string
    securityName: string
    changePct: number
    changeFromBaseline: number
  } | null
  topLoser: {
    scripCode: string
    securityName: string
    changePct: number
    changeFromBaseline: number
  } | null
}

const formatNumber = (num: number | null) => {
  if (num === null) return "—"
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

const formatCurrency = (num: number | null) => {
  if (num === null) return "—"
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

export default function YesterdayMoversPage() {
  const [deals, setDeals] = useState<YesterdayDeal[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMarketHours, setIsMarketHours] = useState(false)
  const [yesterdayDate, setYesterdayDate] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  
  // Filters
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL")
  const [moveFilter, setMoveFilter] = useState<"ALL" | "UP" | "DOWN">("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/bulk-deals/yesterday-movers")
      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals || [])
        setSummary(data.summary)
        setIsMarketHours(data.isMarketHours)
        setYesterdayDate(data.yesterdayDate)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error("Failed to fetch yesterday's movers:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh || !isMarketHours) return
    
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [autoRefresh, isMarketHours, fetchData])

  const filteredDeals = deals.filter(deal => {
    if (sideFilter !== "ALL" && deal.side !== sideFilter) return false
    if (moveFilter === "UP" && (deal.changePct === null || deal.changePct <= 0)) return false
    if (moveFilter === "DOWN" && (deal.changePct === null || deal.changePct >= 0)) return false
    if (searchQuery && !deal.securityName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !deal.clientName.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <SidebarNav />
      
      <div className="pl-0 md:pl-20">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/bulk-deals">
                  <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                    <ArrowLeft className="h-4 w-4 text-zinc-400" />
                  </button>
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Yesterday's Bulk Deal Movers
                </h1>
              </div>
              <p className="text-sm text-zinc-500 ml-14">
                {yesterdayDate && `Deals from ${new Date(yesterdayDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {isMarketHours && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">Market Open</span>
                </div>
              )}
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg border transition-all ${
                  autoRefresh && isMarketHours
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                }`}
                title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              >
                <Zap className={`h-4 w-4 ${autoRefresh && isMarketHours ? "" : "opacity-50"}`} />
              </button>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs text-zinc-500">Total Deals</span>
                </div>
                <p className="text-2xl font-bold text-white">{summary.totalDeals}</p>
                <p className="text-xs text-zinc-500 mt-1">{summary.dealsWithQuotes} with quotes</p>
              </div>

              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-zinc-500">Movers Up</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{summary.moversUp}</p>
                {summary.topGainer && (
                  <p className="text-xs text-emerald-400/80 mt-1">
                    Top: +{summary.topGainer.changePct.toFixed(2)}%
                  </p>
                )}
              </div>

              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  <span className="text-xs text-zinc-500">Movers Down</span>
                </div>
                <p className="text-2xl font-bold text-rose-400">{summary.moversDown}</p>
                {summary.topLoser && (
                  <p className="text-xs text-rose-400/80 mt-1">
                    Top: {summary.topLoser.changePct.toFixed(2)}%
                  </p>
                )}
              </div>

              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-zinc-500">Avg Change</span>
                </div>
                <p className={`text-2xl font-bold ${summary.avgChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {summary.avgChange >= 0 ? "+" : ""}{summary.avgChange.toFixed(2)}%
                </p>
                {lastRefresh && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="glass-card rounded-xl p-4 mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by stock or investor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-zinc-500 hover:text-white" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <select
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="ALL">All Sides</option>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>

                <select
                  value={moveFilter}
                  onChange={(e) => setMoveFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="ALL">All Moves</option>
                  <option value="UP">↑ Up</option>
                  <option value="DOWN">↓ Down</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Filter className="h-3 w-3" />
              <span>Showing {filteredDeals.length} of {deals.length} deals</span>
            </div>
          </div>

          {/* Deals Table */}
          {loading ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-zinc-500">Loading yesterday's movers...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <AlertCircle className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-zinc-500">No deals match your filters</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Investor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400">Side</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Deal Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Baseline</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Current</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Change</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDeals.map((deal, idx) => (
                      <tr key={`${deal.scripCode}-${idx}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/company/${deal.scripCode}`}>
                            <div className="text-sm font-medium text-white hover:text-cyan-400 transition-colors">
                              {deal.securityName}
                            </div>
                            <div className="text-xs text-zinc-500">{deal.scripCode}</div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-zinc-300 max-w-[200px] truncate" title={deal.clientName}>
                            {deal.clientName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            deal.side === "BUY" 
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}>
                            {deal.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {formatCurrency(deal.dealPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {formatCurrency(deal.baselineClose)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-white font-medium">
                          {formatCurrency(deal.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {deal.changePct !== null ? (
                            <div className="flex flex-col items-end">
                              <span className={`text-sm font-bold ${
                                deal.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {deal.changePct >= 0 ? "+" : ""}{deal.changePct.toFixed(2)}%
                              </span>
                              <span className={`text-xs ${
                                deal.changePct >= 0 ? "text-emerald-400/70" : "text-rose-400/70"
                              }`}>
                                {deal.changeFromBaseline !== null && (deal.changeFromBaseline >= 0 ? "+" : "")}
                                {formatNumber(deal.changeFromBaseline)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-zinc-500">
                          {deal.volume || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
