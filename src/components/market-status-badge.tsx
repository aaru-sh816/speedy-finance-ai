"use client"

import { useEffect, useState } from "react"

const REFETCH_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches GET /api/market/status and shows a small "Open" / "Closed" badge.
 * NSE market state is derived from the first item in the response array.
 * Refetches periodically so the badge stays accurate.
 */
export function MarketStatusBadge() {
  const [status, setStatus] = useState<"open" | "closed" | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchStatus = () => {
      fetch("/api/market/status", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return
          const arr = data?.data
          if (Array.isArray(arr) && arr.length > 0) {
            const first = arr[0] as Record<string, unknown>
            const state = (first?.market ?? first?.state ?? first?.segment ?? "").toString().toLowerCase()
            setStatus(state.includes("open") || state === "active" ? "open" : "closed")
          } else {
            setStatus(null)
          }
        })
        .catch(() => {
          if (!cancelled) setStatus(null)
        })
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, REFETCH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (status === null) return null

  const label = status === "open" ? "Market open" : "Market closed"
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
        status === "open"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
      }`}
      title={label}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} aria-hidden />
      {status === "open" ? "Live" : "Closed"}
    </span>
  )
}
