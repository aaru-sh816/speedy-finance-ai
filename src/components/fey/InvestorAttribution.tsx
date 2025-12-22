"use client"

import { useState, useEffect } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search,
  Zap,
  Filter,
  Users,
  Activity
} from "lucide-react"
import { FeyCard } from "./FeyCard"
import { cn } from "@/lib/utils"

interface AttributeDeal {
  clientName: string
  securityName: string
  scripCode: string
  side: string
  dealPrice: number
  currentPrice: number | null
  changePct: number | null
  quantity: number
  influenceScore?: number
}

export function InvestorAttribution() {
  const [deals, setDeals] = useState<AttributeDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL")

  useEffect(() => {
    fetchDeals()
  }, [])

  async function fetchDeals() {
    try {
      const res = await fetch("/api/bulk-deals/yesterday-movers")
      const data = await res.json()
      if (data.success) {
        // Add influence score logic (simulated for now)
        const enrichedDeals = data.deals.map((d: any) => ({
          ...d,
          influenceScore: Math.random() * 100 // Simulate influence based on quantity/price action
        }))
        setDeals(enrichedDeals)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredDeals = deals.filter(d => {
    const matchesSearch = d.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         d.securityName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSide = filter === "ALL" || d.side === filter
    return matchesSearch && matchesSide
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
          <input 
            type="text"
            placeholder="Search superstar investors..."
            className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 backdrop-blur-xl transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl">
          {["ALL", "BUY", "SELL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-medium transition-all",
                filter === f 
                  ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]" 
                  : "text-zinc-500 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-zinc-900/40 animate-pulse border border-zinc-800/20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal, idx) => (
            <AttributionCard key={`${deal.scripCode}-${idx}`} deal={deal} />
          ))}
        </div>
      )}
    </div>
  )
}

function AttributionCard({ deal }: { deal: AttributeDeal }) {
  const isPositive = (deal.changePct || 0) >= 0
  const isBuy = deal.side === "BUY"

  return (
    <FeyCard variant="hover" className="p-0 border-none group">
      <div className="p-6 relative">
        {/* Influence Score Badge */}
        <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/50 rounded-full border border-zinc-800/50">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-bold text-zinc-400">
            {Math.round(deal.influenceScore || 0)} Influence
          </span>
        </div>

        {/* Investor Profile */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-zinc-700/30 group-hover:border-cyan-500/30 transition-colors">
            <Users className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
              {deal.clientName}
            </h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded",
                isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                {deal.side}
              </span>
              <span className="text-[10px] text-zinc-500">
                {deal.quantity.toLocaleString()} shares
              </span>
            </div>
          </div>
        </div>

        {/* Stock Performance */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-zinc-950/30 rounded-2xl border border-zinc-800/10">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">Stock</p>
              <p className="text-sm font-bold text-white truncate w-32">{deal.securityName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 mb-1">Deal Price</p>
              <p className="text-sm font-bold text-zinc-300">₹{deal.dealPrice.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-zinc-950/30 rounded-2xl border border-zinc-800/10 flex flex-col justify-between">
              <p className="text-[10px] text-zinc-500">Live Price</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg font-bold text-white">₹{deal.currentPrice?.toFixed(2) || "—"}</span>
              </div>
            </div>
            <div className={cn(
              "p-3 rounded-2xl border flex flex-col justify-between transition-colors",
              isPositive 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-rose-500/5 border-rose-500/20"
            )}>
              <p className="text-[10px] text-zinc-500">Performance</p>
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                )}
                <span className={cn(
                  "text-lg font-bold",
                  isPositive ? "text-emerald-400" : "text-rose-400"
                )}>
                  {deal.changePct ? `${Math.abs(deal.changePct).toFixed(2)}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-bold text-white uppercase tracking-widest transition-all group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
          View Detailed Influence
        </button>
      </div>
    </FeyCard>
  )
}
