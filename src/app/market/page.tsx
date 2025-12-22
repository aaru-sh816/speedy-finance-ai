"use client"

import { useEffect, useState } from "react"
import { clsx } from "clsx"
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, LayoutGrid, Zap } from "lucide-react"
import { PulseFeed } from "@/components/pulse-feed"
import { RiskRadar } from "@/components/risk-radar"

type Stock = {
  scripCode: string
  scripName: string
  ltp: number
  change: number
  changePct: number
}

function buildMarketRecap(gainers: Stock[], losers: Stock[]): string {
  if (!gainers.length && !losers.length) {
    return "As soon as live data loads, Speedy AI will highlight what moved the market today."
  }

  const topGainer = gainers[0]
  const topLoser = losers[0]

  if (topGainer && topLoser) {
    const gDir = topGainer.changePct >= 0 ? "up" : "down"
    const lDir = topLoser.changePct >= 0 ? "up" : "down"
    return `Today's action is led by ${topGainer.scripName} (₹${topGainer.ltp.toFixed(2)}, ${gDir} ${Math.abs(topGainer.changePct).toFixed(2)}%), while ${topLoser.scripName} is among the biggest ${lDir === "down" ? "decliners" : "movers"} (${lDir} ${Math.abs(topLoser.changePct).toFixed(2)}%). Speedy AI refreshes this view every minute so you always see what's moving first.`
  }

  if (topGainer) {
    const dir = topGainer.changePct >= 0 ? "up" : "down"
    return `${topGainer.scripName} leads today's movers at ₹${topGainer.ltp.toFixed(2)}, ${dir} ${Math.abs(topGainer.changePct).toFixed(2)}%.`
  }

  if (topLoser) {
    const dir = topLoser.changePct >= 0 ? "up" : "down"
    return `${topLoser.scripName} stands out among today's movers (${dir} ${Math.abs(topLoser.changePct).toFixed(2)}%).`
  }

  return "Live market recap will appear here once movers are available."
}

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers")
  const [gainers, setGainers] = useState<Stock[]>([])
  const [losers, setLosers] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchMarketMovers = async () => {
    setLoading(true)
    try {
      const [gainersRes, losersRes] = await Promise.all([
        fetch('/api/bse/market-movers?type=gainers'),
        fetch('/api/bse/market-movers?type=losers')
      ])
      const gainersData = await gainersRes.json()
      const losersData = await losersRes.json()

      const toStocks = (rows: any[] | undefined | null): Stock[] => {
        if (!Array.isArray(rows)) return []
        return rows.map((row: any) => ({
          scripCode: row.scripCode || row.securityID || "",
          scripName: row.securityID || row.scripCode || "",
          ltp: Number(row.LTP ?? row.ltp ?? 0),
          change: Number(row.change ?? 0),
          changePct: Number(row.pChange ?? row.changePct ?? 0),
        }))
      }

      setGainers(toStocks(gainersData.data))
      setLosers(toStocks(losersData.data))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch market movers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchMarketMovers()
    const interval = setInterval(fetchMarketMovers, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const displayData = activeTab === "gainers" ? gainers : losers

    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12">
        <div className="max-w-[1500px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Column */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                      Market Intelligence
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold tracking-widest uppercase">Live</span>
                    </h1>
                    <p className="text-zinc-400 text-sm">AI-powered daily recap of movers and high-impact disclosures.</p>
                  </div>
                  <button
                    onClick={fetchMarketMovers}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-sm">Refresh</span>
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveTab("gainers")}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      activeTab === "gainers"
                        ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>Top Gainers</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab("losers")}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      activeTab === "losers"
                        ? "bg-gradient-to-r from-rose-500/20 to-rose-500/10 border border-rose-500/30 text-rose-400"
                        : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      <span>Top Losers</span>
                    </div>
                  </button>
                </div>

                {/* Daily market recap */}
                <div className="glass-card rounded-2xl p-5 mt-2 bg-gradient-to-br from-zinc-900/40 to-black/40 border border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-3">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-3 w-3" />
                      <span>Daily market recap</span>
                    </div>
                    {mounted && lastUpdated && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
                        Generated at {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                    {buildMarketRecap(gainers, losers)}
                  </p>
                </div>
              </div>

              {/* Stocks Grid */}
              {loading && displayData.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayData.slice(0, 10).map((stock, index) => (
                    <a
                      key={stock.scripCode}
                      href={`/company/${stock.scripCode}`}
                      className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/5 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            activeTab === "gainers" 
                              ? "bg-emerald-500/20 text-emerald-400" 
                              : "bg-rose-500/20 text-rose-400"
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                              {stock.scripName}
                            </h3>
                            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">{stock.scripCode}</p>
                          </div>
                        </div>
                        {activeTab === "gainers" ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                            <ArrowDownRight className="h-4 w-4 text-rose-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between mt-auto">
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">LTP</span>
                          <span className="text-3xl font-bold text-white tracking-tighter">₹{Number(stock.ltp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-right">
                          <div className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold",
                            Number(stock.changePct || 0) >= 0 
                              ? "bg-emerald-500/20 text-emerald-400" 
                              : "bg-rose-500/20 text-rose-400"
                          )}>
                            {Number(stock.changePct || 0) >= 0 ? "+" : ""}{Number(stock.changePct || 0).toFixed(2)}%
                          </div>
                          <div className={`text-[10px] font-bold mt-1 ${Number(stock.change || 0) >= 0 ? "text-emerald-500/60" : "text-rose-500/60"}`}>
                            {Number(stock.change || 0) >= 0 ? "+" : ""}₹{Number(stock.change || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Side Column */}
            <div className="lg:w-[400px] flex-shrink-0 space-y-6">
              <PulseFeed />
              <RiskRadar />
            </div>
          </div>
        </div>
      </div>
    )
}
