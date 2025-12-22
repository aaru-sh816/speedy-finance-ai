"use client"

import { useEffect, useState } from "react"
import { clsx } from "clsx"
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, LayoutGrid, Zap, Sparkles } from "lucide-react"
import { LivePulse } from "@/components/fey/LivePulse"
import { RiskRadar } from "@/components/risk-radar"
import { FeyNav } from "@/components/fey/FeyNav"

type Stock = {
  scripCode: string
  scripName: string
  ltp: number
  change: number
  changePct: number
}

function buildMarketRecap(gainers: Stock[], losers: Stock[]): string {
  if (!gainers.length && !losers.length) {
    return "As soon as live data loads, Speedy AI will highlight what moved the market today."
  }

  const topGainer = gainers[0]
  const topLoser = losers[0]

  if (topGainer && topLoser) {
    const gDir = topGainer.changePct >= 0 ? "up" : "down"
    const lDir = topLoser.changePct >= 0 ? "up" : "down"
    return `Today's action is led by ${topGainer.scripName} (₹${topGainer.ltp.toFixed(2)}, ${gDir} ${Math.abs(topGainer.changePct).toFixed(2)}%), while ${topLoser.scripName} is among the biggest ${lDir === "down" ? "decliners" : "movers"} (${lDir} ${Math.abs(topLoser.changePct).toFixed(2)}%). Speedy AI refreshes this view every minute so you always see what's moving first.`
  }

  if (topGainer) {
    const dir = topGainer.changePct >= 0 ? "up" : "down"
    return `${topGainer.scripName} leads today's movers at ₹${topGainer.ltp.toFixed(2)}, ${dir} ${Math.abs(topGainer.changePct).toFixed(2)}%.`
  }

  if (topLoser) {
    const dir = topLoser.changePct >= 0 ? "up" : "down"
    return `${topLoser.scripName} stands out among today's movers (${dir} ${Math.abs(topLoser.changePct).toFixed(2)}%).`
  }

  return "Live market recap will appear here once movers are available."
}

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers")
  const [gainers, setGainers] = useState<Stock[]>([])
  const [losers, setLosers] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchMarketMovers = async () => {
    setLoading(true)
    try {
      const [gainersRes, losersRes] = await Promise.all([
        fetch('/api/bse/market-movers?type=gainers'),
        fetch('/api/bse/market-movers?type=losers')
      ])
      const gainersData = await gainersRes.json()
      const losersData = await losersRes.json()

      const toStocks = (rows: any[] | undefined | null): Stock[] => {
        if (!Array.isArray(rows)) return []
        return rows.map((row: any) => ({
          scripCode: row.scripCode || row.securityID || "",
          scripName: row.securityID || row.scripCode || "",
          ltp: Number(row.LTP ?? row.ltp ?? 0),
          change: Number(row.change ?? 0),
          changePct: Number(row.pChange ?? row.changePct ?? 0),
        }))
      }

      setGainers(toStocks(gainersData.data))
      setLosers(toStocks(losersData.data))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch market movers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchMarketMovers()
    const interval = setInterval(fetchMarketMovers, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const displayData = activeTab === "gainers" ? gainers : losers

  return (
<div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
<FeyNav />

{/* Background Decor */}
<div className="fixed inset-0 overflow-hidden pointer-events-none">
<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]" />
<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
</div>

<div className="relative max-w-[1600px] mx-auto px-6 pt-24 pb-12">
<div className="flex flex-col lg:flex-row gap-8">
{/* Main Column */}
<div className="flex-1 min-w-0">
{/* Header */}
<div className="mb-8 space-y-6">
<div className="flex items-center justify-between">
<div className="space-y-1">
<div className="flex items-center gap-2 mb-2">
<Sparkles className="w-3 h-3 text-cyan-400" />
<span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Market Intelligence</span>
</div>
<h1 className="text-5xl font-black tracking-tighter text-white">
Real-time <span className="text-zinc-600">Dynamics</span>
</h1>
</div>
<button
onClick={fetchMarketMovers}
className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 transition-all group"
>
<RefreshCw className={`h-5 w-5 text-zinc-500 group-hover:text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
</button>
</div>

{/* Tabs */}
<div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl w-fit">
<button
onClick={() => setActiveTab("gainers")}
className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
activeTab === "gainers"
? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
: "text-zinc-500 hover:text-white"
}`}
>
GAINERS
</button>
<button
onClick={() => setActiveTab("losers")}
className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
activeTab === "losers"
? "bg-rose-500 text-black shadow-[0_0_20px_rgba(244,63,94,0.3)]"
: "text-zinc-500 hover:text-white"
}`}
>
LOSERS
</button>
</div>

{/* Daily market recap */}
<div className="p-6 bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/30 rounded-3xl relative overflow-hidden group">
<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
<Zap className="w-24 h-24 text-white" />
</div>
<div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
<div className="flex items-center gap-2">
<LayoutGrid className="h-3 w-3 text-cyan-500" />
<span>Speedy AI Market Digest</span>
</div>
{mounted && lastUpdated && (
<span className="flex items-center gap-1.5">
Sync {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
</span>
)}
</div>
<p className="text-xl text-zinc-300 leading-tight font-medium tracking-tight">
{buildMarketRecap(gainers, losers)}
</p>
</div>
</div>

{/* Stocks Grid */}
{loading && displayData.length === 0 ? (
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{[...Array(6)].map((_, i) => (
<div key={i} className="h-40 rounded-3xl bg-zinc-900/20 animate-pulse border border-zinc-800/10" />
))}
</div>
) : (
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{displayData.slice(0, 10).map((stock, index) => (
<a
key={stock.scripCode}
href={`/company/${stock.scripCode}`}
className="group p-6 bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/30 rounded-[2.5rem] hover:border-cyan-500/30 transition-all relative overflow-hidden"
>
<div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 via-transparent to-white/0 group-hover:to-white/[0.02] transition-all duration-700" />

<div className="relative flex items-start justify-between mb-8">
<div className="flex items-center gap-4">
<div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black border ${
activeTab === "gainers" 
? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
: "bg-rose-500/10 text-rose-400 border-rose-500/20"
}`}>
#{index + 1}
</div>
<div>
<h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors tracking-tight">
{stock.scripName}
</h3>
<p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{stock.scripCode}</p>
</div>
</div>
<div className={clsx(
"w-8 h-8 rounded-xl flex items-center justify-center border transition-all",
activeTab === "gainers" 
? "bg-emerald-500/10 border-emerald-500/20 group-hover:scale-110" 
: "bg-rose-500/10 border-rose-500/20 group-hover:scale-110"
)}>
{activeTab === "gainers" ? (
<ArrowUpRight className="h-4 w-4 text-emerald-400" />
) : (
<ArrowDownRight className="h-4 w-4 text-rose-400" />
)}
</div>
</div>

<div className="relative flex items-end justify-between">
<div className="space-y-1">
<span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block">Last Traded Price</span>
<span className="text-4xl font-black text-white tracking-tighter">₹{Number(stock.ltp || 0).toLocaleString('en-IN')}</span>
</div>
<div className="text-right space-y-1">
<div className={clsx(
"px-3 py-1 rounded-xl text-sm font-black tracking-tight",
Number(stock.changePct || 0) >= 0 
? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
: "bg-rose-500 text-black shadow-[0_0_15px_rgba(244,63,94,0.2)]"
)}>
{Number(stock.changePct || 0) >= 0 ? "+" : ""}{Number(stock.changePct || 0).toFixed(2)}%
</div>
<div className={`text-[10px] font-bold ${Number(stock.change || 0) >= 0 ? "text-emerald-500/60" : "text-rose-500/60"}`}>
{Number(stock.change || 0) >= 0 ? "+" : ""}₹{Number(stock.change || 0).toFixed(2)}
</div>
</div>
</div>
</a>
))}
</div>
)}
</div>

{/* Side Column */}
<div className="lg:w-[450px] flex-shrink-0 space-y-8">
<LivePulse />
<RiskRadar />
</div>
</div>
</div>
</div>
  )
}
