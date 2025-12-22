"use client"

import { FeyNav } from "@/components/fey/FeyNav"
import { InvestorAttribution } from "@/components/fey/InvestorAttribution"
import { Sparkles, TrendingUp, Users, Zap } from "lucide-react"

export default function AttributionPage() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
      <FeyNav />
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow" />
      </div>

      <div className="relative container mx-auto px-4 pt-24 pb-32 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full w-fit">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Premium Intelligence</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            Investor <span className="text-zinc-500">Attribution</span>
          </h1>
          
          <p className="max-w-2xl text-zinc-400 text-lg leading-relaxed">
            Track how superstar investors move the market. Real-time performance analysis of bulk deals compared to current market quotes.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatMiniCard 
            icon={Users} 
            label="Superstars Active" 
            value="42" 
            subValue="Today" 
            color="cyan"
          />
          <StatMiniCard 
            icon={Zap} 
            label="Avg Influence" 
            value="8.4" 
            subValue="Score" 
            color="purple"
          />
          <StatMiniCard 
            icon={TrendingUp} 
            label="Winning Deals" 
            value="64%" 
            subValue="+2.4% vs Avg" 
            color="emerald"
          />
          <StatMiniCard 
            icon={TrendingUp} 
            label="Total Momentum" 
            value="High" 
            subValue="Bullish Tint" 
            color="blue"
          />
        </div>

        {/* Main Dashboard Component */}
        <InvestorAttribution />
      </div>
    </main>
  )
}

function StatMiniCard({ icon: Icon, label, value, subValue, color }: any) {
  const colors: any = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20"
  }

  return (
    <div className="p-4 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl group hover:border-zinc-700/50 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-[10px] text-zinc-600">{subValue}</span>
      </div>
    </div>
  )
}
