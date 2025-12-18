"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import Link from "next/link"
import { FeyCard } from "./FeyCard"

interface MarketMover {
  securityID: string
  scripCode: string
  LTP: string
  change: string
  pChange: string
}

export function FeyMarketMovers() {
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
    <FeyCard className="relative">
      {/* Header */}
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

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <TabButton
          active={activeTab === "gainers"}
          onClick={() => handleTabChange("gainers")}
          icon={TrendingUp}
          label="Top Gainers"
          color="emerald"
        />
        <TabButton
          active={activeTab === "losers"}
          onClick={() => handleTabChange("losers")}
          icon={TrendingDown}
          label="Top Losers"
          color="rose"
        />
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-xs text-zinc-500 mb-4">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Content */}
      {loading && data.length === 0 ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={handleRefresh} />
      ) : (
        <div className="space-y-2">
          {data.slice(0, 10).map((item, index) => (
            <MoverCard
              key={item.scripCode}
              rank={index + 1}
              item={item}
              type={activeTab}
            />
          ))}
        </div>
      )}
    </FeyCard>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  color
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  color: "emerald" | "rose"
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 py-2.5 px-4 rounded-xl font-medium 
        transition-all duration-300 border
        ${active
          ? color === "emerald"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          : "bg-zinc-800/20 text-zinc-400 hover:bg-zinc-800/40 border-transparent"
        }
      `}
    >
      <div className="flex items-center justify-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
    </button>
  )
}

function MoverCard({
  rank,
  item,
  type
}: {
  rank: number
  item: MarketMover
  type: "gainers" | "losers"
}) {
  const isPositive = parseFloat(item.change) >= 0
  const colorClass = isPositive ? "text-emerald-400" : "text-rose-400"
  const bgClass = isPositive ? "bg-emerald-500/5" : "bg-rose-500/5"

  return (
    <Link href={`/company/${item.scripCode}`}>
      <div className={`
        ${bgClass} hover:bg-zinc-800/20 
        rounded-xl p-3 transition-all duration-200 
        border border-transparent hover:border-zinc-700/30
        group cursor-pointer
      `}>
        <div className="flex items-center justify-between">
          {/* Left: Rank + Company */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md">
              #{rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                {item.securityID}
              </p>
              <p className="text-xs text-zinc-500">{item.scripCode}</p>
            </div>
          </div>

          {/* Right: Price + Change */}
          <div className="text-right ml-3">
            <p className="text-sm font-bold text-white">
              ₹{parseFloat(item.LTP).toFixed(2)}
            </p>
            <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${colorClass}`}>
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{parseFloat(item.pChange).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-16 bg-zinc-800/20 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-rose-400 text-sm mb-2">⚠️ {error}</p>
      <button
        onClick={onRetry}
        className="text-xs text-zinc-400 hover:text-white underline"
      >
        Try again
      </button>
    </div>
  )
}
