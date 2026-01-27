'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Flame,
  BarChart3,
  Eye,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

interface HeatmapStock {
  scripCode: string
  symbol: string
  name: string
  price: number
  changePercent: number
  volume: number
  marketCap?: number
  sector?: string
}

interface WatchlistHeatmapProps {
  stocks: HeatmapStock[]
  className?: string
}

function getColorIntensity(changePercent: number): string {
  const absChange = Math.abs(changePercent)
  
  if (changePercent >= 0) {
    if (absChange >= 5) return 'from-emerald-600 to-emerald-500'
    if (absChange >= 3) return 'from-emerald-500 to-emerald-400'
    if (absChange >= 1.5) return 'from-emerald-400/80 to-emerald-400/60'
    if (absChange >= 0.5) return 'from-emerald-400/50 to-emerald-400/30'
    return 'from-emerald-400/20 to-emerald-400/10'
  } else {
    if (absChange >= 5) return 'from-rose-600 to-rose-500'
    if (absChange >= 3) return 'from-rose-500 to-rose-400'
    if (absChange >= 1.5) return 'from-rose-400/80 to-rose-400/60'
    if (absChange >= 0.5) return 'from-rose-400/50 to-rose-400/30'
    return 'from-rose-400/20 to-rose-400/10'
  }
}

function getTextColor(changePercent: number): string {
  const absChange = Math.abs(changePercent)
  if (absChange >= 3) return 'text-white'
  if (absChange >= 1) return changePercent >= 0 ? 'text-emerald-100' : 'text-rose-100'
  return 'text-zinc-200'
}

function getSize(stock: HeatmapStock, maxVolume: number): string {
  const volumeRatio = stock.volume / maxVolume
  if (volumeRatio >= 0.7) return 'col-span-2 row-span-2'
  if (volumeRatio >= 0.4) return 'col-span-2'
  if (volumeRatio >= 0.2) return 'row-span-2'
  return ''
}

export function WatchlistHeatmap({ stocks, className = '' }: WatchlistHeatmapProps) {
  const router = useRouter()
  const [hoveredStock, setHoveredStock] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'change' | 'volume' | 'name'>('change')
  const [viewMode, setViewMode] = useState<'treemap' | 'grid'>('treemap')

  const maxVolume = useMemo(() => 
    Math.max(...stocks.map(s => s.volume || 1)), 
    [stocks]
  )

  const sortedStocks = useMemo(() => {
    const sorted = [...stocks]
    switch (sortBy) {
      case 'change':
        return sorted.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      case 'volume':
        return sorted.sort((a, b) => (b.volume || 0) - (a.volume || 0))
      case 'name':
        return sorted.sort((a, b) => a.symbol.localeCompare(b.symbol))
      default:
        return sorted
    }
  }, [stocks, sortBy])

  const stats = useMemo(() => {
    const gainers = stocks.filter(s => s.changePercent > 0)
    const losers = stocks.filter(s => s.changePercent < 0)
    const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length
    const totalVolume = stocks.reduce((sum, s) => sum + (s.volume || 0), 0)
    const topGainer = gainers.length > 0 ? gainers.reduce((max, s) => s.changePercent > max.changePercent ? s : max, gainers[0]) : null
    const topLoser = losers.length > 0 ? losers.reduce((min, s) => s.changePercent < min.changePercent ? s : min, losers[0]) : null
    
    return { gainers: gainers.length, losers: losers.length, avgChange, totalVolume, topGainer, topLoser }
  }, [stocks])

  if (stocks.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 bg-zinc-900/50 rounded-2xl border border-zinc-800 ${className}`}>
        <p className="text-zinc-500">No stocks to display</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Gainers</p>
              <p className="text-lg font-bold text-emerald-400">{stats.gainers}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Losers</p>
              <p className="text-lg font-bold text-rose-400">{stats.losers}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
              <Activity className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Avg Change</p>
              <p className={`text-lg font-bold ${stats.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
              </p>
            </div>
          </div>

          {stats.topGainer && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Flame className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">
                <span className="font-bold">{stats.topGainer.symbol}</span>
                <span className="ml-1.5">+{stats.topGainer.changePercent.toFixed(2)}%</span>
              </span>
            </div>
          )}

          {stats.topLoser && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
              <span className="text-sm text-rose-400">
                <span className="font-bold">{stats.topLoser.symbol}</span>
                <span className="ml-1.5">{stats.topLoser.changePercent.toFixed(2)}%</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort controls */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            {(['change', 'volume', 'name'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSortBy(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sortBy === mode 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'change' ? 'Change' : mode === 'volume' ? 'Volume' : 'Name'}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('treemap')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'treemap' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Treemap view"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid view"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      {viewMode === 'treemap' ? (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 auto-rows-[80px] gap-1.5">
          {sortedStocks.map(stock => {
            const sizeClass = getSize(stock, maxVolume)
            const colorClass = getColorIntensity(stock.changePercent)
            const textColor = getTextColor(stock.changePercent)
            const isHovered = hoveredStock === stock.scripCode
            
            return (
              <button
                key={stock.scripCode}
                onClick={() => router.push(`/company/${stock.scripCode}`)}
                onMouseEnter={() => setHoveredStock(stock.scripCode)}
                onMouseLeave={() => setHoveredStock(null)}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colorClass} border border-white/5 transition-all duration-300 ${sizeClass} ${
                  isHovered ? 'scale-[1.02] z-10 shadow-2xl ring-2 ring-white/20' : ''
                }`}
              >
                <div className="absolute inset-0 p-2 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className={`font-bold text-sm ${textColor}`}>{stock.symbol}</span>
                    {Math.abs(stock.changePercent) >= 3 && (
                      <Zap className={`h-3.5 w-3.5 ${stock.changePercent >= 0 ? 'text-emerald-200' : 'text-rose-200'}`} />
                    )}
                  </div>
                  
                  <div>
                    <div className={`text-lg font-bold ${textColor}`}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </div>
                    <div className={`text-[10px] opacity-70 ${textColor}`}>
                      ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* Hover overlay */}
                {isHovered && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-2 animate-in fade-in duration-150">
                    <p className="text-white font-bold text-sm text-center line-clamp-2">{stock.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-zinc-300">Vol: {(stock.volume / 1000).toFixed(0)}K</span>
                    </div>
                    <span className="mt-2 text-[10px] text-amber-400 flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> Click to view
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {sortedStocks.map(stock => {
            const colorClass = getColorIntensity(stock.changePercent)
            const textColor = getTextColor(stock.changePercent)
            
            return (
              <button
                key={stock.scripCode}
                onClick={() => router.push(`/company/${stock.scripCode}`)}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colorClass} border border-white/5 p-3 transition-all hover:scale-[1.02] hover:shadow-xl`}
              >
                <div className="flex flex-col items-center text-center">
                  <span className={`font-bold text-sm ${textColor}`}>{stock.symbol}</span>
                  <div className={`text-xl font-bold ${textColor} mt-1`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </div>
                  <div className={`text-xs opacity-70 ${textColor}`}>
                    ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-600 to-emerald-500" />
          <span>&gt;5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-400/50 to-emerald-400/30" />
          <span>1-5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-400/20 to-emerald-400/10" />
          <span>&lt;1%</span>
        </div>
        <div className="w-px h-4 bg-zinc-700" />
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-rose-400/20 to-rose-400/10" />
          <span>&lt;-1%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-rose-400/50 to-rose-400/30" />
          <span>-1 to -5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-rose-600 to-rose-500" />
          <span>&lt;-5%</span>
        </div>
      </div>
    </div>
  )
}
