"use client"

import { useState, useEffect } from "react"
import { MousePointer2, TrendingUp, TrendingDown, Info, ShieldCheck, Waves } from "lucide-react"
import { clsx } from "clsx"

interface BulkDeal {
  date: string
  clientName: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  securityName: string
  exchange: string
}

interface InsiderGravityProps {
  scripCode?: string
  ticker?: string
}

export function InsiderGravity({ scripCode, ticker }: InsiderGravityProps) {
  const [deals, setDeals] = useState<BulkDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [sentiment, setSentiment] = useState<'buying' | 'selling' | 'neutral'>('neutral')

  useEffect(() => {
    async function fetchBulkDeals() {
      if (!scripCode && !ticker) {
        setLoading(false)
        return
      }

      try {
        const query = scripCode ? `scripCode=${scripCode}` : `ticker=${ticker}`
        const res = await fetch(`/api/bulk-deals/history?${query}&days=90`)
        if (res.ok) {
          const json = await res.json()
          const data = json.data || []
          
          // Parse data
          const parsedDeals: BulkDeal[] = data.map((d: any) => ({
            date: d.date || d.deal_date,
            clientName: d.clientName || d.client_name,
            side: (d.side || d.deal_type || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
            quantity: d.quantity,
            price: d.price || d.trade_price,
            securityName: d.securityName || d.security_name,
            exchange: d.exchange || 'BSE'
          }))

          setDeals(parsedDeals)

          // Calculate score (-100 to 100)
          if (parsedDeals.length > 0) {
            let buyValue = 0
            let sellValue = 0
            parsedDeals.forEach(d => {
              const val = d.quantity * d.price
              if (d.side === 'BUY') buyValue += val
              else sellValue += val
            })

            const total = buyValue + sellValue
            if (total > 0) {
              const newScore = ((buyValue - sellValue) / total) * 100
              setScore(newScore)
              setSentiment(newScore > 5 ? 'buying' : newScore < -5 ? 'selling' : 'neutral')
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch bulk deals:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchBulkDeals()
  }, [scripCode, ticker])

  const formatValue = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
    return `₹${val.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 animate-pulse h-64 flex items-center justify-center">
        <Waves className="h-8 w-8 text-cyan-500/20 animate-bounce" />
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-500/20 flex items-center justify-center">
            <Waves className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Whale Gravity</h3>
            <p className="text-[10px] text-zinc-500">Bulk & Block Deal Activity</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-xs text-zinc-500">No significant bulk deals detected in the last 90 days.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Waves className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Whale Gravity</h3>
            <p className="text-[10px] text-zinc-500">Institutional Bulk Deals (Last 90 Days)</p>
          </div>
        </div>
        <div className={clsx(
          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter",
          sentiment === 'buying' ? "bg-emerald-500/20 text-emerald-400" :
          sentiment === 'selling' ? "bg-rose-500/20 text-rose-400" :
          "bg-zinc-700 text-zinc-400"
        )}>
          {sentiment === 'neutral' ? 'Balanced' : sentiment}
        </div>
      </div>

      {/* Gravity Meter */}
      <div className="relative h-4 bg-zinc-900 rounded-full overflow-hidden mb-8">
        <div 
          className={clsx(
            "absolute inset-y-0 left-1/2 transition-all duration-1000",
            score >= 0 ? "bg-emerald-500" : "bg-rose-500"
          )}
          style={{ 
            width: `${Math.abs(score) / 2}%`,
            left: score >= 0 ? '50%' : `${50 - Math.abs(score) / 2}%`
          }}
        />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/20 -translate-x-1/2" />
        
        {/* Labels */}
        <div className="absolute -bottom-6 left-0 text-[9px] text-rose-500 font-bold">SELLING</div>
        <div className="absolute -bottom-6 right-0 text-[10px] text-emerald-500 font-bold">BUYING</div>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
        {deals.map((deal, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={clsx(
                "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                deal.side === 'BUY' ? "bg-emerald-500/20" : "bg-rose-500/20"
              )}>
                {deal.side === 'BUY' ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-white truncate pr-2">{deal.clientName}</p>
                <p className="text-[8px] text-zinc-500">{formatDate(deal.date)} • {deal.exchange}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className={clsx(
                "text-[10px] font-bold",
                deal.side === 'BUY' ? "text-emerald-400" : "text-rose-400"
              )}>{deal.side === 'BUY' ? '+' : '-'}{formatValue(deal.quantity * deal.price)}</p>
              <p className="text-[8px] text-zinc-600">Bulk Deal</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
        <Info className="h-3 w-3 text-zinc-600" />
        <p className="text-[9px] text-zinc-500 italic">
          {sentiment === 'buying' 
            ? "Large institutions are accumulating shares in recent sessions."
            : sentiment === 'selling'
            ? "Significant selling pressure from institutional holders."
            : "Mixed institutional sentiment with balanced trade activity."}
        </p>
      </div>
    </div>
  )
}
