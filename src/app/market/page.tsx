"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import { RefreshCw, ArrowUpRight, ArrowDownRight, LayoutGrid, Zap, Sparkles, BarChart3, FileText, Calendar, TrendingUp } from "lucide-react"
import { ResponsiveContainer, LineChart, Line } from "recharts"

import { RiskRadar } from "@/components/risk-radar"
import { FeyNav } from "@/components/fey/FeyNav"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

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

type AdvanceDecline = { advances?: number; declines?: number; unchanged?: number }[]

type Near52Row = {
  scripcode?: string
  scripCode?: string
  companyname?: string
  ltp?: number
  high52?: number
  low52?: number
  [key: string]: unknown
}

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers")
  const [gainers, setGainers] = useState<Stock[]>([])
  const [losers, setLosers] = useState<Stock[]>([])
  const [advanceDecline, setAdvanceDecline] = useState<AdvanceDecline>([])
  const [near52Highs, setNear52Highs] = useState<Near52Row[]>([])
  const [near52Lows, setNear52Lows] = useState<Near52Row[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchMarketMovers = async () => {
    setLoading(true)
    setFetchError(null)
    const timeoutMs = 20000 // generous timeout for nse-bse-api (BSE can be slow)
    const toStocks = (rows: unknown): Stock[] => {
      if (!Array.isArray(rows)) return []
      return (rows as Record<string, unknown>[])
        .map((row: Record<string, unknown>) => {
          const scripCode = String(
            row?.scripCode ?? row?.scripcode ?? row?.scrip_code ?? row?.ScripCode ?? row?.code ?? ""
          ).trim()
          const scripName = String(
            row?.scripName ?? row?.scrip_name ?? row?.companyname ?? row?.securityID ?? row?.SecurityID ?? row?.name ?? scripCode
          ).trim()
          if (!scripCode) return null
          return {
            scripCode,
            scripName,
            ltp: Number(row?.LTP ?? row?.ltp ?? row?.lastPrice ?? 0),
            change: Number(row?.change ?? row?.Change ?? 0),
            changePct: Number(row?.pChange ?? row?.pchange ?? row?.changePct ?? row?.pchangePct ?? 0),
          } satisfies Stock
        })
        .filter((s: Stock | null): s is Stock => Boolean(s))
    }
    const to52 = (arr: unknown[]): Near52Row[] =>
      (arr || []).map((r: unknown) => {
        const row = r as Record<string, unknown>
        return {
          scripcode: String(row?.scripcode ?? row?.Scrip_Code ?? row?.scripCode ?? ""),
          scripCode: String(row?.scripcode ?? row?.Scrip_Code ?? row?.scripCode ?? ""),
          companyname: String(row?.companyname ?? row?.SecurityID ?? row?.companyName ?? ""),
          ltp: Number(row?.LTP ?? row?.ltp ?? 0),
          high52: Number(row?.high52 ?? row?.High_52 ?? 0),
          low52: Number(row?.low52 ?? row?.Low_52 ?? 0),
          ...row,
        } satisfies Near52Row
      })

    const urls = [
      '/api/bse/market-movers?type=gainers',
      '/api/bse/market-movers?type=losers',
      '/api/bse/advance-decline',
      '/api/bse/near-52week',
    ] as const
    const settled = await Promise.allSettled(
      urls.map((url) => fetchWithTimeout(url, { timeoutMs }))
    )

    let gainersData: { data?: unknown } = { data: [] }
    let losersData: { data?: unknown } = { data: [] }
    let adData: { data?: unknown } = { data: [] }
    let near52Data: { highs?: unknown[]; lows?: unknown[] } = { highs: [], lows: [] }
    const errors: string[] = []

    if (settled[0].status === 'fulfilled' && settled[0].value.ok) {
      try { gainersData = await settled[0].value.json() } catch { gainersData = { data: [] } }
    } else if (settled[0].status === 'rejected') errors.push((settled[0].reason as Error)?.message || 'Gainers')
    if (settled[1].status === 'fulfilled' && settled[1].value.ok) {
      try { losersData = await settled[1].value.json() } catch { losersData = { data: [] } }
    } else if (settled[1].status === 'rejected') errors.push((settled[1].reason as Error)?.message || 'Losers')
    if (settled[2].status === 'fulfilled' && settled[2].value.ok) {
      try { adData = await settled[2].value.json() } catch { adData = { data: [] } }
    } else if (settled[2].status === 'rejected') errors.push((settled[2].reason as Error)?.message || 'Advance/decline')
    if (settled[3].status === 'fulfilled' && settled[3].value.ok) {
      try { near52Data = await settled[3].value.json() } catch { near52Data = { highs: [], lows: [] } }
    } else if (settled[3].status === 'rejected') errors.push((settled[3].reason as Error)?.message || 'Near 52-week')

    setGainers(toStocks(gainersData?.data))
    setLosers(toStocks(losersData?.data))
    setAdvanceDecline(Array.isArray(adData?.data) ? adData.data : [])
    setNear52Highs(to52(near52Data?.highs ?? []))
    setNear52Lows(to52(near52Data?.lows ?? []))
    setLastUpdated(new Date())

    // Only show role=alert when every endpoint failed (rejected); partial data is fine
    const anyRejected = settled.some((s) => s.status === 'rejected')
    const hasAnyData = toStocks(gainersData?.data).length > 0 || toStocks(losersData?.data).length > 0 ||
      (Array.isArray(adData?.data) && adData.data.length > 0) ||
      (Array.isArray(near52Data?.highs) && near52Data.highs.length > 0) ||
      (Array.isArray(near52Data?.lows) && near52Data.lows.length > 0)
    if (anyRejected && !hasAnyData && errors.length > 0) {
      setFetchError(errors[0] ?? "Failed to load market data")
    } else {
      setFetchError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    fetchMarketMovers()
    const interval = setInterval(fetchMarketMovers, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const displayData = (activeTab === "gainers" ? gainers : losers).filter(
    (s) => s.scripCode && String(s.scripCode).trim() !== "" && String(s.scripCode) !== "undefined"
  )

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

{fetchError && (
  <p className="text-rose-400 text-sm" role="alert">{fetchError}</p>
)}

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
key={`${stock.scripCode}-${stock.scripName}-${index}`}
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

<div className="relative mb-4 h-12 w-full opacity-80">
<ResponsiveContainer width="100%" height="100%">
<LineChart
  data={[0, 1, 2, 3].map((i) => {
    const ltp = Number(stock.ltp || 0)
    const ch = Number(stock.change || 0)
    const prev = ltp - ch
    const pct = i / 3
    return { t: i, v: prev + ch * pct }
  })}
  margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
>
  <Line
    type="monotone"
    dataKey="v"
    stroke={Number(stock.changePct || 0) >= 0 ? "#10b981" : "#f43f5e"}
    strokeWidth={2}
    dot={false}
    isAnimationActive={false}
  />
</LineChart>
</ResponsiveContainer>
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

{/* Advance / Decline */}
{advanceDecline.length > 0 && (() => {
  const row = advanceDecline[0]
  const advances = row?.advances ?? 0
  const declines = row?.declines ?? 0
  const unchanged = row?.unchanged ?? 0
  return (
    <div className="p-6 bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/30 rounded-3xl" role="region" aria-label="BSE market breadth">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-cyan-500" aria-hidden />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">BSE Breadth</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="text-emerald-400 text-lg font-black" aria-label={`${advances} advances`}>{advances}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Advances</div>
        </div>
        <div className="space-y-1">
          <div className="text-rose-400 text-lg font-black" aria-label={`${declines} declines`}>{declines}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Declines</div>
        </div>
        <div className="space-y-1">
          <div className="text-zinc-400 text-lg font-black" aria-label={`${unchanged} unchanged`}>{unchanged}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Unchanged</div>
        </div>
      </div>
    </div>
  )
})()}

{/* Near 52-week high / low */}
{(near52Highs.length > 0 || near52Lows.length > 0) && (
  <div className="p-6 bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/30 rounded-3xl" role="region" aria-label="Stocks near 52-week high and low">
    <div className="flex items-center gap-2 mb-4">
      <TrendingUp className="w-4 h-4 text-cyan-500" aria-hidden />
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Near 52-week</span>
    </div>
    <div className="grid grid-cols-1 gap-4">
      {near52Highs.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-2">Near high</div>
          <ul className="space-y-1.5">
            {near52Highs.slice(0, 5).map((row, i) => {
              const code = String(row.scripCode ?? row.scripcode ?? "").trim()
              const name = row.companyname ?? (code || "—")
              const ltp = Number(row.ltp ?? 0)
              const validCode = code && code !== "undefined"
              return (
                <li key={`h-${code}-${i}`}>
                  {validCode ? (
                    <Link href={`/company/${code}`} className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-zinc-800/40 text-sm text-zinc-300 hover:text-white transition-colors">
                      <span className="truncate">{name}</span>
                      <span className="text-emerald-400/90 font-medium tabular-nums ml-2">₹{ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between py-1.5 px-2 text-sm text-zinc-500">
                      <span className="truncate">{name}</span>
                      <span className="tabular-nums ml-2">₹{ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {near52Lows.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest mb-2">Near low</div>
          <ul className="space-y-1.5">
            {near52Lows.slice(0, 5).map((row, i) => {
              const code = String(row.scripCode ?? row.scripcode ?? "").trim()
              const name = row.companyname ?? (code || "—")
              const ltp = Number(row.ltp ?? 0)
              const validCode = code && code !== "undefined"
              return (
                <li key={`l-${code}-${i}`}>
                  {validCode ? (
                    <Link href={`/company/${code}`} className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-zinc-800/40 text-sm text-zinc-300 hover:text-white transition-colors">
                      <span className="truncate">{name}</span>
                      <span className="text-rose-400/90 font-medium tabular-nums ml-2">₹{ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between py-1.5 px-2 text-sm text-zinc-500">
                      <span className="truncate">{name}</span>
                      <span className="tabular-nums ml-2">₹{ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  </div>
)}

{/* Quick links */}
<div className="flex flex-col gap-2">
  <Link href="/market/ipos" className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 transition-all text-sm font-medium text-zinc-300 hover:text-white">
    <FileText className="w-4 h-4 text-cyan-500" />
    NSE IPOs (current & upcoming)
  </Link>
  <Link href="/result-calendar" className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 transition-all text-sm font-medium text-zinc-300 hover:text-white">
    <Calendar className="w-4 h-4 text-cyan-500" />
    Result calendar
  </Link>
  <Link href="/indices" className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 transition-all text-sm font-medium text-zinc-300 hover:text-white">
    <BarChart3 className="w-4 h-4 text-cyan-500" />
    BSE Indices
  </Link>
</div>

<RiskRadar />
</div>
</div>
</div>
</div>
  )
}
