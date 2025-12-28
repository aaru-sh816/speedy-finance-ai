"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, Sparkles, User, ArrowUpRight } from "lucide-react"
import { FeyCard } from "./FeyCard"

function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = Number(
    typeof value === "string" ? value.replace(/,/g, "").trim() : value
  )
  return Number.isFinite(n) ? n : fallback
}

interface BulkDeal {
  client_name: string
  clientName?: string
  deal_type: string
  dealType?: string
  quantity: number | string
  price: number | string
  date: string
  deal_date?: string
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
  const [bulkDeals, setBulkDeals] = useState<BulkDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuote()
    fetchBulkDeals()
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
            weekHigh52: toNumber(raw.weekHigh52 ?? raw.week52High ?? raw['52weekHigh']),
            weekLow52: toNumber(raw.weekLow52 ?? raw.week52Low ?? raw['52weekLow']),
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

  const fetchBulkDeals = async () => {
    try {
      const response = await fetch(`/api/bulk-deals/history?scripCode=${scripCode}&days=365`)
      const result = await response.json()
      if (result.success && result.data) {
        setBulkDeals(result.data)
      }
    } catch (err) {
      console.error("Failed to fetch bulk deals:", err)
    }
  }

  // Filter for unique "Whale" entries (Buy side only)
  const whaleEntries = useMemo(() => {
    return bulkDeals.filter(d => {
      const type = (d.deal_type || d.dealType || "").toLowerCase()
      return type.includes("buy") || type === "p" // P often stands for Purchase
    })
  }, [bulkDeals])

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

  // Calculate positions for Whale dots
  const whaleDots = whaleEntries.map(deal => {
    const price = toNumber(deal.price)
    const pos = price - weekLow52
    const rawPct = weekRange52 > 0 ? (pos / weekRange52) * 100 : 0
    return {
      percent: Math.max(0, Math.min(100, rawPct)),
      price,
      client: deal.client_name || deal.clientName,
      date: deal.date || deal.deal_date
    }
  }).filter(dot => dot.percent >= 0 && dot.percent <= 100)

  return (
    <div className="space-y-4">
      {/* Main Price Card */}
      <FeyCard variant="gradient" className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50`} />
        
        <div className="relative">
          {/* Company Header */}
          <div className="mb-6 flex justify-between items-start">
            <div>
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
            </div>

            {/* Current Price */}
          <div className="flex items-baseline gap-4 mb-2">
            <span className="text-5xl font-bold text-white">
              ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
      <FeyCard className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">52-Week Price Range</h3>
          {whaleDots.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-cyan-400 font-medium bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              Wolf Pack Entry Zone
            </div>
          )}
        </div>
        
        <div className="relative pt-6 pb-2">
          {/* Range Bar */}
          <div className="h-2.5 bg-zinc-800/50 rounded-full relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-emerald-500/40 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(52,211,153,0.1)]"
              style={{ width: `${rangePercent}%` }}
            />

            {/* Wolf Pack Entry Dots (Glowing) */}
            {whaleDots.map((dot, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 group cursor-help z-10"
                style={{ left: `${dot.percent}%` }}
              >
                <div className="w-3 h-3 bg-cyan-400 rounded-full border-2 border-zinc-950 shadow-[0_0_12px_rgba(34,211,238,1)] animate-pulse" />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-50">
                  <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-2xl min-w-[200px] backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <span className="text-[11px] font-bold text-white leading-tight">{dot.client}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500">Price: ₹{dot.price.toFixed(2)}</span>
                      <span className="text-zinc-500">{dot.date ? new Date(dot.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A'}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-cyan-400 italic">
                      Institutional "Wolf Pack" Entry
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45 mx-auto -mt-1" />
                </div>
              </div>
            ))}
          </div>

          {/* Current Position Indicator */}
          <div 
            className="absolute top-4 w-5 h-5 bg-white rounded-full border-[3px] border-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-1000 ease-out z-20"
            style={{ left: `calc(${rangePercent}% - 10px)` }}
          >
            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-6 text-xs">
            <div className="text-left">
              <p className="text-zinc-500 mb-1">52W Low</p>
              <p className="text-white font-bold text-sm">₹{weekLow52.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-zinc-500 mb-1">Current Price</p>
              <p className={`font-bold text-lg ${colorClass}`}>₹{currentValue.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 mb-1">52W High</p>
              <p className="text-white font-bold text-sm">₹{weekHigh52.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Distance from extremes with visual progress */}
        <div className="mt-6 grid grid-cols-2 gap-6 pt-6 border-t border-zinc-800/50">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-xs text-zinc-500">From 52W High</p>
              <p className={`text-sm font-bold ${weekHigh52 - currentValue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(
                  weekHigh52 > 0
                    ? ((currentValue - weekHigh52) / weekHigh52) * 100
                    : 0
                ).toFixed(2)}%
              </p>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500/50"
                style={{ width: `${Math.min(100, Math.abs((currentValue - weekHigh52) / weekHigh52) * 100)}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-xs text-zinc-500">From 52W Low</p>
              <p className={`text-sm font-bold ${currentValue - weekLow52 > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                +{(
                  weekLow52 > 0
                    ? ((currentValue - weekLow52) / weekLow52) * 100
                    : 0
                ).toFixed(2)}%
              </p>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500/50"
                style={{ width: `${Math.min(100, Math.abs((currentValue - weekLow52) / weekLow52) * 100)}%` }}
              />
            </div>
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
