"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Target, Building2, ChevronRight, Activity, PieChart } from "lucide-react"
import { clsx } from "clsx"

interface SectorStat {
  name: string
  buy: number
  sell: number
  net: number
  dealCount: number
  companyCount: number
}

function rupeeCompact(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString()}`
}

export function SectorWhaleFlow() {
  const [stats, setStats] = useState<SectorStat[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)

  useEffect(() => {
    async function fetchSectorFlow() {
      setLoading(true)
      try {
        const res = await fetch(`/api/bulk-deals/sector-flow?days=${days}`)
        if (res.ok) {
          const json = await res.json()
          setStats(json.data || [])
        }
      } catch (e) {
        console.error("Failed to fetch sector flow:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchSectorFlow()
  }, [days])

  if (loading && stats.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded-lg mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const maxNet = Math.max(...stats.map(s => Math.abs(s.net)))

  return (
    <div className="bg-zinc-900/30 backdrop-blur-3xl border border-zinc-800/50 rounded-[2rem] p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <PieChart className="w-32 h-32 text-white" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Sector Rotation</span>
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-white uppercase">
            Sector Whale Flow
          </h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            Where institutional money is rotating across {stats.length} sectors.
          </p>
        </div>

        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
          {[30, 90, 365].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                days === d ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {d === 365 ? '1 Year' : `${d} Days`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.slice(0, 9).map((sector, i) => (
          <motion.div
            key={sector.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group/card relative overflow-hidden"
          >
            <div className={clsx(
              "absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-10 pointer-events-none",
              sector.net >= 0 ? "bg-emerald-500" : "bg-rose-500"
            )} />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover/card:text-cyan-400 transition-colors">
                  {sector.name}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold mt-1">
                  <span>{sector.companyCount} Stocks</span>
                  <span>•</span>
                  <span>{sector.dealCount} Deals</span>
                </div>
              </div>
              <div className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover/card:scale-110",
                sector.net >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
              )}>
                {sector.net >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                )}
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-end">
                <p className={clsx(
                  "text-xl font-black tabular-nums",
                  sector.net >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {sector.net >= 0 ? '+' : ''}{rupeeCompact(sector.net)}
                </p>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Net Flow</span>
              </div>

              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                <div 
                  className={clsx(
                    "h-full transition-all duration-1000",
                    sector.net >= 0 ? "bg-emerald-500" : "bg-rose-500"
                  )}
                  style={{ width: `${Math.abs(sector.net / maxNet) * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-bold">
                <div className="flex items-center gap-1 text-emerald-500/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {rupeeCompact(sector.buy)}
                </div>
                <div className="flex items-center gap-1 text-rose-500/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {rupeeCompact(sector.sell)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-all">
          EXPLORE ALL SECTOR FLOWS <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
