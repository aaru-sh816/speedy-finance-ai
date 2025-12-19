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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
      <Clock className="h-3.5 w-3.5" />
      <span className="text-xs font-medium font-mono tracking-wider">{time}</span>
    </div>
  )
}
