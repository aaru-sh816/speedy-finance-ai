"use client"

import { useState, useEffect } from "react"
import { AlertCircle, TrendingUp, TrendingDown, Sparkles } from "lucide-react"
import { clsx } from "clsx"

interface DrivingEventBadgeProps {
  symbol: string
  scripCode: string
  changePercent: number
  announcements: any[]
  className?: string
}

export function DrivingEventBadge({ symbol, scripCode, changePercent, announcements, className }: DrivingEventBadgeProps) {
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchAttribution = async () => {
      // Only fetch if price move is significant (>2%)
      if (Math.abs(changePercent) < 2 || announcements.length === 0) return

      setLoading(true)
      try {
        const res = await fetch("/api/ai/attribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            changePercent,
            announcements: announcements.slice(0, 5) // Use latest 5
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.reason && data.reason !== 'Market sentiment') {
            setReason(data.reason)
          }
        }
      } catch (e) {
        console.error("Failed to fetch driving event:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchAttribution()
  }, [symbol, scripCode, changePercent, announcements])

  if (!reason && !loading) return null

  return (
    <div className={clsx(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-500",
      changePercent >= 0 
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
        : "bg-rose-500/10 border-rose-500/30 text-rose-400",
      className
    )}>
      <div className="flex items-center gap-1.5">
        {loading ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        )}
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">
          Driving Event
        </span>
      </div>
      <div className="w-px h-3 bg-current opacity-20" />
      <span className="text-xs font-semibold whitespace-nowrap">
        {loading ? "Analyzing move..." : reason}
      </span>
    </div>
  )
}
