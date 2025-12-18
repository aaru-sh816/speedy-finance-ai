"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, 
  Users, Calendar, Activity, ChevronLeft, ChevronRight,
  ExternalLink, Building2, Flame, BarChart3
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

type InvestorSummary = {
  name: string
  dealCount: number
  buyValue: number
  sellValue: number
  netValue: number
  lastDeal: string
}

function rupeeCompact(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} crore`
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} lacs`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

export default function CompanyBulkDealsPage() {
  const params = useParams()
  const companyCode = decodeURIComponent(params.code as string)
  
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all')
  const [view, setView] = useState<'deals' | 'investors'>('investors')
  const perPage = 20

  useEffect(() => {
    async function fetchDeals() {
      setLoading(true)
      try {
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
        
        // Filter by company code or name
        const companyDeals = allDeals.filter(d => 
          d.scripCode === companyCode || 
          d.scripCode.toLowerCase() === companyCode.toLowerCase() ||
          d.securityName.toLowerCase().includes(companyCode.toLowerCase())
        )
        
        companyDeals.sort((a, b) => b.date.localeCompare(a.date))
        setDeals(companyDeals)
      } catch (err) {
        console.error('Failed to fetch deals:', err)
      } finally {
        setLoading(false)
      }
    }
    
    if (companyCode) fetchDeals()
  }, [companyCode])

  // Calculate stats
  const stats = useMemo(() => {
    const buyDeals = deals.filter(d => d.side === 'BUY')
    const sellDeals = deals.filter(d => d.side === 'SELL')
    
    const buyValue = buyDeals.reduce((sum, d) => sum + (d.quantity || 0) * (d.price || 0), 0)
    const sellValue = sellDeals.reduce((sum, d) => sum + (d.quantity || 0) * (d.price || 0), 0)
    
    const investors = new Map<string, InvestorSummary>()
    for (const d of deals) {
      const existing = investors.get(d.clientName) || {
        name: d.clientName,
        dealCount: 0,
        buyValue: 0,
        sellValue: 0,
        netValue: 0,
        lastDeal: ''
      }
      existing.dealCount++
      const value = (d.quantity || 0) * (d.price || 0)
      if (d.side === 'BUY') {
        existing.buyValue += value
        existing.netValue += value
      } else {
        existing.sellValue += value
        existing.netValue -= value
      }
      if (!existing.lastDeal || d.date > existing.lastDeal) {
        existing.lastDeal = d.date
      }
      investors.set(d.clientName, existing)
    }
    
    const dates = deals.map(d => d.date).filter(Boolean).sort()
    const companyName = deals[0]?.securityName || companyCode
    
    return {
      companyName,
      totalDeals: deals.length,
      totalBuyValue: buyValue,
      totalSellValue: sellValue,
      netFlow: buyValue - sellValue,
      uniqueInvestors: investors.size,
      firstDeal: dates[0] || '',
      lastDeal: dates[dates.length - 1] || '',
      investors: Array.from(investors.values()).sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue)),
    }
  }, [deals, companyCode])

  // Filtered and paginated
  const filtered = useMemo(() => {
    if (filter === 'all') return deals
    return deals.filter(d => d.side === filter)
  }, [deals, filter])
  
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

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
        {/* Header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Building2 className="h-8 w-8" />
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{stats.companyName}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                {stats.totalDeals} bulk deals
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {stats.uniqueInvestors} investors
              </span>
              {stats.firstDeal && stats.lastDeal && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(stats.firstDeal).getFullYear()} - {new Date(stats.lastDeal).getFullYear()}
                </span>
              )}
            </div>
          </div>

          <a 
            href={`https://www.bseindia.com/stock-share-price/x/${companyCode}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            BSE Page
          </a>
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
            <div className="text-xs text-zinc-500 mt-1">Total Buying</div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-rose-500/20 rounded-xl">
                <TrendingDown className="h-5 w-5 text-rose-400" />
              </div>
              <span className="text-xs text-rose-400 font-medium">{deals.filter(d => d.side === 'SELL').length} deals</span>
            </div>
            <div className="text-2xl font-bold text-rose-400">₹{rupeeCompact(stats.totalSellValue)}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Selling</div>
          </div>

          <div className={clsx(
            "border rounded-2xl p-5",
            stats.netFlow >= 0 
              ? "bg-emerald-500/10 border-emerald-500/20" 
              : "bg-rose-500/10 border-rose-500/20"
          )}>
            <div className="flex items-center gap-3 mb-3">
              <div className={clsx(
                "p-2 rounded-xl",
                stats.netFlow >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
              )}>
                <Activity className={clsx("h-5 w-5", stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400")} />
              </div>
              <span className={clsx("text-xs font-medium", stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {stats.netFlow >= 0 ? 'Net Inflow' : 'Net Outflow'}
              </span>
            </div>
            <div className={clsx("text-2xl font-bold", stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400")}>
              ₹{rupeeCompact(Math.abs(stats.netFlow))}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Buy - Sell</div>
          </div>

          <div className="bg-zinc-800/50 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Users className="h-5 w-5 text-zinc-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.uniqueInvestors}</div>
            <div className="text-xs text-zinc-500 mt-1">Unique Investors</div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('investors')}
            className={clsx(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
              view === 'investors' 
                ? "bg-cyan-500 text-white" 
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Users className="h-4 w-4" />
            Top Investors
          </button>
          <button
            onClick={() => setView('deals')}
            className={clsx(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
              view === 'deals' 
                ? "bg-cyan-500 text-white" 
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Activity className="h-4 w-4" />
            All Deals
          </button>
        </div>

        {/* Investors View */}
        {view === 'investors' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-400" />
                Who's Buying & Selling
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-white/5">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Investor</th>
                    <th className="text-center py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Deals</th>
                    <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Bought</th>
                    <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Sold</th>
                    <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Net Position</th>
                    <th className="text-right py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Last Deal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-500">
                        <div className="animate-spin h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        Loading...
                      </td>
                    </tr>
                  ) : stats.investors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-500">
                        No bulk deals found for this company
                      </td>
                    </tr>
                  ) : stats.investors.slice(0, 20).map((inv, i) => {
                    const isNetBuyer = inv.netValue > 0
                    const dateObj = new Date(inv.lastDeal)
                    const dateStr = isNaN(dateObj.getTime()) ? inv.lastDeal : dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    
                    return (
                      <tr key={inv.name} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6">
                          <Link 
                            href={`/bulk-deals/person/${encodeURIComponent(inv.name)}`}
                            className="text-white font-medium hover:text-cyan-400 transition-colors flex items-center gap-2"
                          >
                            <span className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            {inv.name}
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </Link>
                        </td>
                        <td className="py-4 px-6 text-center text-sm text-zinc-400">
                          {inv.dealCount}
                        </td>
                        <td className="py-4 px-6 text-right text-sm text-emerald-400">
                          {inv.buyValue > 0 ? `₹${rupeeCompact(inv.buyValue)}` : '-'}
                        </td>
                        <td className="py-4 px-6 text-right text-sm text-rose-400">
                          {inv.sellValue > 0 ? `₹${rupeeCompact(inv.sellValue)}` : '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold",
                            isNetBuyer 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : "bg-rose-500/10 text-rose-400"
                          )}>
                            {isNetBuyer ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            ₹{rupeeCompact(Math.abs(inv.netValue))}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right text-sm text-zinc-500">
                          {dateStr}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deals View */}
        {view === 'deals' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-400" />
                Deal History
              </h2>
              
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
                    <th className="text-left py-3 px-6 text-xs font-semibold text-zinc-400 uppercase">Investor</th>
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
                        Loading...
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-500">
                        No deals found
                      </td>
                    </tr>
                  ) : paginated.map((d, i) => {
                    const value = (d.quantity || 0) * (d.price || 0)
                    const isBigMoney = value >= 1e8
                    const dateObj = new Date(d.date)
                    const dateStr = isNaN(dateObj.getTime()) ? d.date : dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    
                    return (
                      <tr key={i} className={clsx(
                        "hover:bg-white/5 transition-colors",
                        isBigMoney && "bg-gradient-to-r from-amber-500/5 to-transparent"
                      )}>
                        <td className="py-4 px-6">
                          <Link 
                            href={`/bulk-deals/person/${encodeURIComponent(d.clientName)}`}
                            className="text-white font-medium hover:text-cyan-400 transition-colors flex items-center gap-1"
                          >
                            {d.clientName}
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </Link>
                          {isBigMoney && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400 mt-1">
                              <Flame className="h-2.5 w-2.5" />
                              BIG MONEY
                            </span>
                          )}
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
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
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
                          pageNum === page ? "bg-cyan-500 text-white" : "bg-zinc-800 hover:bg-zinc-700"
                        )}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
