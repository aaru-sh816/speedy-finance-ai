"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { Search, Filter, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Calendar, Users, Building2, Activity, ChevronLeft, ChevronRight, RefreshCw, ExternalLink, Database, Sparkles, BarChart3, Target, Zap } from "lucide-react"
import { BulkDealsAIBar } from "@/components/bulk-deals-ai-bar"
import { InvestorLeaderboard } from "@/components/bulk-deals/InvestorLeaderboard"
import { DealPerformanceTable } from "@/components/bulk-deals/DealPerformanceTable"
import { PerformanceSummary } from "@/components/bulk-deals/PerformanceSummary"
import { classifyInvestor } from "@/lib/bulk-deals/investorClassifier"

type Deal = {
  date: string
  scripCode: string
  securityName: string
  clientName: string
  side: "BUY" | "SELL" | string
  quantity: number | null
  price: number | null
  type: string
  exchange: string
}

const CACHE_KEY = "speedy_bulk_deals_cache"
const CACHE_META_KEY = "speedy_bulk_deals_meta"

// Cache helpers for localStorage persistence
function getCachedDeals(): Deal[] {
  if (typeof window === "undefined") return []
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : []
  } catch { return [] }
}

function saveDealToCache(newDeals: Deal[]) {
  if (typeof window === "undefined") return
  try {
    const existing = getCachedDeals()
    // Create a map to deduplicate by unique key
    const dealsMap = new Map<string, Deal>()
    for (const d of existing) {
      const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}`
      dealsMap.set(key, d)
    }
    for (const d of newDeals) {
      const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}`
      dealsMap.set(key, d)
    }
    const merged = Array.from(dealsMap.values())
    // Keep last 5000 deals max to avoid storage limits
    const trimmed = merged.slice(-5000)
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
    localStorage.setItem(CACHE_META_KEY, JSON.stringify({ 
      lastUpdated: new Date().toISOString(),
      count: trimmed.length 
    }))
  } catch (e) {
    console.warn("Failed to cache deals:", e)
  }
}

function getCacheMeta(): { lastUpdated: string; count: number } | null {
  if (typeof window === "undefined") return null
  try {
    const meta = localStorage.getItem(CACHE_META_KEY)
    return meta ? JSON.parse(meta) : null
  } catch { return null }
}

function rupeeCompact(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "-"
  const abs = Math.abs(v)
  if (abs >= 1e7) return `${(v / 1e7).toFixed(2)} crore`
  if (abs >= 1e5) return `${(v / 1e5).toFixed(2)} lacs`
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)} K`
  return v.toLocaleString("en-IN")
}

function clsx(...v: (string | false | undefined)[]) { return v.filter(Boolean).join(" ") }

export default function BulkDealsPage() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 7*24*3600*1000))
  const [to, setTo] = useState(() => new Date())
  const [loading, setLoading] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [groups, setGroups] = useState<any[] | null>(null)
  const [query, setQuery] = useState("")
  const [side, setSide] = useState<"ALL" | "BUY" | "SELL">("ALL")
  const [exchange, setExchange] = useState<"ALL" | "NSE" | "BSE">("ALL")
  const [intraday, setIntraday] = useState<"all" | "only" | "exclude">("all")
  const [groupBy, setGroupBy] = useState<"" | "person" | "company">("")
  const [apiMeta, setApiMeta] = useState<{ sources?: { nse: number; bse: number }; bseServiceAvailable?: boolean } | null>(null)
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [sortField, setSortField] = useState<"date" | "value" | "company" | "person">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [cacheMeta, setCacheMeta] = useState<{ lastUpdated: string; count: number } | null>(null)
  const [useCache, setUseCache] = useState(true)
  const [fetchingToday, setFetchingToday] = useState(false)
  const [fetchStatus, setFetchStatus] = useState<string | null>(null)

  // Smart fetch for today's BSE deals when not available
  const fetchTodayDeals = async () => {
    setFetchingToday(true)
    setFetchStatus("Fetching today's BSE deals...")
    try {
      const res = await fetch('/api/bulk-deals/fetch-today', { 
        method: 'POST',
        cache: 'no-store'
      })
      const data = await res.json()
      
      if (data.success) {
        if (data.fetched) {
          setFetchStatus(`Added ${data.added} new BSE deals`)
          // Refresh deals after fetch
          await fetchDeals()
        } else {
          setFetchStatus(data.message || "Today's data already exists")
        }
      } else {
        setFetchStatus(data.error || "Failed to fetch")
      }
    } catch (err) {
      setFetchStatus("Failed to fetch today's deals")
    } finally {
      setFetchingToday(false)
      // Clear status after 5 seconds
      setTimeout(() => setFetchStatus(null), 5000)
    }
  }

  // Load cache metadata on mount
  useEffect(() => {
    setCacheMeta(getCacheMeta())
  }, [])

  const formatDateLocal = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchDeals = async () => {
    setLoading(true)
    setPage(1)
    try {
      // Fetch from history API (has 182K deals from 2012-2025)
      const startDate = formatDateLocal(from)
      const endDate = formatDateLocal(to)
      
      const [historyRes, liveRes] = await Promise.all([
        fetch(`/api/bulk-deals/history?start=${startDate}&end=${endDate}`, { cache: "no-store" }),
        fetch(`/api/bse/bulk-deals`, { cache: "no-store" }),
      ])
      
      const historyData = await historyRes.json()
      const liveData = await liveRes.json()
      
      // Store API metadata
      if (liveData.meta) {
        setApiMeta(liveData.meta)
      }
      if (historyData.metadata) {
        setCacheMeta({
          lastUpdated: historyData.metadata.lastUpdated || new Date().toISOString(),
          count: historyData.totalInDatabase || 0
        })
      }
      
      // Normalize function
      const normalizeDeals = (rawDeals: any[]): Deal[] => rawDeals.map((d: any) => {
        const rawType = (d.side || d.deal_type || d.type || "").toString().toUpperCase()
        const side: "BUY" | "SELL" | string =
          rawType === "BUY" || rawType === "B" || rawType === "P" ? "BUY" : "SELL"

        const quantity = d.quantity != null ? Number(d.quantity) : null
        const price = d.price != null ? Number(d.price) : (d.trade_price != null ? Number(d.trade_price) : null)

        return {
          date: d.date || d.deal_date || "",
          scripCode: d.scripCode || d.scrip_code || d.Security_Code || "",
          securityName: d.securityName || d.security_name || d.Company || "",
          clientName: d.clientName || d.client_name || d.Client_Name || "",
          side,
          quantity,
          price,
          type: rawType,
          exchange: d.exchange || "BSE",
        }
      })
      
      const historyDeals = normalizeDeals(historyData.data || [])
      const liveDeals = normalizeDeals(liveData.deals || liveData.data || [])

      // Merge history + live data, deduplicating by unique key
      const dealsMap = new Map<string, Deal>()
      for (const d of historyDeals) {
        const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}`
        dealsMap.set(key, d)
      }
      for (const d of liveDeals) {
        const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}`
        dealsMap.set(key, d) // Live data overwrites history
      }
      
      setDeals(Array.from(dealsMap.values()))
    } catch (err) {
      console.error('Failed to fetch deals:', err)
      // Fallback to localStorage cache
      const cachedDeals = getCachedDeals()
      setDeals(cachedDeals)
    } finally {
      setLoading(false)
    }
  }

  // Load deals on mount and when date range or cache toggle changes
  useEffect(() => { fetchDeals() }, [from, to, useCache])

  // Parse date from various formats (DD-MMM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    // Handle DD-MMM-YYYY format (e.g., "17-Dec-2025")
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    }
    const dmy = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
    if (dmy) {
      const [, d, m, y] = dmy
      const month = monthMap[m.toLowerCase()]
      if (month !== undefined) {
        return new Date(parseInt(y), month, parseInt(d))
      }
    }
    // Fallback to standard Date parsing
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }

  const filtered = useMemo(() => {
    let rows = deals.map(d => ({
      ...d,
      side: (d.type || d.side || '').toUpperCase() === 'BUY' || (d.type || d.side || '').toUpperCase() === 'B' || (d.type || d.side || '').toUpperCase() === 'P' ? 'BUY' : 'SELL'
    }))
    
    // Filter by date range
    const fromTime = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
    const toTime = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime()
    rows = rows.filter(d => {
      const dealDate = parseDate(d.date)
      if (!dealDate) return false
      const dealTime = dealDate.getTime()
      return dealTime >= fromTime && dealTime <= toTime
    })
    
    if (query) {
      const q = query.toLowerCase()
      rows = rows.filter(d => `${d.securityName} ${d.clientName} ${d.scripCode}`.toLowerCase().includes(q))
    }
    if (side !== "ALL") rows = rows.filter(d => d.side === side)
    if (exchange !== "ALL") rows = rows.filter(d => d.exchange === exchange)
    
    // Intraday Filter logic
    if (intraday === "exclude") {
      // Group by date, client, and security to find buy+sell pairs
      const dailyGroups = new Map<string, { buy: number, sell: number }>()
      rows.forEach(d => {
        const key = `${d.date}|${d.clientName}|${d.scripCode}`
        const g = dailyGroups.get(key) || { buy: 0, sell: 0 }
        if (d.side === "BUY") g.buy += (d.quantity || 0)
        else g.sell += (d.quantity || 0)
        dailyGroups.set(key, g)
      })
      
      rows = rows.filter(d => {
        const key = `${d.date}|${d.clientName}|${d.scripCode}`
        const g = dailyGroups.get(key)
        // If they both bought and sold on the same day, exclude if net position is small or they strictly reversed
        // Standard definition: both actions on same day
        return !(g && g.buy > 0 && g.sell > 0)
      })
    } else if (intraday === "only") {
      const dailyGroups = new Map<string, { buy: number, sell: number }>()
      rows.forEach(d => {
        const key = `${d.date}|${d.clientName}|${d.scripCode}`
        const g = dailyGroups.get(key) || { buy: 0, sell: 0 }
        if (d.side === "BUY") g.buy += (d.quantity || 0)
        else g.sell += (d.quantity || 0)
        dailyGroups.set(key, g)
      })
      rows = rows.filter(d => {
        const key = `${d.date}|${d.clientName}|${d.scripCode}`
        const g = dailyGroups.get(key)
        return (g && g.buy > 0 && g.sell > 0)
      })
    }

    // Sort
    rows.sort((a, b) => {
      let valA: any, valB: any
      if (sortField === 'date') {
        valA = new Date(a.date).getTime()
        valB = new Date(b.date).getTime()
      } else if (sortField === 'value') {
        valA = (a.quantity || 0) * (a.price || 0)
        valB = (b.quantity || 0) * (b.price || 0)
      } else if (sortField === 'company') {
        valA = a.securityName
        valB = b.securityName
      } else {
        valA = a.clientName
        valB = b.clientName
      }
      if (sortDir === 'asc') return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })
    
    return rows
  }, [deals, query, side, exchange, sortField, sortDir, from, to])
  
  const stats = useMemo(() => {
    const buyDeals = filtered.filter(d => d.side === 'BUY')
    const sellDeals = filtered.filter(d => d.side === 'SELL')
    const totalBuyValue = buyDeals.reduce((sum, d) => sum + ((d.quantity || 0) * (d.price || 0)), 0)
    const totalSellValue = sellDeals.reduce((sum, d) => sum + ((d.quantity || 0) * (d.price || 0)), 0)
    const uniqueCompanies = new Set(filtered.map(d => d.scripCode)).size
    const uniquePersons = new Set(filtered.map(d => d.clientName)).size
    
    // Calculate top investors with classification
    const investorMap = new Map<string, { 
      name: string; 
      type: "individual" | "institutional" | "unknown";
      totalValue: number; 
      buyValue: number; 
      sellValue: number; 
      totalDeals: number;
      buyDeals: number;
      sellDeals: number;
      winners: number;
      losers: number;
      winRate: number;
      avgReturn: number;
      totalPnL: number;
    }>()
    
    for (const d of filtered) {
      const value = (d.quantity || 0) * (d.price || 0)
      const classification = classifyInvestor(d.clientName)
      const existing = investorMap.get(d.clientName) || { 
        name: d.clientName, 
        type: classification.type,
        totalValue: 0, 
        buyValue: 0, 
        sellValue: 0, 
        totalDeals: 0,
        buyDeals: 0,
        sellDeals: 0,
        winners: 0,
        losers: 0,
        winRate: 0,
        avgReturn: 0,
        totalPnL: 0,
      }
      existing.totalValue += value
      existing.totalDeals++
      if (d.side === 'BUY') {
        existing.buyValue += value
        existing.buyDeals++
      } else {
        existing.sellValue += value
        existing.sellDeals++
      }
      investorMap.set(d.clientName, existing)
    }
    
    const topInvestors = Array.from(investorMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 50)
    
    // Big money deals (>= ₹10 Cr)
    const bigMoneyDeals = filtered.filter(d => (d.quantity || 0) * (d.price || 0) >= 1e8)
    
    // Count by investor type
    const individualCount = topInvestors.filter(i => i.type === 'individual').length
    const institutionalCount = topInvestors.filter(i => i.type === 'institutional').length
    
    return { 
      buyDeals: buyDeals.length, 
      sellDeals: sellDeals.length, 
      totalBuyValue, 
      totalSellValue, 
      uniqueCompanies, 
      uniquePersons, 
      topInvestors, 
      bigMoneyDeals: bigMoneyDeals.length,
      individualCount,
      institutionalCount
    }
  }, [filtered])
  
  const paginated = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])
  
  const totalPages = Math.ceil(filtered.length / perPage)

  const years = useMemo(() => {
    const y: number[] = []
    const now = new Date().getFullYear()
    for (let i = 2010; i <= now; i++) y.push(i)
    return y
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header - Mobile Responsive */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Bulk Deals</h1>
              <p className="text-zinc-500 text-xs sm:text-sm">Institutional trades • 2012-Present</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Cache Status - Hidden on mobile */}
              {cacheMeta && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <Database className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs text-cyan-300">{(cacheMeta.count / 1000).toFixed(0)}K deals</span>
                </div>
              )}
              {/* Cache Toggle - Compact on mobile */}
              <button
                onClick={() => setUseCache(!useCache)}
                className={clsx(
                  "px-2.5 sm:px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 sm:gap-2 text-xs",
                  useCache 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                    : "bg-white/5 border-white/10 text-zinc-400"
                )}
              >
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{useCache ? "Historical" : "Live Only"}</span>
              </button>
              <button
                onClick={fetchDeals}
                className="p-2 sm:px-4 sm:py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
                <span className="hidden sm:inline text-sm">Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Cards - Minimal Design */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 sm:p-5 hover:border-emerald-500/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Buy</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-emerald-400">{rupeeCompact(stats.totalBuyValue)}</div>
              <div className="text-[10px] text-zinc-600 mt-1">{stats.buyDeals} deals</div>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 sm:p-5 hover:border-rose-500/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="h-4 w-4 text-rose-400" />
                <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Sell</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-rose-400">{rupeeCompact(stats.totalSellValue)}</div>
              <div className="text-[10px] text-zinc-600 mt-1">{stats.sellDeals} deals</div>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 sm:p-5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Companies</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-white">{stats.uniqueCompanies}</div>
              <div className="text-[10px] text-zinc-600 mt-1">unique</div>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 sm:p-5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Investors</span>
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-white">{stats.uniquePersons}</div>
              <div className="text-[10px] text-zinc-600 mt-1">unique</div>
            </div>
          </div>

            {/* Whale Sentiment Indicator */}
            <div className="mb-8 p-6 bg-zinc-900/30 backdrop-blur-3xl border border-zinc-800/50 rounded-[2rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Target className="w-32 h-32 text-white" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Whale Sentiment</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter text-white uppercase">
                    Smart Money is {stats.totalBuyValue > stats.totalSellValue ? <span className="text-emerald-500">Accumulating</span> : <span className="text-rose-500">Liquidating</span>}
                  </h2>
                  <p className="text-zinc-500 text-sm font-medium mt-1">
                    Net inflow of <span className={stats.totalBuyValue > stats.totalSellValue ? "text-emerald-400" : "text-rose-400"}>₹{rupeeCompact(Math.abs(stats.totalBuyValue - stats.totalSellValue))}</span> across {stats.uniqueCompanies} companies in this period.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Buy/Sell Ratio</p>
                    <p className="text-2xl font-black text-white">{(stats.totalBuyValue / (stats.totalSellValue || 1)).toFixed(2)}x</p>
                  </div>
                  <div className="w-32 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${(stats.totalBuyValue / (stats.totalBuyValue + stats.totalSellValue || 1)) * 100}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${(stats.totalSellValue / (stats.totalBuyValue + stats.totalSellValue || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Money Tracker - Investor Leaderboard with Type Tabs */}
          {stats.topInvestors && stats.topInvestors.length > 0 && (
            <InvestorLeaderboard 
              investors={stats.topInvestors} 
              loading={loading}
            />
          )}
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-cyan-400" />
            <h2 className="font-semibold">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="text-xs text-zinc-400 mb-2 block">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Company, person, or scrip code"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/40 transition-all"
                />
              </div>
            </div>

            {/* Trade Type */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Trade Type</label>
              <select 
                value={side} 
                onChange={e => setSide(e.target.value as any)} 
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/40 transition-all"
              >
                <option value="ALL">All Trades</option>
                <option value="BUY">Buy Only</option>
                <option value="SELL">Sell Only</option>
              </select>
            </div>

              {/* Exchange Filter */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Exchange</label>
                <select 
                  value={exchange} 
                  onChange={e => setExchange(e.target.value as any)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/40 transition-all"
                >
                  <option value="ALL">All Exchanges</option>
                  <option value="NSE">NSE Only</option>
                  <option value="BSE">BSE Only</option>
                </select>
              </div>

              {/* Intraday Filter */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Speculative/Intraday</label>
                <select 
                  value={intraday} 
                  onChange={e => setIntraday(e.target.value as any)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/40 transition-all"
                >
                  <option value="all">Include All</option>
                  <option value="exclude">Hide Intraday</option>
                  <option value="only">Only Intraday</option>
                </select>
              </div>

              {/* Date (single day) */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Date</label>
              <input 
                type="date" 
                value={formatDateLocal(from)} 
                onChange={e => {
                  const value = e.target.value
                  if (!value) return
                  const selected = new Date(value)
                  // When user picks a date manually, treat it as a single-day filter
                  setFrom(selected)
                  setTo(selected)
                }} 
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/40 transition-all"
              />
            </div>
          </div>

          {/* Quick Date Ranges */}
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-zinc-500">Quick select:</span>
            {/* Today button with smart BSE fetch */}
            <button
              onClick={async () => {
                const today = new Date()
                setFrom(today)
                setTo(today)

                if (exchange === 'BSE') {
                  await fetchTodayDeals()
                }
              }}
              disabled={fetchingToday}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs transition-all",
                fetchingToday 
                  ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 animate-pulse"
                  : "bg-white/5 border border-white/10 hover:bg-white/10"
              )}
            >
              {fetchingToday ? '⏳ Fetching...' : 'Today'}
            </button>
            {[
              { label: 'Yesterday', days: 1 },
              { label: 'Last 7 Days', days: 7 },
              { label: 'Last 30 Days', days: 30 },
              { label: 'Last 1 Year', days: 365 },
            ].map(range => (
              <button
                key={range.label}
                onClick={() => {
                  const end = new Date()
                  const start = new Date(end.getTime() - range.days * 24 * 3600 * 1000)
                  setFrom(start)
                  setTo(end)
                }}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs transition-all"
              >
                {range.label}
              </button>
            ))}
            <button
              onClick={() => {
                setFrom(new Date('2012-05-24'))
                setTo(new Date())
              }}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 text-xs font-semibold transition-all"
            >
              ⏱️ All Time
            </button>
            {/* Fetch status indicator */}
            {fetchStatus && (
              <span className="text-xs text-cyan-400 ml-2 animate-fade-in">
                {fetchStatus}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-800/50 border-b border-white/5">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Person</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type</th>
                  <th className="text-right py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-zinc-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <div>Loading deals...</div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="text-zinc-400 mb-2">No bulk deals found for selected date range</div>
                      <div className="text-xs text-zinc-600 max-w-md mx-auto">
                        NSE provides bulk/block deals for the last 2-3 trading days only. 
                        Try selecting "Today" or "Last 7 Days" to see recent deals.
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((d, i) => {
                  const value = (d.quantity ?? 0) * (d.price ?? 0)
                  const dObj = new Date(d.date)
                  const dateStr = isNaN(dObj.getTime()) ? d.date : dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  const bseLink = `https://www.bseindia.com/stock-share-price/x/${encodeURIComponent((d.securityName||'').toLowerCase().replace(/\s+/g,'-'))}/${d.scripCode}/`
                  return (
                    <tr key={i} className={clsx(
                      "hover:bg-white/5 transition-colors",
                      value >= 1e8 && "bg-gradient-to-r from-amber-500/5 to-transparent"
                    )}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div>
                            <Link 
                              href={`/bulk-deals/company/${encodeURIComponent(d.scripCode || d.securityName)}`}
                              className="text-white font-medium hover:text-cyan-400 transition-colors flex items-center gap-1 group"
                            >
                              <span className="group-hover:underline">{d.securityName}</span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-zinc-500">{d.scripCode}</span>
                              <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                d.exchange === "BSE" 
                                  ? "bg-orange-500/20 text-orange-400" 
                                  : "bg-blue-500/20 text-blue-400"
                              )}>
                                {d.exchange}
                              </span>
                              {value >= 1e8 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                                  🔥 BIG
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Link 
                          href={`/bulk-deals/person/${encodeURIComponent(d.clientName)}`}
                          className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors flex items-center gap-1 group"
                        >
                          <span className="group-hover:underline">{d.clientName}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-sm text-zinc-400">{dateStr}</td>
                      <td className="py-4 px-6">
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold",
                          d.side === "BUY" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        )}>
                          {d.side === "BUY" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {d.side}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className={clsx(
                          "font-bold text-sm",
                          d.side === "BUY" ? "text-emerald-400" : "text-rose-400"
                        )}>
                          ₹{rupeeCompact(value)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {(d.quantity??0).toLocaleString()} × ₹{(d.price??0).toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-zinc-800/30 border-t border-white/5 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} deals
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          page === pageNum
                            ? "bg-cyan-500 text-white"
                            : "bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400"
                        )}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Speedy AI Chat Bar */}
      <BulkDealsAIBar 
        totalDeals={filtered.length} 
        dateRange={{ from, to }} 
      />
    </div>
  )
}
