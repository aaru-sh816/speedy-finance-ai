"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import Link from "next/link"

interface MarketMover {
  securityID: string
  scripCode: string
  LTP: string
  change: string
  pChange: string
}

export function MarketMovers() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers")
  const [data, setData] = useState<MarketMover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async (type: "gainers" | "losers") => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/bse/market-movers?type=${type}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        setLastUpdated(new Date())
      } else {
        setError(result.error || "Failed to fetch data")
      }
    } catch (err: any) {
      setError(err.message || "Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeTab)
    const interval = setInterval(() => fetchData(activeTab), 60000)
    return () => clearInterval(interval)
  }, [activeTab])

  const handleTabChange = (tab: "gainers" | "losers") => {
    setActiveTab(tab)
  }

  const handleRefresh = () => {
    fetchData(activeTab)
  }

  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Market Movers
        </h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 hover:bg-zinc-800/50 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTabChange("gainers")}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
            activeTab === "gainers"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Gainers
          </div>
        </button>
        <button
          onClick={() => handleTabChange("losers")}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
            activeTab === "losers"
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Top Losers
          </div>
        </button>
      </div>

      {lastUpdated && (
        <p className="text-xs text-zinc-500 mb-3">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {loading && data.length === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-zinc-800/30 rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-rose-400 text-sm mb-2">⚠️ {error}</p>
          <button
            onClick={handleRefresh}
            className="text-xs text-zinc-400 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 10).map((item, index) => {
            const isPositive = parseFloat(item.change) >= 0
            const changeColor = isPositive ? "text-emerald-400" : "text-rose-400"
            const bgColor = isPositive ? "bg-emerald-500/5" : "bg-rose-500/5"

            return (
              <Link
                key={item.scripCode}
                href={`/company/${item.scripCode}`}
                className={`block ${bgColor} hover:bg-zinc-800/30 rounded-lg p-3 transition-all border border-transparent hover:border-zinc-700/50`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <p className="text-sm font-semibold text-white truncate">
                        {item.securityID}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500">{item.scripCode}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold text-white">
                      ₹{parseFloat(item.LTP).toFixed(2)}
                    </p>
                    <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${changeColor}`}>
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {parseFloat(item.pChange).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
