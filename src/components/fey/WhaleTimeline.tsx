"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Users, Calculator, Calendar, BarChart2 } from "lucide-react"

interface TimelineDeal {
  date: string
  side: string
  price: number
  quantity: number
  clientName?: string
}

interface WhaleTimelineProps {
  deals: TimelineDeal[]
  currentPrice?: number | null
  scripCode?: string
  investorName?: string
  className?: string
  totalShares?: number
}

export function WhaleTimeline({ deals, currentPrice, scripCode, investorName, className, totalShares }: WhaleTimelineProps) {
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [deals])

  const stats = useMemo(() => {
    let totalBuyQty = 0
    let totalBuyValue = 0
    let totalSellQty = 0
    let totalSellValue = 0
    const uniqueInvestors = new Set<string>()

    sortedDeals.forEach(d => {
      if (d.clientName) uniqueInvestors.add(d.clientName)
      if (d.side === "BUY") {
        totalBuyQty += d.quantity
        totalBuyValue += d.quantity * d.price
      } else {
        totalSellQty += d.quantity
        totalSellValue += d.quantity * d.price
      }
    })

    const avgBuyPrice = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0
    const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0
    const netQty = totalBuyQty - totalSellQty
    const netValue = totalBuyValue - totalSellValue
    
    const holdingPct = totalShares && netQty > 0 ? (netQty / totalShares) * 100 : null
    
    const currentValue = currentPrice && netQty > 0 ? netQty * currentPrice : null
    const costBasis = avgBuyPrice * netQty
    const unrealizedPnL = currentValue && costBasis ? currentValue - costBasis : null
    const unrealizedPnLPct = costBasis && unrealizedPnL ? (unrealizedPnL / costBasis) * 100 : null
    
    const discountPct = (currentPrice || deals[0]?.price) && avgBuyPrice > 0 
      ? ((avgBuyPrice - (currentPrice || deals[0]?.price)) / avgBuyPrice) * 100 
      : null
    
    const firstEntryDate = sortedDeals.length > 0 ? sortedDeals[0].date : null
    const lastActivityDate = sortedDeals.length > 0 ? sortedDeals[sortedDeals.length - 1].date : null
    const holdingDays = firstEntryDate ? Math.floor((Date.now() - new Date(firstEntryDate).getTime()) / (1000 * 60 * 60 * 24)) : null
    
    return {
      avgBuyPrice,
      avgSellPrice,
      netQty,
      netValue,
      totalBuyQty,
      totalSellQty,
      isHolding: netQty > 0,
      discountPct,
      holdingPct,
      unrealizedPnL,
      unrealizedPnLPct,
      firstEntryDate,
      lastActivityDate,
      holdingDays,
      uniqueInvestorCount: uniqueInvestors.size
    }
  }, [sortedDeals, currentPrice, deals, totalShares])

  if (deals.length === 0) return null

  return (
    <div className={cn("space-y-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-tight">
            {investorName || "Institutional"} Tracking
          </h4>
          <p className="text-[10px] text-zinc-500">{scripCode ? `BSE: ${scripCode}` : "Whale Path"}</p>
        </div>
        {stats.uniqueInvestorCount > 1 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Users className="h-3 w-3 text-purple-400" />
            <span className="text-[10px] font-bold text-purple-400">{stats.uniqueInvestorCount} investors</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Calculator className="h-3 w-3 text-cyan-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Avg Cost</p>
          </div>
          <p className="text-sm font-bold text-white">
            {stats.avgBuyPrice.toLocaleString(undefined, { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })}
          </p>
          {stats.discountPct !== null && stats.discountPct > 0 && (
            <p className="text-[10px] text-emerald-400 mt-0.5">
              CMP {stats.discountPct.toFixed(1)}% below cost
            </p>
          )}
          {stats.discountPct !== null && stats.discountPct < 0 && (
            <p className="text-[10px] text-emerald-400 mt-0.5">
              CMP {Math.abs(stats.discountPct).toFixed(1)}% above cost
            </p>
          )}
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 className="h-3 w-3 text-purple-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Net Position</p>
          </div>
          <p className={cn(
            "text-sm font-bold",
            stats.netQty > 0 ? "text-emerald-400" : stats.netQty < 0 ? "text-rose-400" : "text-zinc-400"
          )}>
            {stats.netQty > 0 ? "+" : ""}{(stats.netQty / 100000).toFixed(2)}L shares
          </p>
          {stats.holdingPct !== null && (
            <p className="text-[10px] text-cyan-400 mt-0.5">
              ~{stats.holdingPct.toFixed(2)}% of total shares
            </p>
          )}
        </div>
      </div>

      {stats.unrealizedPnL !== null && (
        <div className={cn(
          "p-3 rounded-xl border",
          stats.unrealizedPnL >= 0 
            ? "bg-emerald-500/5 border-emerald-500/20" 
            : "bg-rose-500/5 border-rose-500/20"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">Unrealized P&L</p>
              <div className="flex items-center gap-2">
                {stats.unrealizedPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                )}
                <span className={cn(
                  "text-lg font-bold",
                  stats.unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {stats.unrealizedPnL >= 0 ? "+" : ""}
                  {(stats.unrealizedPnL / 10000000).toFixed(2)} Cr
                </span>
              </div>
            </div>
            {stats.unrealizedPnLPct !== null && (
              <div className={cn(
                "px-3 py-1.5 rounded-lg",
                stats.unrealizedPnLPct >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
              )}>
                <span className={cn(
                  "text-sm font-bold",
                  stats.unrealizedPnLPct >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {stats.unrealizedPnLPct >= 0 ? "+" : ""}{stats.unrealizedPnLPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {stats.holdingDays !== null && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>First entry: {new Date(stats.firstEntryDate!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Holding {stats.holdingDays}+ days
          </span>
        </div>
      )}

      {stats.isHolding && stats.discountPct !== null && stats.discountPct > 5 && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
            DISCOUNT ZONE: Current price {stats.discountPct.toFixed(1)}% below whale cost basis
          </span>
        </div>
      )}

      <div className="relative h-12 flex items-center group/timeline">
        <div className="absolute inset-x-0 h-[1px] bg-zinc-800 group-hover/timeline:bg-zinc-700 transition-colors" />
        
        <div className="flex-1 flex justify-between relative px-2">
          {sortedDeals.slice(-5).map((deal, i) => {
            const isBuy = deal.side === "BUY"
            return (
              <div 
                key={i} 
                className="relative flex flex-col items-center group/marker"
              >
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full border-2 border-zinc-950 transition-all group-hover/marker:scale-150",
                    isBuy ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                  )} 
                />
                <div className="absolute top-4 opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                  <div className="bg-zinc-900 border border-white/5 px-2 py-1 rounded text-[9px] font-bold text-white shadow-2xl">
                    {new Date(deal.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}: {deal.side} @ {deal.price.toLocaleString(undefined, { style: 'currency', currency: 'INR' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-emerald-400">Total Bought</span>
          <span className="font-bold text-emerald-300">{(stats.totalBuyQty / 100000).toFixed(2)}L</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-rose-500/10 border border-rose-500/20">
          <span className="text-rose-400">Total Sold</span>
          <span className="font-bold text-rose-300">{(stats.totalSellQty / 100000).toFixed(2)}L</span>
        </div>
      </div>
    </div>
  )
}
