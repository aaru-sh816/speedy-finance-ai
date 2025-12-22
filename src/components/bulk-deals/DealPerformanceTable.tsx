"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  ArrowUpRight, ArrowDownRight, ExternalLink, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, BarChart3, Eye, X, Activity, Target
} from "lucide-react"

interface DealWithPerformance {
  date: string
  scripCode: string
  securityName: string
  clientName: string
  side: string
  quantity: number
  price: number
  exchange: string
  currentPrice: number | null
  returnPct: number | null
  absoluteGain: number | null
  dealValue: number
  isWinner: boolean | null
  dayHigh: number | null
  dayLow: number | null
  weekHigh52: number | null
  weekLow52: number | null
  volume: string | null
}

interface Props {
  deals: DealWithPerformance[]
  loading?: boolean
  onSelectDeal?: (deal: DealWithPerformance) => void
}

function rupeeCompact(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "-"
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`
  return `₹${v.toLocaleString("en-IN")}`
}

function clsx(...v: (string | false | undefined)[]) { 
  return v.filter(Boolean).join(" ") 
}

function QuoteComparisonModal({ deal, onClose }: { deal: DealWithPerformance; onClose: () => void }) {
  const isBuy = deal.side?.toUpperCase() === "BUY"
  const hasQuote = deal.currentPrice !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-white/10 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{deal.securityName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-400">{deal.scripCode}</span>
                <span className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  deal.exchange === "BSE" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  {deal.exchange}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Performance Summary */}
          {hasQuote && (
            <div className={clsx(
              "p-4 rounded-xl border",
              deal.isWinner 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-rose-500/5 border-rose-500/20"
            )}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">Performance Since Deal</span>
                <span className={clsx(
                  "px-2 py-1 rounded-lg text-xs font-bold",
                  deal.isWinner ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}>
                  {deal.isWinner ? "🏆 WINNER" : "📉 LOSER"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Return</div>
                  <div className={clsx(
                    "text-xl font-bold",
                    (deal.returnPct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {(deal.returnPct || 0) >= 0 ? "+" : ""}{(deal.returnPct || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">P&L</div>
                  <div className={clsx(
                    "text-xl font-bold",
                    (deal.absoluteGain || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {(deal.absoluteGain || 0) >= 0 ? "+" : ""}{rupeeCompact(deal.absoluteGain)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Deal Value</div>
                  <div className="text-xl font-bold text-white">
                    {rupeeCompact(deal.dealValue)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Price Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Deal Details */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
              <div className="text-xs text-zinc-400 mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Deal Details
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Date</span>
                  <span className="text-xs text-white">{deal.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Price</span>
                  <span className="text-sm font-semibold text-white">₹{deal.price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Quantity</span>
                  <span className="text-xs text-white">{deal.quantity?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Side</span>
                  <span className={clsx(
                    "text-xs font-semibold px-2 py-0.5 rounded",
                    isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  )}>
                    {deal.side}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Quote */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
              <div className="text-xs text-zinc-400 mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Live Quote
              </div>
              {hasQuote ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">Current</span>
                    <span className="text-sm font-semibold text-cyan-400">₹{deal.currentPrice?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">Day High</span>
                    <span className="text-xs text-emerald-400">₹{deal.dayHigh?.toFixed(2) || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">Day Low</span>
                    <span className="text-xs text-rose-400">₹{deal.dayLow?.toFixed(2) || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">52W Range</span>
                    <span className="text-xs text-zinc-300">
                      ₹{deal.weekLow52?.toFixed(0) || "-"} - ₹{deal.weekHigh52?.toFixed(0) || "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
                  Quote unavailable
                </div>
              )}
            </div>
          </div>

          {/* Investor */}
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Investor</div>
                <Link 
                  href={`/bulk-deals/person/${encodeURIComponent(deal.clientName)}`}
                  className="text-sm font-medium text-white hover:text-cyan-400 transition-colors"
                >
                  {deal.clientName}
                </Link>
              </div>
              <Link
                href={`/bulk-deals/person/${encodeURIComponent(deal.clientName)}`}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
              >
                View All Deals →
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 flex items-center justify-between bg-zinc-800/30">
          <Link
            href={`/company/${deal.scripCode}`}
            className="text-xs text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View Company
          </Link>
          <a
            href={`https://www.bseindia.com/stock-share-price/${deal.scripCode}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            BSE Page
          </a>
        </div>
      </div>
    </div>
  )
}

  export function DealPerformanceTable({ deals, loading, onSelectDeal }: Props) {
    const [selectedDeal, setSelectedDeal] = useState<DealWithPerformance | null>(null)
    const [sortBy, setSortBy] = useState<"return" | "value" | "date">("return")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  
    const sortedDeals = [...deals].sort((a, b) => {
      let valA: number, valB: number
      if (sortBy === "return") {
        valA = a.returnPct ?? -999
        valB = b.returnPct ?? -999
      } else if (sortBy === "value") {
        valA = a.dealValue
        valB = b.dealValue
      } else {
        valA = new Date(a.date).getTime()
        valB = new Date(b.date).getTime()
      }
      return sortDir === "desc" ? valB - valA : valA - valB
    })
  
    const toggleSort = (field: "return" | "value" | "date") => {
      if (sortBy === field) {
        setSortDir(sortDir === "desc" ? "asc" : "desc")
      } else {
        setSortBy(field)
        setSortDir("desc")
      }
    }
  
    const handleDealClick = (deal: DealWithPerformance) => {
      setSelectedDeal(deal)
      onSelectDeal?.(deal)
    }

    if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
        <div className="animate-pulse p-6">
          <div className="h-6 w-48 bg-zinc-700 rounded mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800/50 rounded-xl mb-2" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-400" />
            <h3 className="font-semibold text-white">Deal Performance</h3>
            <span className="px-2 py-0.5 rounded-md bg-zinc-700/50 text-[10px] text-zinc-400">
              {deals.length} deals
            </span>
          </div>
          
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort:</span>
            {(["return", "value", "date"] as const).map(field => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={clsx(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                  sortBy === field
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-zinc-800/50 text-zinc-400 border border-white/5 hover:border-white/20"
                )}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortBy === field && (
                  sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="sm:hidden divide-y divide-white/5">
          {sortedDeals.length > 0 ? (
            sortedDeals.slice(0, 20).map((deal, i) => {
              const isBuy = deal.side?.toUpperCase() === "BUY"
              const hasQuote = deal.currentPrice !== null
              
              return (
                  <div 
                    key={i} 
                    className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => handleDealClick(deal)}
                  >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-white text-sm">{deal.securityName}</div>
                      <div className="text-xs text-zinc-500">{deal.clientName}</div>
                    </div>
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {deal.side}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      ₹{deal.price?.toFixed(2)} → {hasQuote ? `₹${deal.currentPrice?.toFixed(2)}` : "-"}
                    </div>
                    {hasQuote && (
                      <span className={clsx(
                        "text-sm font-bold",
                        (deal.returnPct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {(deal.returnPct || 0) >= 0 ? "+" : ""}{(deal.returnPct || 0).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center bg-zinc-900/40">
              <p className="text-xs text-zinc-500 font-medium">No deals found for the selected period.</p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-800/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400">Stock</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-400">Investor</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400">Side</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400">Deal Price</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400">Current</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400">Return</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-400">P&L</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-zinc-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedDeals.length > 0 ? (
                sortedDeals.slice(0, 30).map((deal, i) => {
                  const isBuy = deal.side?.toUpperCase() === "BUY"
                  const hasQuote = deal.currentPrice !== null
                  
                  return (
                    <tr 
                      key={i} 
                      className={clsx(
                        "hover:bg-white/5 transition-colors cursor-pointer",
                        deal.isWinner === true && "bg-emerald-500/5",
                        deal.isWinner === false && "bg-rose-500/5"
                      )}
                        onClick={() => handleDealClick(deal)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-white text-sm">{deal.securityName}</div>
                        <div className="text-[10px] text-zinc-500">{deal.scripCode} • {deal.date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-zinc-300 truncate max-w-[150px]">{deal.clientName}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={clsx(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold",
                          isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}>
                          {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {deal.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-white">₹{deal.price?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-sm text-cyan-400">
                        {hasQuote ? `₹${deal.currentPrice?.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasQuote ? (
                          <span className={clsx(
                            "text-sm font-bold",
                            (deal.returnPct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {(deal.returnPct || 0) >= 0 ? "+" : ""}{(deal.returnPct || 0).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasQuote ? (
                          <span className={clsx(
                            "text-sm font-semibold",
                            (deal.absoluteGain || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {rupeeCompact(deal.absoluteGain)}
                          </span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-cyan-400">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 className="h-8 w-8 text-zinc-700 mb-1" />
                      <p className="text-sm text-zinc-500 font-medium">No deal records found for the requested period.</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Speedy Database: BSE Sync-Ready</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedDeal && (
        <QuoteComparisonModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      )}
    </>
  )
}
