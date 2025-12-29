"use client"

// Market Depth Component
import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronUp, ChevronDown, Info, TrendingUp, TrendingDown } from "lucide-react"
import { getMarketStatus } from "@/lib/bse/market-hours"

interface DepthLevel {
  price: number
  quantity: number
  percent: number
}

interface MarketDepthProps {
  scripCode?: string
  currentPrice: number | null
  realDepth?: {
    buy: Record<string, { quantity: string; price: string }>
    sell: Record<string, { quantity: string; price: string }>
  } | null
  className?: string
}

export function MarketDepth({ scripCode, currentPrice, realDepth, className = "" }: MarketDepthProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMarketOpen, setIsMarketOpen] = useState(true)
  const [data, setData] = useState<{
    bids: DepthLevel[]
    asks: DepthLevel[]
    buyTotal: number
    sellTotal: number
    buyPercent: number
    sellPercent: number
    imbalance: number
  } | null>(null)

  // Check market hours (9:15 AM - 3:30 PM IST, Weekdays)
  useEffect(() => {
    const checkMarketHours = () => {
      const status = getMarketStatus();
      setIsMarketOpen(status.isOpen);
    };

    checkMarketHours();
    const interval = setInterval(checkMarketHours, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Process depth data (only real data)
  useEffect(() => {
    // If we have real depth data, use it
    if (realDepth && Object.keys(realDepth.buy).length > 0) {
      const bids: DepthLevel[] = Object.values(realDepth.buy).map(item => ({
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity.replace(/,/g, '')),
        percent: 0
      })).filter(b => !isNaN(b.price) && !isNaN(b.quantity))

      const asks: DepthLevel[] = Object.values(realDepth.sell).map(item => ({
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity.replace(/,/g, '')),
        percent: 0
      })).filter(a => !isNaN(a.price) && !isNaN(a.quantity))

      if (bids.length === 0 && asks.length === 0) {
        setData(null)
        return
      }

      const buyTotal = bids.reduce((acc, b) => acc + b.quantity, 0)
      const sellTotal = asks.reduce((acc, a) => acc + a.quantity, 0)

      const maxQty = Math.max(...bids.map(b => b.quantity), ...asks.map(a => a.quantity), 1)
      bids.forEach(b => b.percent = (b.quantity / maxQty) * 100)
      asks.forEach(a => a.percent = (a.quantity / maxQty) * 100)

      const total = buyTotal + sellTotal || 1
      const buyPercent = (buyTotal / total) * 100
      const sellPercent = (sellTotal / total) * 100
      
      // Calculate imbalance (-1 to +1)
      const imbalance = (buyTotal - sellTotal) / total

      setData({ bids, asks, buyTotal, sellTotal, buyPercent, sellPercent, imbalance })
    } else {
      // Clear data if no real depth is available
      setData(null)
    }
  }, [realDepth, currentPrice]) // Kept currentPrice to keep array size stable if it was there before

  if (!isMarketOpen) return null;

  if (!data) {
    if (!realDepth) return null;
    return (
      <div className={`p-4 rounded-xl border border-white/5 bg-white/5 text-center ${className}`}>
        <p className="text-xs text-zinc-500">Waiting for live market depth feed...</p>
      </div>
    )
  }

    return (
      <div className={`space-y-4 ${className}`}>
        {/* Header & Percentage Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              Market Depth (Best 5)
              <Info className="h-3 w-3 text-zinc-600" />
            </h4>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 text-[10px] font-medium mr-1">
                {data.imbalance > 0.1 ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Buying Pressure
                  </span>
                ) : data.imbalance < -0.1 ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Selling Pressure
                  </span>
                ) : (
                  <span className="text-zinc-500">Neutral Book</span>
                )}
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">Imbalance: {(data.imbalance * 100).toFixed(1)}%</span>
              </div>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-medium text-zinc-400 transition-all border border-white/5 hover:border-white/10"
                >
                  <span>{isCollapsed ? "Show Details" : "Hide"}</span>
                  {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                </button>
            </div>
          </div>

          <div className="relative h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">

          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data.buyPercent}%` }}
            className="h-full bg-emerald-500"
          />
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data.sellPercent}%` }}
            className="h-full bg-rose-500"
          />
        </div>
        
        <div className="flex justify-between text-[10px] font-medium">
          <div className="flex flex-col">
            <span className="text-zinc-500">Buy Orders</span>
            <span className="text-emerald-400">{data.buyPercent.toFixed(2)}%</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-zinc-500">Sell Orders</span>
            <span className="text-rose-400">{data.sellPercent.toFixed(2)}%</span>
          </div>
        </div>
        </div>

        {/* Depth Table */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Bids (Buy) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
                    <span>Bid Price</span>
                    <span>Qty</span>
                  </div>
                  {data.bids.map((bid, i) => (
                    <div key={i} className="relative group h-7 flex items-center px-2 rounded hover:bg-white/5 transition-colors overflow-hidden">
                      <div 
                        className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 transition-all duration-500"
                        style={{ width: `${bid.percent}%` }}
                      />
                      <div className="relative w-full flex items-center justify-between text-[11px]">
                        <span className="font-mono text-emerald-400">₹{bid.price.toFixed(2)}</span>
                        <span className="text-zinc-300 font-medium">{bid.quantity}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-2 pt-1 border-t border-white/5">
                    <span>Total</span>
                    <span className="font-medium text-zinc-300">{data.buyTotal}</span>
                  </div>
                </div>

                {/* Asks (Sell) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
                    <span>Ask Price</span>
                    <span>Qty</span>
                  </div>
                  {data.asks.map((ask, i) => (
                    <div key={i} className="relative group h-7 flex items-center px-2 rounded hover:bg-white/5 transition-colors overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-rose-500/10 transition-all duration-500"
                        style={{ width: `${ask.percent}%` }}
                      />
                      <div className="relative w-full flex items-center justify-between text-[11px]">
                        <span className="font-mono text-rose-400">₹{ask.price.toFixed(2)}</span>
                        <span className="text-zinc-300 font-medium">{ask.quantity}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-2 pt-1 border-t border-white/5">
                    <span>Total</span>
                    <span className="font-medium text-zinc-300">{data.sellTotal}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )

}
