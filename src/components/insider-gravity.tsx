"use client"

import { MousePointer2, TrendingUp, TrendingDown, Info, ShieldCheck } from "lucide-react"
import { clsx } from "clsx"

interface InsiderGravityProps {
  score?: number // -100 to 100
  sentiment?: 'buying' | 'selling' | 'neutral'
  recentTrades?: {
    name: string
    type: 'Buy' | 'Sell'
    value: string
    date: string
  }[]
}

export function InsiderGravity({ score = 65, sentiment = 'buying', recentTrades = [
  { name: 'Promoter Group X', type: 'Buy', value: '₹4.2 Cr', date: '2 days ago' },
  { name: 'Director Y', type: 'Buy', value: '₹85 L', date: '1 week ago' },
] }: InsiderGravityProps) {
  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Insider Gravity</h3>
            <p className="text-[10px] text-zinc-500">Promoter & Director Activity</p>
          </div>
        </div>
        <div className={clsx(
          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter",
          sentiment === 'buying' ? "bg-emerald-500/20 text-emerald-400" :
          sentiment === 'selling' ? "bg-rose-500/20 text-rose-400" :
          "bg-zinc-700 text-zinc-400"
        )}>
          {sentiment}
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

      <div className="space-y-3">
        {recentTrades.map((trade, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "w-6 h-6 rounded-lg flex items-center justify-center",
                trade.type === 'Buy' ? "bg-emerald-500/20" : "bg-rose-500/20"
              )}>
                {trade.type === 'Buy' ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
              </div>
              <div>
                <p className="text-[10px] font-medium text-white truncate max-w-[140px]">{trade.name}</p>
                <p className="text-[8px] text-zinc-500">{trade.date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={clsx(
                "text-[10px] font-bold",
                trade.type === 'Buy' ? "text-emerald-400" : "text-rose-400"
              )}>{trade.type === 'Buy' ? '+' : '-'}{trade.value}</p>
              <p className="text-[8px] text-zinc-600">Insider Trade</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
        <Info className="h-3 w-3 text-zinc-600" />
        <p className="text-[9px] text-zinc-500 italic">
          "Promoters are putting skin in the game during this dip"
        </p>
      </div>
    </div>
  )
}
