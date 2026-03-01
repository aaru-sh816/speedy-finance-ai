"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ message = "Something went wrong", onRetry, className = "" }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`} role="alert">
      <AlertTriangle className="w-12 h-12 text-rose-400 mb-4 opacity-80" />
      <p className="text-zinc-400 font-medium mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-cyan-500/40 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Retry"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  )
}
