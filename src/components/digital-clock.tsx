"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

export function DigitalClock() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      // Format time as HH:mm (24-hour format)
      const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
      setTime(timeStr)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!time) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/50 border border-white/5 text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
      <Clock className="h-3.5 w-3.5 text-zinc-500" />
      <span className="text-xs font-black font-mono tracking-widest uppercase text-zinc-300">{time}</span>
    </div>
  )
}
