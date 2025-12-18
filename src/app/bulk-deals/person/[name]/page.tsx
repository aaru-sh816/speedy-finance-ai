"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, 
  Building2, Calendar, Activity, ChevronLeft, ChevronRight,
  ExternalLink, User, Briefcase, Target, Flame, Star
} from "lucide-react"
import clsx from "clsx"

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

type Stats = {
  totalDeals: number
  totalBuyValue: number
  totalSellValue: number
  uniqueCompanies: number
  firstDeal: string
  lastDeal: string
  topCompanies: { name: string; code: string; count: number; value: number; buyCount: number; sellCount: number }[]
  recentDeals: Deal[]
  biggestDeal: Deal | null
  repeatBuys: { name: string; code: string; count: number; dates: string[] }[]
  accumulationPatterns: { name: string; code: string; buyCount: number; totalBought: number }[]
}

function rupeeCompact(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} crore`
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} lacs`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function generateAvatarGradient(name: string): string {
  const gradients = [
    "from-cyan-500 to-blue-600",
    "from-purple-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-indigo-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
  ]
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

export default function PersonProfilePage() {
  const params = useParams()
  const personName = decodeURIComponent(params.name as string)
  
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all')
  const perPage = 20

  useEffect(() => {
    async function fetchDeals() {
      setLoading(true)
      try {
        // Fetch all time data for this person
        const res = await fetch(`/api/bulk-deals/history?start=2012-01-01&end=${new Date().toISOString().split('T')[0]}`)
        const data = await res.json()
        const allDeals: Deal[] = (data.data || []).map((d: any) => ({
          date: d.date || d.deal_date || "",
          scripCode: d.scripCode || d.scrip_code || "",
          securityName: d.securityName || d.security_name || d.Company || "",
          clientName: d.clientName || d.client_name || "",
          side: (d.side || "").toUpperCase() === "BUY" || d.side === "B" || d.side === "P" ? "BUY" : "SELL",
          quantity: d.quantity != null ? Number(d.quantity) : null,
          price: d.price != null ? Number(d.price) : null,
          type: d.type || "bulk",
          exchange: d.exchange || "BSE",
        }))
        
        // Filter by person name (case-insensitive)
        const personDeals = allDeals.filter(d => 
          d.clientName.toLowerCase() === personName.toLowerCase()
        )
        
        // Sort by date descending
        personDeals.sort((a, b) => b.date.localeCompare(a.date))
        
        setDeals(personDeals)
      } catch (err) {
        console.error('Failed to fetch deals:', err)
      } finally {
        setLoading(false)
      }
    }
    
    if (personName) fetchDeals()
  }, [personName])

  // Calculate stats
  const stats: Stats = useMemo(() => {
    const buyDeals = deals.filter(d => d.side === 'BUY')
    const sellDeals = deals.filter(d => d.side === 'SELL')
    
    const buyValue = buyDeals.reduce((sum, d) => sum + (d.quantity || 0) * (d.price || 0), 0)
    const sellValue = sellDeals.reduce((sum, d) => sum + (d.quantity || 0) * (d.price || 0), 0)
    
    const companies = new Map<string, { name: string; code: string; count: number; value: number; buyCount: number; sellCount: number; buyDates: string[]; totalBought: number }>()
    for (const d of deals) {
      const key = d.scripCode || d.securityName
      const existing = companies.get(key) || { name: d.securityName, code: d.scripCode, count: 0, value: 0, buyCount: 0, sellCount: 0, buyDates: [], totalBought: 0 }
      existing.count++
      existing.value += (d.quantity || 0) * (d.price || 0)
      if (d.side === 'BUY') {
        existing.buyCount++
        existing.buyDates.push(d.date)
        existing.totalBought += (d.quantity || 0) * (d.price || 0)
      } else {
        existing.sellCount++
      }
      companies.set(key, existing)
    }
    
    const topCompanies = Array.from(companies.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    
    // Repeat buys - stocks bought multiple times
    const repeatBuys = Array.from(companies.values())
      .filter(c => c.buyCount >= 2)
      .map(c => ({ name: c.name, code: c.code, count: c.buyCount, dates: c.buyDates }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    // Accumulation patterns - stocks with multiple buys and no sells (or more buys than sells)
    const accumulationPatterns = Array.from(companies.values())
      .filter(c => c.buyCount >= 2 && c.buyCount > c.sellCount)
      .map(c => ({ name: c.name, code: c.code, buyCount: c.buyCount, totalBought: c.totalBought }))
      .sort((a, b) => b.totalBought - a.totalBought)
      .slice(0, 5)
    
    const dates = deals.map(d => d.date).filter(Boolean).sort()
    
    let biggestDeal: Deal | null = null
    let maxValue = 0
    for (const d of deals) {
      const value = (d.quantity || 0) * (d.price || 0)
      if (value > maxValue) {
        maxValue = value
        biggestDeal = d
      }
    }
    
    return {
      totalDeals: deals.length,
      totalBuyValue: buyValue,
      totalSellValue: sellValue,
      uniqueCompanies: companies.size,
      firstDeal: dates[0] || '',
      lastDeal: dates[dates.length - 1] || '',
      topCompanies,
      recentDeals: deals.slice(0, 5),
      biggestDeal,
      repeatBuys,
      accumulationPatterns,
    }
  }, [deals])

  // Filtered and paginated deals
  const filtered = useMemo(() => {
    if (filter === 'all') return deals
    return deals.filter(d => d.side === filter)
  }, [deals, filter])
  
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const avatarGradient = generateAvatarGradient(personName)

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Navigation */}
      <div className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link 
            href="/bulk-deals" 
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Bulk Deals
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-8">
          {/* Avatar */}
          <div className={clsx(
            "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center text-3xl font-bold shadow-2xl",
            avatarGradient
          )}>
            {getInitials(personName)}
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{personName}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {stats.totalDeals} total deals
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {stats.uniqueCompanies} companies
              </span>
              {stats.firstDeal && stats.lastDeal && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Active: {new Date(stats.firstDeal).getFullYear()} - {new Date(stats.lastDeal).getFullYear()}
                </span>
              )}
            </div>
          </div>

          {/* Follow Button (placeholder for future) */}
          <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
            <Star className="h-4 w-4" />
            Follow
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-xs text-emerald-400 font-medium">{deals.filter(d => d.side === 'BUY').length} deals</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">₹{rupeeCompact(stats.totalBuyValue)}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Buy Value</div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-rose-500/20 rounded-xl">
                <TrendingDown className="h-5 w-5 text-rose-400" />
              </div>
              <span className="text-xs text-rose-400 font-medium">{deals.filter(d => d.side === 'SELL').length} deals</span>
            </div>
            <div className="text-2xl font-bold text-rose-400">₹{rupeeCompact(stats.totalSellValue)}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Sell Value</div>
          </div>

          <div className="bg-zinc-800/50 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Building2 className="h-5 w-5 text-zinc-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.uniqueCompanies}</div>
            <div className="text-xs text-zinc-500 mt-1">Unique Companies</div>
          </div>

          {stats.biggestDeal && (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <Flame className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-xs text-amber-400 font-medium">Biggest Deal</span>
              </div>
              <div className="text-lg font-bold text-amber-400">₹{rupeeCompact((stats.biggestDeal.quantity || 0) * (stats.biggestDeal.price || 0))}</div>
              <div className="text-xs text-zinc-500 mt-1 truncate">{stats.biggestDeal.securityName}</div>
            </div>
          )}
        </div>

        {/* Accumulation Patterns - Stocks being accumulated */}
        {stats.accumulationPatterns.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Accumulation Patterns
              <span className="text-xs text-emerald-400/60 font-normal ml-2">Stocks bought multiple times (more buys than sells)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {stats.accumulationPatterns.map((stock, i) => (
                <Link 
                  key={stock.code || stock.name}
                  href={`/bulk-deals/company/${encodeURIComponent(stock.code || stock.name)}`}
                  className="bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl p-4 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center text-xs font-bold text-black">
                      📈
                    </span>
                    <span className="text-sm font-medium truncate group-hover:text-emerald-300 transition-colors text-emerald-200">
                      {stock.name}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-emerald-400">₹{rupeeCompact(stock.totalBought)}</div>
                  <div className="text-xs text-emerald-400/60">{stock.buyCount} buys (accumulating)</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Top Companies */}
        {stats.topCompanies.length > 0 && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" />
              Top Companies by Value
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {stats.topCompanies.map((company, i) => (
                <Link 
                  key={company.code || company.name}
                  href={`/bulk-deals/company/${encodeURIComponent(company.code || company.name)}`}
                  className="bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-cyan-500/30 rounded-xl p-4 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">
                      {company.name}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white">₹{rupeeCompact(company.value)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-emerald-400">↑{company.buyCount}</span>
                    <span className="text-[10px] text-rose-400">↓{company.sellCount}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Deal History */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" />
              Deal History
            </h2>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              {(['all', 'BUY', 'SELL'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1) }}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filter === f 
                      ? f === 'BUY' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : f === 'SELL' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-white/10 text-white border border-white/20"
                      : "bg-zinc-800/50 text-zinc-400 border border-white/5 hover:bg-zinc-800"
                  )}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-800/50 border-b border-white/5">
                  <th className="text-left py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Company</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Date</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Type</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Quantity</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Price</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-zinc-500">
                      <div className="animate-spin h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      Loading deals...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-zinc-500">
                      No deals found for this investor
                    </td>
                  </tr>
                ) : paginated.map((d, i) => {
                  const value = (d.quantity || 0) * (d.price || 0)
                  const isBigMoney = value >= 1e8 // ₹10 Cr+
                  const dateObj = new Date(d.date)
                  const dateStr = isNaN(dateObj.getTime()) ? d.date : dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  
                  return (
                    <tr key={i} className={clsx(
                      "hover:bg-white/5 transition-colors",
                      isBigMoney && "bg-gradient-to-r from-amber-500/5 to-transparent"
                    )}>
                      <td className="py-4 px-6">
                        <Link 
                          href={`/bulk-deals/company/${encodeURIComponent(d.scripCode || d.securityName)}`}
                          className="text-white font-medium hover:text-cyan-400 transition-colors flex items-center gap-1"
                        >
                          {d.securityName}
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500">{d.scripCode}</span>
                          <span className={clsx(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            d.exchange === "BSE" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                          )}>
                            {d.exchange}
                          </span>
                          {isBigMoney && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                              <Flame className="h-2.5 w-2.5" />
                              BIG
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-zinc-400">{dateStr}</td>
                      <td className="py-4 px-6">
                        <span className={clsx(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold",
                          d.side === "BUY" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        )}>
                          {d.side === "BUY" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {d.side}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-sm text-zinc-300">
                        {(d.quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right text-sm text-zinc-300">
                        ₹{(d.price || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className={clsx(
                          "font-bold text-sm",
                          d.side === "BUY" ? "text-emerald-400" : "text-rose-400"
                        )}>
                          ₹{rupeeCompact(value)}
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
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} deals
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2
                  if (pageNum < 1 || pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={clsx(
                        "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                        pageNum === page 
                          ? "bg-cyan-500 text-white" 
                          : "bg-zinc-800 hover:bg-zinc-700"
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
