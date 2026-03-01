"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, Sparkles, Zap, Shield, PieChart, Loader2 } from "lucide-react"
import { FeyNav } from "@/components/fey/FeyNav"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

type IndexRow = { name?: string; currentValue?: string; pChange?: string }
type GainerRow = { scripCode?: string; scripName?: string; ltp?: number; changePct?: number }

export default function Home() {
  const [indices, setIndices] = useState<IndexRow[]>([])
  const [gainers, setGainers] = useState<GainerRow[]>([])
  const [liveLoading, setLiveLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [indRes, movRes] = await Promise.all([
          fetchWithTimeout("/api/bse/indices?category=market_cap/broad", { timeoutMs: 10000 }).catch(() => null),
          fetchWithTimeout("/api/bse/market-movers?type=gainers", { timeoutMs: 10000 }).catch(() => null),
        ])
        if (cancelled) return
        if (indRes?.ok) {
          const d = await indRes.json()
          const list = d?.data?.indices ?? d?.data ?? []
          setIndices(Array.isArray(list) ? list.slice(0, 3) : [])
        }
        if (movRes?.ok) {
          const d = await movRes.json()
          const list = d?.data ?? []
          setGainers(Array.isArray(list) ? list.slice(0, 5).map((r: Record<string, unknown>) => ({
            scripCode: String(r.scripCode ?? r.scripcode ?? ""),
            scripName: String(r.scripName ?? r.companyname ?? r.securityID ?? ""),
            ltp: Number(r.LTP ?? r.ltp ?? 0),
            changePct: Number(r.pChange ?? r.pchange ?? 0),
          })) : [])
        }
      } catch {
        if (!cancelled) setIndices([]); setGainers([])
      } finally {
        if (!cancelled) setLiveLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])
  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-hidden" suppressHydrationWarning>
      <FeyNav />
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <main className="relative max-w-[1600px] mx-auto px-6 pt-32 pb-24" suppressHydrationWarning>
        <div className="flex flex-col items-center text-center space-y-12">
          {/* Hero Content */}
          <div className="space-y-6 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-white/5 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black tracking-widest uppercase text-cyan-500">Next-Gen Financial Intelligence</span>
            </div>
            
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] text-white animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              SPEEDY <span className="text-zinc-800">FINANCE</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-500 font-medium max-w-2xl mx-auto leading-tight animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
              The world's most advanced AI command center for Indian stock market intelligence. 
              <span className="text-zinc-300"> Outperform with real-time data flow.</span>
            </p>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl animate-in fade-in zoom-in-95 duration-1000 delay-700" suppressHydrationWarning>
            <Link href="/portfolio" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-cyan-500/30 transition-all overflow-hidden" suppressHydrationWarning>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                <PieChart className="w-32 h-32 text-white" />
              </div>
              <div className="relative space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 transition-transform">
                  <PieChart className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Portfolio</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">Track holdings, P&amp;L, and AI-powered insights.</p>
              </div>
            </Link>

            <Link href="/market" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-cyan-500/30 transition-all overflow-hidden" suppressHydrationWarning>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-32 h-32 text-white" />
              </div>
              <div className="relative space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Market Pulse</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">Real-time dynamics, gainers, losers, and live disclosure feed.</p>
              </div>
            </Link>

            <Link href="/bulk-deals" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-purple-500/30 transition-all overflow-hidden" suppressHydrationWarning>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                <Zap className="w-32 h-32 text-white" />
              </div>
              <div className="relative space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                  <Zap className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Smart Money</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">Track institutional bulk deals, Superstar activity, and accumulation.</p>
              </div>
            </Link>

            <Link href="/announcements" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-orange-500/30 transition-all overflow-hidden" suppressHydrationWarning>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                <Shield className="w-32 h-32 text-white" />
              </div>
              <div className="relative space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform">
                  <Shield className="w-7 h-7 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Risk Radar</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">AI-powered summaries of critical filings and high-impact disclosures.</p>
              </div>
            </Link>
          </div>

          {/* Live data strip */}
          {(liveLoading || indices.length > 0 || gainers.length > 0) && (
            <div className="w-full max-w-4xl animate-in fade-in duration-700 delay-500" aria-live="polite" role="region" aria-label="Live market snapshot">
              <div className="p-4 rounded-2xl bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50">
                {liveLoading ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-500 py-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading live data...</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                    {indices.length > 0 && (
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Indices</p>
                        <div className="flex flex-wrap gap-3">
                          {indices.map((idx, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-white font-medium">{idx.name ?? `Index ${i + 1}`}</span>
                              <span className="text-zinc-500 ml-2">{idx.currentValue ?? "—"}</span>
                              {idx.pChange != null && (
                                <span className={`${Number(idx.pChange) >= 0 ? "text-emerald-400" : "text-rose-400"} ml-1 tabular-nums`}>
                                  {Number(idx.pChange) >= 0 ? "+" : ""}{idx.pChange}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {gainers.length > 0 && (
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Top gainers</p>
                        <div className="flex flex-wrap gap-3">
                          {gainers.map((g, i) => (
                            <Link key={i} href={g.scripCode ? `/company/${g.scripCode}` : "#"} className="text-sm hover:text-cyan-400 transition-colors">
                              <span className="text-white font-medium">{g.scripName ?? g.scripCode ?? "—"}</span>
                              <span className="text-emerald-400 ml-1 tabular-nums">+{Number(g.changePct ?? 0).toFixed(1)}%</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-12 pt-12 animate-in fade-in slide-in-from-top-4 duration-1000 delay-1000 pb-24" suppressHydrationWarning>
            <div className="text-center group">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1 group-hover:text-cyan-500 transition-colors">Total Tickers</p>
              <p className="text-4xl font-black text-white tracking-tighter">4,200+</p>
            </div>
            <div className="text-center group">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1 group-hover:text-purple-500 transition-colors">Daily Signals</p>
              <p className="text-4xl font-black text-white tracking-tighter">~150</p>
            </div>
            <div className="text-center group">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1 group-hover:text-amber-500 transition-colors">Sync Latency</p>
              <p className="text-4xl font-black text-white tracking-tighter">&lt;60s</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
