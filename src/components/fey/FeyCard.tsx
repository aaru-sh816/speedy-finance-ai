"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FeyCardProps {
  children: ReactNode
  variant?: "default" | "gradient" | "hover"
  className?: string
  onClick?: () => void
}

export function FeyCard({ 
  children, 
  variant = "default",
  className,
  onClick 
}: FeyCardProps) {
  return (
    <div
      onClick={onClick}
className={cn(
"group relative overflow-hidden rounded-2xl p-6",
"border transition-all duration-500",
variant === "default" && "bg-zinc-900/40 backdrop-blur-2xl border-zinc-800/20 hover:border-zinc-700/40 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
variant === "gradient" && "bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 backdrop-blur-2xl border-zinc-800/30 hover:border-zinc-700/50 shadow-2xl",
variant === "hover" && "bg-zinc-900/40 backdrop-blur-2xl border-zinc-800/20 hover:border-cyan-500/30 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] cursor-pointer",
onClick && "cursor-pointer active:scale-[0.98]",
className
)}
>
{children}

{/* Subtle glow on hover */}
{variant === "hover" && (
<div className="absolute inset-0 bg-gradient-to-tr 
from-cyan-500/5 via-transparent to-purple-500/5 
opacity-0 group-hover:opacity-100 
transition-opacity duration-500 pointer-events-none" />
)}

{/* Decorative elements */}
<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
<div className="w-16 h-16 bg-gradient-to-br from-white to-transparent rounded-full blur-3xl" />
</div>
</div>
)
}


interface FeyStockCardProps {
  symbol: string
  companyName: string
  price: number
  change: number
  changePercent: number
  onClick?: () => void
}

export function FeyStockCard({
  symbol,
  companyName,
  price,
  change,
  changePercent,
  onClick
}: FeyStockCardProps) {
  const isPositive = change >= 0
  const colorClass = isPositive ? "text-emerald-400" : "text-rose-400"
  const bgClass = isPositive ? "from-emerald-500 to-emerald-600" : "from-rose-500 to-rose-600"

  return (
    <FeyCard variant="hover" onClick={onClick}>
      {/* Company Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
        "bg-gradient-to-br shadow-lg",
        bgClass
      )}>
        <span className="text-white font-bold text-xl">
          {symbol.charAt(0)}
        </span>
      </div>

      {/* Company Info */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-zinc-400">{symbol}</h3>
        <p className="text-xs text-zinc-600 truncate">{companyName}</p>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-white">₹{price.toFixed(2)}</span>
      </div>

      {/* Change */}
      <div className={cn("flex items-center gap-1.5", colorClass)}>
        <svg 
          className="w-4 h-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          {isPositive ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          )}
        </svg>
        <span className="text-sm font-semibold">{Math.abs(changePercent).toFixed(2)}%</span>
        <span className="text-xs text-zinc-500">₹{Math.abs(change).toFixed(2)}</span>
      </div>
    </FeyCard>
  )
}
