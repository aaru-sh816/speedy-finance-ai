"use client"

import Link from "next/link"
import { MainNav } from "@/components/main-nav"

import { TrendingUp, Sparkles, Zap, Shield, BarChart3, Search } from "lucide-react"
import { FeyNav } from "@/components/fey/FeyNav"

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-hidden">
      <FeyNav />
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <main className="relative max-w-[1600px] mx-auto px-6 pt-32 pb-24">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl animate-in fade-in zoom-in-95 duration-1000 delay-700">
            <Link href="/market" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-cyan-500/30 transition-all overflow-hidden">
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

            <Link href="/bulk-deals" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-purple-500/30 transition-all overflow-hidden">
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

            <Link href="/announcements" className="group relative p-8 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] hover:border-orange-500/30 transition-all overflow-hidden">
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

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-12 pt-12 animate-in fade-in slide-in-from-top-4 duration-1000 delay-1000 pb-24">
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
