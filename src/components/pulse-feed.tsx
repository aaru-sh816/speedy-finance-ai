"use client"

import { useState, useEffect, useRef } from "react"
import { Zap, Activity, TrendingUp, TrendingDown, Clock, Search, Filter, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { clsx } from "clsx"

interface PulseEvent {
  id: string
  scripCode: string
  ticker: string
  company: string
  headline: string
  time: string
  impact: 'high' | 'medium' | 'low'
  category: string
}

export function PulseFeed() {
  const [events, setEvents] = useState<PulseEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        const res = await fetch("/api/bse/announcements?limit=20")
        if (res.ok) {
          const data = await res.json()
          setEvents(data.announcements || [])
        }
      } catch (e) {
        console.error("Pulse fetch failed:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchPulse()
    const interval = setInterval(fetchPulse, 30000) // 30s refresh
    return () => clearInterval(interval)
  }, [])

  const filteredEvents = events.filter(e => filter === 'all' || e.impact === 'high')

  return (
    <div className="flex flex-col h-full bg-zinc-950/50 rounded-3xl border border-white/5 overflow-hidden glass-panel">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">The Pulse</h3>
            <p className="text-[10px] text-zinc-500">Live Impact Feed</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              "px-2 py-1 text-[10px] rounded transition-all",
              filter === 'all' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('high')}
            className={clsx(
              "px-2 py-1 text-[10px] rounded transition-all",
              filter === 'high' ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            High Impact
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-2"
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
          ))
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <ShieldAlert className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">No high-impact events</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <Link
              key={event.id}
              href={`/company/${event.scripCode}`}
              className={clsx(
                "block p-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]",
                event.impact === 'high' 
                  ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40" 
                  : "bg-white/5 border-transparent hover:border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                    {event.ticker}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate">{event.company}</span>
                </div>
                <span className="text-[9px] text-zinc-600 whitespace-nowrap">
                  {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed font-medium">
                {event.headline}
              </p>
              
              <div className="mt-2 flex items-center justify-between">
                <span className={clsx(
                  "text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold",
                  event.impact === 'high' ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/10 text-zinc-500"
                )}>
                  {event.impact} Impact
                </span>
                <span className="text-[8px] text-zinc-600">{event.category}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-900/60 border-t border-white/5 flex items-center justify-center">
        <button className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1.5 transition-colors">
          <Search className="h-3 w-3" />
          Browse Full History
        </button>
      </div>
    </div>
  )
}
