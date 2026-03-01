"use client"

import { useState, useEffect } from "react"
import { HelpCircle, X } from "lucide-react"

const STORAGE_KEY = "speedy_onboarding_seen"

interface OnboardingHintProps {
  id: string
  message: string
  position?: "bottom" | "top" | "left" | "right"
  className?: string
}

export function OnboardingHint({ id, message, position = "bottom", className = "" }: OnboardingHintProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      if (!seen[id]) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [id])

  const dismiss = () => {
    setVisible(false)
    setDismissed(true)
    try {
      const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      seen[id] = true
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
    } catch {}
  }

  if (!visible || dismissed) return null

  return (
    <div
      className={`group relative inline-flex items-center gap-1.5 ${className}`}
      role="group"
      aria-describedby={`hint-${id}`}
    >
      <button
        type="button"
        onClick={dismiss}
        className="p-1 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Show hint"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      <div
        id={`hint-${id}`}
        className={`absolute z-50 hidden group-hover:block group-focus-within:block min-w-[200px] max-w-[280px] px-3 py-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl ${
          position === "bottom" ? "top-full left-0 mt-1" : ""
        } ${position === "top" ? "bottom-full left-0 mb-1" : ""} ${
          position === "right" ? "left-full top-0 ml-1" : ""
        } ${position === "left" ? "right-full top-0 mr-1" : ""}`}
      >
        <p>{message}</p>
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 rounded text-zinc-500 hover:text-white"
          aria-label="Dismiss hint"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
