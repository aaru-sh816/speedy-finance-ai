"use client"

import { useState, useEffect } from "react"

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] py-2 px-4 bg-amber-500/90 text-black text-center text-[13px] font-medium"
      role="status"
      aria-live="polite"
    >
      Offline — showing cached data
    </div>
  )
}
