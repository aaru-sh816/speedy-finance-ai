"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react"

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
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight mb-1">Market movers</h1>
              <p className="text-zinc-400 text-sm">AI-powered daily recap of top gainers and decliners on BSE.</p>
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

          {/* Last Updated */}
          {mounted && lastUpdated && (
            <p className="text-xs text-zinc-500 mt-4">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}

          {/* Daily market recap */}
          <div className="glass-card rounded-2xl p-5 mt-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
              <span>Daily market recap</span>
              {mounted && lastUpdated && (
                <span>Generated at {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              )}
            </div>
            <p className="text-sm text-zinc-200 leading-relaxed">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayData.slice(0, 12).map((stock, index) => (
              <a
                key={stock.scripCode}
                href={`/company/${stock.scripCode}`}
                className="glass-card rounded-2xl p-6 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      activeTab === "gainers" 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/20 text-rose-400"
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {stock.scripName}
                      </h3>
                      <p className="text-xs text-zinc-500">{stock.scripCode}</p>
                    </div>
                  </div>
                  {activeTab === "gainers" ? (
                    <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-rose-400" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">₹{Number(stock.ltp || 0).toFixed(2)}</span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                      Number(stock.changePct || 0) >= 0 
                        ? "bg-emerald-500/10 text-emerald-400" 
                        : "bg-rose-500/10 text-rose-400"
                    }`}>
                      <span className="text-sm font-semibold">
                        {Number(stock.changePct || 0) >= 0 ? "+" : ""}{Number(stock.changePct || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm ${Number(stock.change || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {Number(stock.change || 0) >= 0 ? "+" : ""}₹{Number(stock.change || 0).toFixed(2)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
