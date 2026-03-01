"use client"

import { useRef, useCallback, useEffect } from "react"
import { haptic } from "@/lib/haptic"

interface UseSwipeMonthOptions {
  onNext: () => void
  onPrev: () => void
  threshold?: number
  enabled?: boolean
}

export function useSwipeMonth({
  onNext,
  onPrev,
  threshold = 50,
  enabled = true,
}: UseSwipeMonthOptions) {
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isDragging = useRef(false)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      isDragging.current = false
    },
    [enabled]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || touchStartX.current === null) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - (touchStartY.current ?? 0)
      if (Math.abs(dy) > Math.abs(dx)) return
      if (Math.abs(dx) > 10) isDragging.current = true
    },
    [enabled]
  )

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !isDragging.current || touchStartX.current === null)
        return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(dx) >= threshold) {
        if (dx < 0) {
          haptic.swipeComplete()
          onNext()
        } else {
          haptic.swipeComplete()
          onPrev()
        }
      }
      touchStartX.current = null
      touchStartY.current = null
      isDragging.current = false
    },
    [enabled, onNext, onPrev, threshold]
  )

  const bindRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      el.addEventListener("touchstart", handleTouchStart, { passive: true })
      el.addEventListener("touchmove", handleTouchMove, { passive: true })
      el.addEventListener("touchend", handleTouchEnd, { passive: true })
      return () => {
        el.removeEventListener("touchstart", handleTouchStart)
        el.removeEventListener("touchmove", handleTouchMove)
        el.removeEventListener("touchend", handleTouchEnd)
      }
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd]
  )

  return { bindRef }
}
