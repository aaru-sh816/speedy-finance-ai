"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface TimelineDeal {
  date: string
  side: string
  price: number
  quantity: number
}

interface WhaleTimelineProps {
  deals: TimelineDeal[]
  currentPrice?: number | null
  scripCode?: string
  investorName?: string
  className?: string
}

export function WhaleTimeline({ deals, currentPrice, scripCode, investorName, className }: WhaleTimelineProps) {
  // Sort deals by date
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [deals])

  const stats = useMemo(() => {
    let totalBuyQty = 0
    let totalBuyValue = 0
    let totalSellQty = 0
    let totalSellValue = 0

    sortedDeals.forEach(d => {
      if (d.side === "BUY") {
        totalBuyQty += d.quantity
        totalBuyValue += d.quantity * d.price
      } else {
        totalSellQty += d.quantity
        totalSellValue += d.quantity * d.price
      }
    })

    const avgBuyPrice = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0
    const netQty = totalBuyQty - totalSellQty
    
    return {
      avgBuyPrice,
      netQty,
      isHolding: netQty > 0,
      discountPct: (currentPrice || deals[0]?.price) && avgBuyPrice > 0 
        ? ((avgBuyPrice - (currentPrice || deals[0]?.price)) / avgBuyPrice) * 100 
        : null
    }
  }, [sortedDeals, currentPrice, deals])

  if (deals.length === 0) return null

  return (
    <div className={cn("space-y-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5", className)}>
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-tight">
            {investorName || "Institutional"} Tracking
          </h4>
          <p className="text-[10px] text-zinc-500">{scripCode ? `BSE: ${scripCode}` : "Whale Path"}</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Average Cost</p>
          <p className="text-sm font-bold text-white">₹{stats.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        {stats.isHolding && stats.discountPct !== null && stats.discountPct > 0 && (
          <div className="text-right">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
              DISCOUNT ZONE: {stats.discountPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Visual Timeline */}
      <div className="relative h-12 flex items-center group/timeline">
        {/* Track */}
        <div className="absolute inset-x-0 h-[1px] bg-zinc-800 group-hover/timeline:bg-zinc-700 transition-colors" />
        
        {/* Deal Markers */}
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
                    {new Date(deal.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}: {deal.side} @ ₹{deal.price}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
