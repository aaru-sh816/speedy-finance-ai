"use client"

interface SkeletonLoaderProps {
  variant?: "table" | "card" | "list" | "chart"
  rows?: number
  className?: string
}

export function SkeletonLoader({ variant = "card", rows = 5, className = "" }: SkeletonLoaderProps) {
  if (variant === "table") {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        <div className="h-10 bg-zinc-800/50 rounded-lg w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-zinc-800/30 rounded-lg w-full" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    )
  }
  if (variant === "list") {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-zinc-800/40 rounded-xl w-full" />
        ))}
      </div>
    )
  }
  if (variant === "chart") {
    return (
      <div className={`animate-pulse h-64 flex items-end gap-2 px-4 ${className}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 bg-zinc-800/40 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
        ))}
      </div>
    )
  }
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      <div className="h-6 bg-zinc-800/50 rounded w-1/3" />
      <div className="h-20 bg-zinc-800/40 rounded-xl w-full" />
      <div className="h-20 bg-zinc-800/40 rounded-xl w-4/5" />
      <div className="h-20 bg-zinc-800/40 rounded-xl w-2/3" />
    </div>
  )
}
