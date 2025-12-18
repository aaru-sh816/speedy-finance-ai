"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"

interface TradingViewChartProps {
  symbol: string | null | undefined
  exchange?: "BSE" | "NSE"
  height?: number
  theme?: "light" | "dark"
  interval?: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M"
  fallbackMessage?: string
}

export function TradingViewChart({
  symbol,
  exchange = "BSE",
  height = 300,
  theme = "dark",
  interval = "D",
  fallbackMessage,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasError, setHasError] = useState(false)
  const containerIdRef = useRef(`tradingview_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  // Validate symbol - must be alphanumeric (not just digits)
  const isValidSymbol = symbol && /^[A-Z0-9&-]+$/i.test(symbol) && !/^\d+$/.test(symbol)

  useEffect(() => {
    if (!containerRef.current || !isValidSymbol) return
    setHasError(false)

    // Clear previous chart
    containerRef.current.innerHTML = ""

    // Create script element for TradingView widget
    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/tv.js"
    script.async = true
    script.onload = () => {
      if (typeof (window as any).TradingView !== "undefined" && containerRef.current) {
        try {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: `${exchange}:${symbol}`,
            interval: interval,
            timezone: "Asia/Kolkata",
            theme: theme,
            // 2 = Area style
            style: "2",
            locale: "en",
            toolbar_bg: theme === "dark" ? "#1a1a1a" : "#f1f3f6",
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            container_id: containerIdRef.current,
            hide_volume: true,
            studies: [],
            show_popup_button: true,
            popup_width: "1000",
            popup_height: "650",
          })
        } catch (e) {
          console.error("TradingView widget error:", e)
          setHasError(true)
        }
      }
    }
    script.onerror = () => setHasError(true)

    document.head.appendChild(script)

    return () => {
      // Cleanup
      try {
        document.head.removeChild(script)
      } catch (e) {
        // Script may have already been removed
      }
    }
  }, [symbol, exchange, theme, interval, isValidSymbol])

  // Show fallback if symbol is invalid or numeric-only
  if (!isValidSymbol) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/50">
        <div 
          style={{ height: `${height}px` }}
          className="flex flex-col items-center justify-center gap-3 text-zinc-500"
        >
          <AlertTriangle className="h-8 w-8 text-amber-500/60" />
          <p className="text-sm text-center px-4">
            {fallbackMessage || "Chart unavailable for this stock"}
          </p>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${exchange}%3A${symbol || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
          >
            Open TradingView <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-zinc-800">
      <div
        id={containerIdRef.current}
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="w-full bg-zinc-900"
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90">
          <div className="text-center text-zinc-500">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-500/60" />
            <p className="text-sm">Failed to load chart</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Simple mini chart using TradingView embed URL
 * Lighter weight alternative
 */
export function TradingViewMiniChart({
  symbol,
  exchange = "BSE",
  height = 200,
}: {
  symbol: string
  exchange?: "BSE" | "NSE"
  height?: number
}) {
  const chartUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${exchange}%3A${symbol}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=18181b&studies=[]&theme=dark&style=2&timezone=Asia%2FKolkata&withdateranges=0&hidevolume=1`

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-zinc-800">
      <iframe
        src={chartUrl}
        style={{ height: `${height}px` }}
        className="w-full bg-zinc-900"
        frameBorder="0"
        scrolling="no"
      />
    </div>
  )
}

/**
 * Lightweight chart placeholder with timeframe buttons
 */
export function ChartPlaceholder({
  symbol,
  exchange = "BSE",
  onOpenChart,
}: {
  symbol: string
  exchange?: "BSE" | "NSE"
  onOpenChart?: () => void
}) {
  const timeframes = ["1D", "3D", "1W", "1M", "3M", "6M"]
  const chartUrl = `https://www.tradingview.com/chart/?symbol=${exchange}%3A${symbol}`

  return (
    <div className="relative w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Timeframe buttons */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <input type="checkbox" id="tickData" className="mr-1" />
          <label htmlFor="tickData" className="text-xs text-zinc-400">Tick Data</label>
        </div>
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              className="px-2 py-1 text-xs rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[180px] flex items-center justify-center bg-zinc-900/30 rounded-lg">
        <a
          href={chartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center"
          onClick={onOpenChart}
        >
          <div className="text-4xl mb-2">📈</div>
          <span className="text-sm text-zinc-400 hover:text-cyan-400 transition-colors">
            View {symbol} Chart on TradingView
          </span>
        </a>
      </div>

      {/* TradingView attribution */}
      <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-zinc-500">
        <span>Powered by</span>
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-500 hover:text-cyan-400"
        >
          TradingView
        </a>
      </div>
    </div>
  )
}
