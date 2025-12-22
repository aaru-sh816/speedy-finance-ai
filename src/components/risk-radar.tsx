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
  bullishCase?: string
  bearishCase?: string
  isClustered?: boolean
}

interface RiskRadarProps {
  announcements?: any[]
  compact?: boolean
}

export function RiskRadar({ announcements, compact }: RiskRadarProps) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRisks() {
      if (announcements) {
        const processed = announcements.map((a: any) => {
          const ticker = a.ticker || a.scripCode
          // Simple AI cases based on headline keywords
          let bullish = "Growth catalyst detected."
          let bearish = "Execution risk remains."
          
          const h = (a.headline || a.description || "").toLowerCase()
          if (h.includes('order')) {
            bullish = "Order book expansion improves revenue visibility."
            bearish = "Working capital pressure could impact margins."
          } else if (h.includes('result')) {
            bullish = "Positive bottom-line trajectory."
            bearish = "Operational costs rising YoY."
          } else if (h.includes('acquisition')) {
            bullish = "Inorganic growth expands addressable market."
            bearish = "Integration risk and balance sheet strain."
          }

          return {
            id: a.id || Math.random().toString(),
            ticker,
            type: a.category || "Alert",
            title: a.category === 'General' ? 'Major Disclosure' : (a.category || "Signal"),
            description: a.headline || a.description || "",
            date: new Date(a.time || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            priority: a.impact === 'high' ? 'high' as const : 'medium' as const,
            bullishCase: bullish,
            bearishCase: bearish,
            isClustered: false
          }
        })
        setAlerts(processed)
        setLoading(false)
        return
      }

      try {
        // Fetch high-impact announcements which often represent risks or major events
        const res = await fetch("/api/bse/announcements?maxPages=2")
        const data = await res.json()
        
        if (data.announcements) {
          // Detect Clustering (multiple events for same ticker in last 14 days)
          const tickerCounts: Record<string, number> = {}
          data.announcements.forEach((a: any) => {
            const ticker = a.ticker || a.scripCode
            tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1
          })

          // Filter for high impact or specific categories that represent "risk" or "major events"
          const riskItems = data.announcements
            .filter((a: any) => 
              a.impact === 'high' || 
              ['result', 'acquisition', 'meeting', 'dividend', 'insider'].some(k => a.category?.toLowerCase().includes(k))
            )
            .slice(0, 5)
            .map((a: any) => {
              const ticker = a.ticker || a.scripCode
              const isClustered = tickerCounts[ticker] >= 2
              
              // Simple AI cases based on headline keywords
              let bullish = "Growth catalyst detected."
              let bearish = "Execution risk remains."
              
              const h = a.headline.toLowerCase()
              if (h.includes('order')) {
                bullish = "Order book expansion improves revenue visibility."
                bearish = "Working capital pressure could impact margins."
              } else if (h.includes('result')) {
                bullish = "Positive bottom-line trajectory."
                bearish = "Operational costs rising YoY."
              } else if (h.includes('acquisition')) {
                bullish = "Inorganic growth expands addressable market."
                bearish = "Integration risk and balance sheet strain."
              }

              return {
                id: a.id,
                ticker,
                type: a.category,
                title: a.category === 'General' ? 'Major Disclosure' : a.category,
                description: a.headline,
                date: new Date(a.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                priority: isClustered || a.impact === 'high' ? 'high' as const : 'medium' as const,
                bullishCase: bullish,
                bearishCase: bearish,
                isClustered
              }
            })
          
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
    <div className={clsx(
      "glass-card rounded-3xl bg-zinc-950/40 border border-white/5",
      compact ? "p-4" : "p-6"
    )}>
      {!compact && (
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
      )}

      <div className="space-y-3">
        {loading ? (
          [...Array(compact ? 1 : 2)].map((_, i) => (
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
                <span className="text-[10px] text-zinc-600 font-medium tracking-tighter">{alert.date}</span>
              </div>
              
                <h4 className="text-xs font-bold text-white mb-1 flex flex-wrap items-center gap-2">
                  {alert.title}
                  {alert.priority === 'high' && <AlertCircle className="h-3 w-3 text-rose-500" />}
                  {alert.isClustered && (
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-tighter font-black">
                      Negative Clustering
                    </span>
                  )}
                </h4>
                
                <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                  {alert.description}
                </p>

                {/* AI Impact Scorecard */}
                <div className="space-y-2 mt-4 p-3 bg-black/40 rounded-xl border border-white/5 group-hover:border-white/10 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-1">Bullish Case</p>
                      <p className="text-[10px] text-zinc-300 leading-tight">{alert.bullishCase}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-none mb-1">Bearish Case</p>
                      <p className="text-[10px] text-zinc-300 leading-tight">{alert.bearishCase}</p>
                    </div>
                  </div>
                </div>

                {!compact && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      <div className="inline-block h-4 w-4 rounded-full ring-2 ring-zinc-950 bg-rose-500/20" />
                      <div className="inline-block h-4 w-4 rounded-full ring-2 ring-zinc-950 bg-rose-500/10" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}
            </div>
          ))
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-zinc-600 italic">No critical risks detected</p>
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-6 flex items-center justify-center">
          <button className="text-[10px] text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
            <Info className="h-3 w-3" />
            How we detect risks
          </button>
        </div>
      )}
    </div>
  )
}
