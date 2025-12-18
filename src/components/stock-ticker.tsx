"use client"

import { useRef, useState, useCallback } from "react"
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react"

export interface TickerStock {
  symbol: string
  price: number
  change: number
  changePercent: number
}

interface StockTickerProps {
  stocks?: TickerStock[]
  onStockClick?: (symbol: string) => void
}

// Default mock stocks for demo
const DEFAULT_STOCKS: TickerStock[] = [
  { symbol: "INFY", price: 1557.75, change: 27.80, changePercent: 1.81 },
  { symbol: "MANYAVAR", price: 607.50, change: -5.85, changePercent: -0.95 },
  { symbol: "AVI", price: 29.89, change: 1.42, changePercent: 4.99 },
  { symbol: "BAJAJFINSV", price: 2083.80, change: 53.55, changePercent: 2.63 },
  { symbol: "CIPLA", price: 1521.55, change: 14.25, changePercent: 0.96 },
  { symbol: "STUDDS", price: 555.45, change: 9.10, changePercent: 1.66 },
  { symbol: "TAKYON", price: 39.48, change: 1.73, changePercent: 4.58 },
  { symbol: "TCS", price: 3162.25, change: 42.30, changePercent: 1.36 },
  { symbol: "HDFCBANK", price: 1845.20, change: -12.45, changePercent: -0.67 },
  { symbol: "RELIANCE", price: 2456.90, change: 34.55, changePercent: 1.43 },
]

export function StockTicker({ stocks, onStockClick }: StockTickerProps) {
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Use provided stocks or defaults
  const tickerStocks = stocks && stocks.length > 0 ? stocks : DEFAULT_STOCKS
  
  // Double the stocks for seamless loop
  const displayStocks = [...tickerStocks, ...tickerStocks]

  // Manual scroll handlers
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }, [])

  return (
    <div 
      className="relative overflow-hidden bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 flex-shrink-0 group/ticker"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left Chevron Button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-transparent opacity-0 group-hover/ticker:opacity-100 transition-opacity"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4 text-zinc-400 hover:text-white transition-colors" />
      </button>

      {/* Right Chevron Button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-zinc-950 via-zinc-950/90 to-transparent opacity-0 group-hover/ticker:opacity-100 transition-opacity"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4 text-zinc-400 hover:text-white transition-colors" />
      </button>

      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide"
      >
        <div 
          ref={containerRef}
          className={`flex items-center gap-6 py-1.5 px-10 ${isPaused ? "" : "animate-ticker"}`}
          style={{ width: "max-content" }}
        >
          {displayStocks.map((stock, i) => {
            const isPositive = stock.change >= 0
            return (
              <button
                key={`${stock.symbol}-${i}`}
                onClick={() => onStockClick?.(stock.symbol)}
                className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity group cursor-pointer"
              >
                <span className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  {stock.symbol}
                </span>
                <span className={`flex items-center gap-0.5 font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="tabular-nums">₹{stock.price.toFixed(2)}</span>
                  <span className="tabular-nums">
                    {isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Simpler non-animated ticker for static display
export function StockTickerStatic({ stocks = DEFAULT_STOCKS, onStockClick }: StockTickerProps) {
  return (
    <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-hide bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
      {stocks.map((stock) => {
        const isPositive = stock.change >= 0
        return (
          <button
            key={stock.symbol}
            onClick={() => onStockClick?.(stock.symbol)}
            className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
          >
            <span className="font-semibold text-white">{stock.symbol}</span>
            <span className={`flex items-center gap-0.5 font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? "↑" : "↓"}
              <span className="tabular-nums">₹{stock.price.toFixed(2)}</span>
              <span className="tabular-nums">
                {isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
