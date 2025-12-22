"use client"

import { useState, useEffect } from "react"
import { ShieldAlert, Bell, ChevronRight, AlertCircle, Info } from "lucide-react"
import { clsx } from "clsx"

interface RiskAlert {
  id: string
  ticker: string
  type: string
  title: string
  description: string
  date: string
  priority: 'high' | 'medium' | 'low'
}

export function RiskRadar() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRisks() {
      try {
        // Fetch high-impact announcements which often represent risks or major events
        const res = await fetch("/api/bse/announcements?maxPages=2")
        const data = await res.json()
        
        if (data.announcements) {
          // Filter for high impact or specific categories that represent "risk" or "major events"
          const riskItems = data.announcements
            .filter((a: any) => 
              a.impact === 'high' || 
              ['result', 'acquisition', 'meeting', 'dividend', 'insider'].some(k => a.category?.toLowerCase().includes(k))
            )
            .slice(0, 5)
            .map((a: any) => ({
              id: a.id,
              ticker: a.ticker || a.scripCode,
              type: a.category,
              title: a.category === 'General' ? 'Major Disclosure' : a.category,
              description: a.headline,
              date: new Date(a.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
              priority: a.impact === 'high' ? 'high' : 'medium'
            }))
          
          setAlerts(riskItems)
        }
      } catch (e) {
        console.error("Failed to fetch risk alerts:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchRisks()
    const interval = setInterval(fetchRisks, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Risk Radar</h3>
            <p className="text-[10px] text-zinc-500">Proactive Watchlist Alerts</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center relative">
          <Bell className="h-4 w-4 text-zinc-400" />
          {alerts.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-zinc-950" />
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900/20 animate-pulse border border-zinc-800/10" />
          ))
        ) : alerts.length > 0 ? (
          alerts.map((alert) => (
            <div 
              key={alert.id}
              className={clsx(
                "p-4 rounded-2xl border transition-all cursor-pointer hover:bg-white/5 group",
                alert.priority === 'high' ? "bg-rose-500/5 border-rose-500/20" : "bg-white/5 border-transparent"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-zinc-800 border border-white/10 group-hover:bg-zinc-700 transition-colors">
                  {alert.ticker}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">{alert.date}</span>
              </div>
              
              <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-2">
                {alert.title}
                {alert.priority === 'high' && <AlertCircle className="h-3 w-3 text-rose-500" />}
              </h4>
              
              <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {alert.description}
              </p>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <div className="inline-block h-4 w-4 rounded-full ring-2 ring-zinc-950 bg-rose-500/20" />
                  <div className="inline-block h-4 w-4 rounded-full ring-2 ring-zinc-950 bg-rose-500/10" />
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-zinc-600 italic">No critical risks detected in the last 24h</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center">
        <button className="text-[10px] text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
          <Info className="h-3 w-3" />
          How we detect risks
        </button>
      </div>
    </div>
  )
}
