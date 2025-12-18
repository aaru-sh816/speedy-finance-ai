"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity } from "lucide-react"
import { FeyCard } from "./FeyCard"

function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = Number(
    typeof value === "string" ? value.replace(/,/g, "").trim() : value
  )
  return Number.isFinite(n) ? n : fallback
}

interface EnhancedQuote {
  companyName: string
  scripCode: string
  currentValue: number
  change: number
  pChange: number
  dayHigh: number
  dayLow: number
  weekHigh52: number
  weekLow52: number
  marketCapFull: string
  marketCapFreeFloat: string
  totalTradedValue: string
  totalTradedQuantity: string
  weightedAvgPrice: number
  previousClose: number
  industry: string
  group: string
}

interface FeyEnhancedQuoteProps {
  scripCode: string
}

export function FeyEnhancedQuote({ scripCode }: FeyEnhancedQuoteProps) {
  const [quote, setQuote] = useState<EnhancedQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuote()
    const interval = setInterval(fetchQuote, 30000)
    return () => clearInterval(interval)
  }, [scripCode])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/bse/enhanced-quote?scripCode=${scripCode}`)
      const result = await response.json()

      if (result.success && result.data) {
        const raw = result.data
        const normalized: EnhancedQuote = {
          companyName: raw.companyName || "",
          scripCode: raw.scripCode || scripCode,
          currentValue: toNumber(raw.currentValue),
          change: toNumber(raw.change),
          pChange: toNumber(raw.pChange),
          dayHigh: toNumber(raw.dayHigh),
          dayLow: toNumber(raw.dayLow),
          weekHigh52: toNumber(raw.weekHigh52 ?? raw.week52High),
          weekLow52: toNumber(raw.weekLow52 ?? raw.week52Low),
          marketCapFull: String(raw.marketCapFull ?? raw.marketCap ?? ""),
          marketCapFreeFloat: String(raw.marketCapFreeFloat ?? ""),
          totalTradedValue: String(raw.totalTradedValue ?? ""),
          totalTradedQuantity: String(raw.totalTradedQuantity ?? ""),
          weightedAvgPrice: toNumber(raw.weightedAvgPrice),
          previousClose: toNumber(raw.previousClose ?? raw.prevClose),
          industry: raw.industry || "",
          group: raw.group || "",
        }
        setQuote(normalized)
        setError(null)
      } else {
        setQuote(null)
        setError(result.error || "Failed to fetch quote")
      }
    } catch (err: any) {
      setError(err.message || "Network error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <QuoteLoadingSkeleton />
  }

  if (error || !quote) {
    return (
      <FeyCard>
        <p className="text-rose-400 text-sm">Failed to load quote: {error}</p>
      </FeyCard>
    )
  }

  // Normalize numeric fields again at render-time for extra safety
  const currentValue = toNumber((quote as any).currentValue)
  const change = toNumber((quote as any).change)
  const pChange = toNumber((quote as any).pChange)
  const dayHigh = toNumber((quote as any).dayHigh)
  const dayLow = toNumber((quote as any).dayLow)
  const weekHigh52 = toNumber((quote as any).weekHigh52)
  const weekLow52 = toNumber((quote as any).weekLow52)
  const weightedAvgPrice = toNumber((quote as any).weightedAvgPrice)
  const previousClose = toNumber((quote as any).previousClose)

  const isPositive = change >= 0
  const colorClass = isPositive ? "text-emerald-400" : "text-rose-400"
  const bgGradient = isPositive 
    ? "from-emerald-500/10 to-transparent" 
    : "from-rose-500/10 to-transparent"

  // Calculate 52-week range position
  const weekRange52 = weekHigh52 - weekLow52
  const currentPosition = currentValue - weekLow52
  const rawRangePercent = weekRange52 > 0 ? (currentPosition / weekRange52) * 100 : 0
  const rangePercent = Math.max(0, Math.min(100, rawRangePercent))

  return (
    <div className="space-y-4">
      {/* Main Price Card */}
      <FeyCard variant="gradient" className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50`} />
        
        <div className="relative">
          {/* Company Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {quote.companyName}
            </h1>
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <span>{quote.scripCode}</span>
              <span>•</span>
              <span>{quote.industry}</span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-zinc-800/50 rounded-md text-xs">
                {quote.group}
              </span>
            </div>
          </div>

          {/* Current Price */}
          <div className="flex items-baseline gap-4 mb-2">
            <span className="text-5xl font-bold text-white">
              ₹{currentValue.toFixed(2)}
            </span>
            <div className={`flex items-center gap-2 ${colorClass}`}>
              {isPositive ? (
                <TrendingUp className="w-6 h-6" />
              ) : (
                <TrendingDown className="w-6 h-6" />
              )}
              <span className="text-2xl font-bold">
                {pChange.toFixed(2)}%
              </span>
              <span className="text-xl text-zinc-500">
                ({isPositive ? "+" : ""}{change.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Day Range */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Day Range:</span>
            <span className="text-white">₹{dayLow.toFixed(2)}</span>
            <span>-</span>
            <span className="text-white">₹{dayHigh.toFixed(2)}</span>
          </div>
        </div>
      </FeyCard>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Market Cap"
          value={quote.marketCapFull}
          subValue={`Free Float: ${quote.marketCapFreeFloat}`}
        />
        <MetricCard
          icon={Activity}
          label="Volume"
          value={quote.totalTradedQuantity}
          subValue={`Value: ${quote.totalTradedValue}`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Prev Close"
          value={`₹${previousClose.toFixed(2)}`}
          subValue={`Weighted Avg: ₹${weightedAvgPrice.toFixed(2)}`}
        />
        <MetricCard
          icon={BarChart3}
          label="52W Range"
          value={`₹${weekLow52.toFixed(2)} - ₹${weekHigh52.toFixed(2)}`}
          subValue={`Current: ${rangePercent.toFixed(1)}%`}
        />
      </div>

      {/* 52-Week Range Visualization */}
      <FeyCard>
        <h3 className="text-sm font-medium text-zinc-400 mb-4">52-Week Price Range</h3>
        
        <div className="relative">
          {/* Range Bar */}
          <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${rangePercent}%` }}
            />
          </div>

          {/* Current Position Indicator */}
          <div 
            className="absolute -top-1 w-4 h-4 bg-white rounded-full border-2 border-zinc-900 shadow-lg transition-all duration-500"
            style={{ left: `calc(${rangePercent}% - 8px)` }}
          />

          {/* Labels */}
          <div className="flex justify-between mt-3 text-xs">
            <div className="text-left">
              <p className="text-zinc-500">52W Low</p>
              <p className="text-white font-semibold">₹{weekLow52.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-500">Current</p>
              <p className={`font-semibold ${colorClass}`}>₹{currentValue.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500">52W High</p>
              <p className="text-white font-semibold">₹{weekHigh52.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Distance from extremes */}
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
          <div>
            <p className="text-xs text-zinc-500 mb-1">From 52W High</p>
            <p className={`text-sm font-semibold ${weekHigh52 - currentValue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {(
                weekHigh52 > 0
                  ? ((currentValue - weekHigh52) / weekHigh52) * 100
                  : 0
              ).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">From 52W Low</p>
            <p className={`text-sm font-semibold ${currentValue - weekLow52 > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              +{(
                weekLow52 > 0
                  ? ((currentValue - weekLow52) / weekLow52) * 100
                  : 0
              ).toFixed(2)}%
            </p>
          </div>
        </div>
      </FeyCard>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue
}: {
  icon: React.ElementType
  label: string
  value: string
  subValue?: string
}) {
  return (
    <FeyCard className="hover:border-zinc-700/50 transition-all cursor-default">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-zinc-800/50 rounded-lg">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className="text-sm font-semibold text-white truncate">{value}</p>
          {subValue && (
            <p className="text-xs text-zinc-600 truncate mt-0.5">{subValue}</p>
          )}
        </div>
      </div>
    </FeyCard>
  )
}

function QuoteLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <FeyCard className="animate-pulse">
        <div className="h-8 bg-zinc-800/30 rounded w-2/3 mb-4" />
        <div className="h-12 bg-zinc-800/30 rounded w-1/3 mb-2" />
        <div className="h-4 bg-zinc-800/30 rounded w-1/4" />
      </FeyCard>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <FeyCard key={i} className="animate-pulse">
            <div className="h-16 bg-zinc-800/30 rounded" />
          </FeyCard>
        ))}
      </div>
    </div>
  )
}
