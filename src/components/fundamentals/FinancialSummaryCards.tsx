"use client"

import { useMemo } from "react"
import { Sparkline } from "@/components/sparkline"
import { TrendingUp, TrendingDown, Info, PenSquare, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { clsx } from "clsx"

interface FinancialRow {
  header?: string
  year?: number
  revenueFromOperations?: number
  sales?: number
  operatingProfit?: number
  ebit?: number
  ebitda?: number
  profitLossForPeriod?: number
  EPS?: number
  eps?: number
  [key: string]: string | number | undefined
}

interface CfRow {
  header?: string
  year?: number
  cashFromOperatingActivity?: number
  [key: string]: string | number | undefined
}

interface FinancialSummaryCardsProps {
  plAnnual: FinancialRow[]
  cfAnnual: CfRow[]
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function cagr(v0: number, v1: number, years: number): number | null {
  if (!v0 || v0 <= 0 || years <= 0) return null
  const rate = Math.pow(v1 / v0, 1 / years) - 1
  return Number.isFinite(rate) ? rate * 100 : null
}

function formatValue(val: number) {
  const abs = Math.abs(val)
  let result = ""
  let unit = ""
  
  if (abs >= 1e7) {
    result = (val / 1e7).toFixed(2)
    unit = "Cr"
  } else if (abs >= 1e5) {
    result = (val / 1e5).toFixed(2)
    unit = "L"
  } else {
    result = val.toFixed(2)
  }

  const [main, decimal] = result.split(".")
  return { main, decimal: decimal ? `.${decimal}` : "", unit }
}

export function FinancialSummaryCards({
  plAnnual,
  cfAnnual,
  onNoteAction,
}: FinancialSummaryCardsProps) {
  const sorted = useMemo(() => 
    [...plAnnual].sort((a, b) => {
      const yA = Number(a.year ?? a.header ?? 0)
      const yB = Number(b.year ?? b.header ?? 0)
      return yB - yA
    })
  , [plAnnual])

  const cfSorted = useMemo(() => 
    [...cfAnnual].sort((a, b) => {
      const yA = Number(a.year ?? a.header ?? 0)
      const yB = Number(b.year ?? b.header ?? 0)
      return yB - yA
    })
  , [cfAnnual])

  if (sorted.length === 0) return null

  const latest = sorted[0]
  const prev = sorted[1]

  const metrics = useMemo(() => {
    const rev = Number(latest?.revenueFromOperations ?? latest?.sales ?? 0)
    const prevRev = Number(prev?.revenueFromOperations ?? prev?.sales ?? 0)
    const opInc = Number(latest?.operatingProfit ?? latest?.ebit ?? latest?.ebitda ?? 0)
    const prevOpInc = Number(prev?.operatingProfit ?? prev?.ebit ?? prev?.ebitda ?? 0)
    const pat = Number(latest?.profitLossForPeriod ?? 0)
    const prevPat = Number(prev?.profitLossForPeriod ?? 0)
    const eps = Number(latest?.EPS ?? latest?.eps ?? 0)
    const prevEps = Number(prev?.EPS ?? prev?.eps ?? 0)
    const opCf = Number(cfSorted[0]?.cashFromOperatingActivity ?? 0)
    const prevOpCf = Number(cfSorted[1]?.cashFromOperatingActivity ?? 0)

    const revHistory = sorted.map(r => Number(r.revenueFromOperations ?? r.sales ?? 0)).reverse()
    const opHistory = sorted.map(r => Number(r.operatingProfit ?? r.ebit ?? r.ebitda ?? 0)).reverse()
    const patHistory = sorted.map(r => Number(r.profitLossForPeriod ?? 0)).reverse()
    const epsHistory = sorted.map(r => Number(r.EPS ?? r.eps ?? 0)).reverse()
    const cfHistory = cfSorted.map(r => Number(r.cashFromOperatingActivity ?? 0)).reverse()

    const getYoY = (curr: number, prevVal: number) => prevVal && prevVal !== 0 ? ((curr - prevVal) / Math.abs(prevVal)) * 100 : null
    
    return [
      {
        label: "Revenue",
        ...formatValue(rev),
        yoy: getYoY(rev, prevRev),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.revenueFromOperations ?? sorted[3]?.sales ?? 0), rev, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.revenueFromOperations ?? sorted[5]?.sales ?? 0), rev, 5) : null,
        history: revHistory,
      },
      {
        label: "Op. Income",
        ...formatValue(opInc),
        yoy: getYoY(opInc, prevOpInc),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.operatingProfit ?? sorted[3]?.ebit ?? sorted[3]?.ebitda ?? 0), opInc, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.operatingProfit ?? sorted[5]?.ebit ?? sorted[5]?.ebitda ?? 0), opInc, 5) : null,
        history: opHistory,
      },
      {
        label: "Net Income",
        ...formatValue(pat),
        yoy: getYoY(pat, prevPat),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.profitLossForPeriod ?? 0), pat, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.profitLossForPeriod ?? 0), pat, 5) : null,
        history: patHistory,
      },
      {
        label: "EPS",
        ...formatValue(eps),
        yoy: getYoY(eps, prevEps),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.EPS ?? sorted[3]?.eps ?? 0), eps, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.EPS ?? sorted[5]?.eps ?? 0), eps, 5) : null,
        history: epsHistory,
        noCr: true
      },
      {
        label: "Cash Flow",
        ...formatValue(opCf),
        yoy: getYoY(opCf, prevOpCf),
        cagr3: cfSorted.length >= 4 ? cagr(Number(cfSorted[3]?.cashFromOperatingActivity ?? 0), opCf, 3) : null,
        cagr5: cfSorted.length >= 6 ? cagr(Number(cfSorted[5]?.cashFromOperatingActivity ?? 0), opCf, 5) : null,
        history: cfHistory,
      },
    ]
  }, [latest, prev, sorted, cfSorted])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-600 flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          FINANCIAL PERFORMANCE
          <span className="text-[9px] font-black text-zinc-700 tracking-normal ml-2">FY{latest.year ?? latest.header}</span>
        </h3>
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">GROWTH</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-cyan-500" />
            </div>
            <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">TRENDLINE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="group relative bg-zinc-950/80 p-6 flex flex-col justify-between transition-all duration-500 hover:bg-zinc-900/60"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-zinc-500 tracking-[0.15em] uppercase group-hover:text-zinc-300 transition-colors">
                  {m.label}
                </span>
                {m.yoy != null && (
                  <div className={clsx(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black transition-all",
                    m.yoy >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                  )}>
                    {m.yoy >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {m.yoy >= 0 ? "+" : ""}{m.yoy.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Value */}
              <button 
                onClick={() => onNoteAction?.({
                  title: `Metric: ${m.label}`,
                  content: `Detailed analysis of ${m.label}: Current value is ${m.main}${m.decimal}${m.unit}. YoY growth is ${m.yoy?.toFixed(1)}%.`,
                  type: "note"
                })}
                className="flex items-baseline text-left hover:scale-[1.02] transition-transform origin-left group/value"
              >
                <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
                  {m.main}
                </span>
                <span className="text-sm font-bold text-zinc-600 ml-0.5 tabular-nums">
                  {m.decimal}
                </span>
                <span className="text-[10px] font-black text-zinc-500 ml-1.5 uppercase tracking-widest opacity-60">
                  {m.unit}
                </span>
                <PenSquare className="h-3 w-3 ml-2 text-cyan-500 opacity-0 group-hover/value:opacity-100 transition-opacity" />
              </button>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-zinc-700 tracking-widest uppercase">CAGR (3Y)</p>
                  <p className={clsx(
                    "text-xs font-black tabular-nums",
                    m.cagr3 != null && m.cagr3 >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {m.cagr3 != null ? `${m.cagr3 >= 0 ? "+" : ""}${m.cagr3.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-zinc-700 tracking-widest uppercase">CAGR (5Y)</p>
                  <p className={clsx(
                    "text-xs font-black tabular-nums",
                    m.cagr5 != null && m.cagr5 >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {m.cagr5 != null ? `${m.cagr5 >= 0 ? "+" : ""}${m.cagr5.toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Sparkline & Overlay */}
            <div className="mt-8 relative h-12 w-full flex items-end">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity">
                <span className="text-[8px] font-black tracking-[0.4em] uppercase text-white">HISTORICAL TREND</span>
              </div>
              <Sparkline 
                data={m.history} 
                width={160} 
                height={40} 
                color={m.yoy != null && m.yoy >= 0 ? "#10b981" : "#f43f5e"}
                strokeWidth={3}
              />
            </div>

            {/* Accent Bar */}
            <div className="absolute bottom-0 left-0 h-1 w-0 bg-cyan-500 transition-all duration-700 group-hover:w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
