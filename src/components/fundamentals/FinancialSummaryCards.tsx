"use client"

import { useState, useMemo } from "react"
import { MiniBarChart } from "@/components/mini-bar-chart"
import { PenSquare, ArrowUpRight, ArrowDownRight } from "lucide-react"
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

function formatCr(val: number): string {
  if (!Number.isFinite(val)) return "—"
  const cr = val / 1e7
  return cr.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " Cr"
}

function formatEps(val: number): string {
  if (!Number.isFinite(val)) return "—"
  return Number(val).toFixed(1)
}

export function FinancialSummaryCards({
  plAnnual,
  cfAnnual,
  onNoteAction,
}: FinancialSummaryCardsProps) {
  const [inflationAdj, setInflationAdj] = useState(false)

  const sorted = useMemo(
    () =>
      [...plAnnual].sort((a, b) => {
        const yA = Number(a.year ?? a.header ?? 0)
        const yB = Number(b.year ?? b.header ?? 0)
        return yB - yA
      }),
    [plAnnual]
  )

  const cfSorted = useMemo(
    () =>
      [...cfAnnual].sort((a, b) => {
        const yA = Number(a.year ?? a.header ?? 0)
        const yB = Number(b.year ?? b.header ?? 0)
        return yB - yA
      }),
    [cfAnnual]
  )

  if (sorted.length === 0) return null

  const latest = sorted[0]
  const prev = sorted[1]

  const metrics = useMemo(() => {
    const rev = Number(latest?.revenueFromOperations ?? latest?.sales ?? 0)
    const prevRev = Number(prev?.revenueFromOperations ?? prev?.sales ?? 0)
    const opInc = Number(latest?.operatingProfit ?? latest?.ebit ?? latest?.ebitda ?? latest?.operatingIncome ?? 0)
    const prevOpInc = Number(prev?.operatingProfit ?? prev?.ebit ?? prev?.ebitda ?? prev?.operatingIncome ?? 0)
    const pat = Number(latest?.profitLossForPeriod ?? latest?.netIncome ?? 0)
    const prevPat = Number(prev?.profitLossForPeriod ?? prev?.netIncome ?? 0)
    const eps = Number(latest?.EPS ?? latest?.eps ?? latest?.dilutedEps ?? 0)
    const prevEps = Number(prev?.EPS ?? prev?.eps ?? prev?.dilutedEps ?? 0)
    const opCf = Number(cfSorted[0]?.cashFromOperatingActivity ?? cfSorted[0]?.netCashFlowFromOperatingActivities ?? cfSorted[0]?.operatingCashFlow ?? cfSorted[0]?.cashOperating ?? 0)
    const prevOpCf = Number(cfSorted[1]?.cashFromOperatingActivity ?? cfSorted[1]?.netCashFlowFromOperatingActivities ?? cfSorted[1]?.operatingCashFlow ?? cfSorted[1]?.cashOperating ?? 0)

    const revHistory = [...sorted].reverse().map((r) => Number(r.revenueFromOperations ?? r.sales ?? 0))
    const opHistory = [...sorted].reverse().map((r) => Number(r.operatingProfit ?? r.ebit ?? r.ebitda ?? r.operatingIncome ?? 0))
    const patHistory = [...sorted].reverse().map((r) => Number(r.profitLossForPeriod ?? r.netIncome ?? 0))
    const epsHistory = [...sorted].reverse().map((r) => Number(r.EPS ?? r.eps ?? r.dilutedEps ?? 0))
    const cfHistory = [...cfSorted].reverse().map((r) => Number(r.cashFromOperatingActivity ?? r.netCashFlowFromOperatingActivities ?? r.operatingCashFlow ?? r.cashOperating ?? 0))

    const getYoY = (curr: number, prevVal: number) =>
      prevVal && prevVal !== 0 ? ((curr - prevVal) / Math.abs(prevVal)) * 100 : null

    const yearLabels = [...sorted].reverse().map((r) => String(r.year ?? r.header ?? ""))
    const cfYearLabels = [...cfSorted].reverse().map((r) => String(r.year ?? r.header ?? ""))

    return [
      {
        label: "REVENUE",
        valueStr: formatCr(rev),
        yoy: getYoY(rev, prevRev),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.revenueFromOperations ?? sorted[3]?.sales ?? 0), rev, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.revenueFromOperations ?? sorted[5]?.sales ?? 0), rev, 5) : null,
        histAvg: revHistory.length ? revHistory.reduce((a, b) => a + b, 0) / revHistory.length : null,
        history: revHistory,
        yearLabels,
        formatChart: formatCr,
      },
      {
        label: "OPERATING INCOME",
        valueStr: formatCr(opInc),
        yoy: getYoY(opInc, prevOpInc),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.operatingProfit ?? sorted[3]?.ebit ?? sorted[3]?.ebitda ?? 0), opInc, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.operatingProfit ?? sorted[5]?.ebit ?? sorted[5]?.ebitda ?? 0), opInc, 5) : null,
        histAvg: opHistory.length ? opHistory.reduce((a, b) => a + b, 0) / opHistory.length : null,
        history: opHistory,
        yearLabels,
        formatChart: formatCr,
      },
      {
        label: "NET INCOME",
        valueStr: formatCr(pat),
        yoy: getYoY(pat, prevPat),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.profitLossForPeriod ?? 0), pat, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.profitLossForPeriod ?? 0), pat, 5) : null,
        histAvg: patHistory.length ? patHistory.reduce((a, b) => a + b, 0) / patHistory.length : null,
        history: patHistory,
        yearLabels,
        formatChart: formatCr,
      },
      {
        label: "EPS",
        valueStr: formatEps(eps),
        yoy: getYoY(eps, prevEps),
        cagr3: sorted.length >= 4 ? cagr(Number(sorted[3]?.EPS ?? sorted[3]?.eps ?? 0), eps, 3) : null,
        cagr5: sorted.length >= 6 ? cagr(Number(sorted[5]?.EPS ?? sorted[5]?.eps ?? 0), eps, 5) : null,
        histAvg: epsHistory.length ? epsHistory.reduce((a, b) => a + b, 0) / epsHistory.length : null,
        history: epsHistory,
        yearLabels,
        formatChart: formatEps,
      },
      {
        label: "OP. CASH FLOW",
        valueStr: formatCr(opCf),
        yoy: getYoY(opCf, prevOpCf),
        cagr3: cfSorted.length >= 4 ? cagr(Number(cfSorted[3]?.cashFromOperatingActivity ?? 0), opCf, 3) : null,
        cagr5: cfSorted.length >= 6 ? cagr(Number(cfSorted[5]?.cashFromOperatingActivity ?? 0), opCf, 5) : null,
        histAvg: cfHistory.length ? cfHistory.reduce((a, b) => a + b, 0) / cfHistory.length : null,
        history: cfHistory,
        yearLabels: cfYearLabels,
        formatChart: formatCr,
      },
    ]
  }, [latest, prev, sorted, cfSorted])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-600 flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          FINANCIALS
        </h3>
        <button
          onClick={() => setInflationAdj(!inflationAdj)}
          className={clsx(
            "px-3 py-1.5 text-[9px] font-black tracking-wider uppercase rounded-lg border transition-all",
            inflationAdj
              ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
              : "bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-400"
          )}
        >
          INFLATION ADJ.
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {metrics.map((m) => (
          <MetricCard key={m.label} m={m} onNoteAction={onNoteAction} />
        ))}
      </div>
    </div>
  )
}

function MetricCard({
  m,
  onNoteAction,
}: {
  m: any
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Determine what value to show: hovered or latest (which is the last item in the history array since it's reversed chronologically for the chart)
  const displayValue = hoveredIndex !== null
    ? m.history[hoveredIndex]
    : m.history[m.history.length - 1] ?? 0

  // Format the display value
  const displayValueStr = m.formatChart ? m.formatChart(displayValue) : formatCr(displayValue)

  // Determine what year label to show
  const displayYear = hoveredIndex !== null && m.yearLabels[hoveredIndex]
    ? m.yearLabels[hoveredIndex]
    : "LATEST"

  return (
    <div className="group relative bg-[#0a0a0a]/60 backdrop-blur-2xl p-5 flex flex-col justify-between transition-all duration-500 hover:bg-[#0f0f11]/80 hover:shadow-[0_8px_30px_rgba(34,211,238,0.12)] border border-white/10 hover:border-cyan-500/30 rounded-2xl overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4 relative z-20">
        <span className="text-[10px] md:text-[11px] font-black text-zinc-400 tracking-[0.2em] uppercase flex items-center gap-2">
          {m.label}
          {hoveredIndex !== null && (
            <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded text-[9px] animate-in fade-in zoom-in duration-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              {displayYear}
            </span>
          )}
        </span>
        {m.yoy != null && hoveredIndex === null && (
          <div
            className={clsx(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-black transition-all border shadow-sm",
              m.yoy >= 0
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10"
                : "text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10"
            )}
          >
            {m.yoy >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {m.yoy >= 0 ? "+" : ""}
            {m.yoy.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex items-end justify-between relative z-10">
        {/* Left Side: Numbers and Stats */}
        <div className="flex flex-col gap-3 w-[55%]">
          <button
            onClick={() =>
              onNoteAction?.({
                title: `Metric: ${m.label}`,
                content: `Detailed analysis of ${m.label}: Current value is ${m.valueStr}. YoY growth is ${m.yoy?.toFixed(1) ?? "—"}%.`,
                type: "note",
              })
            }
            className="flex items-baseline text-left hover:scale-[1.02] transition-transform origin-left group/value"
          >
            <span className={clsx(
              "text-3xl sm:text-4xl font-black tabular-nums tracking-tighter transition-colors duration-300 drop-shadow-md",
              hoveredIndex !== null ? "text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" : "text-white"
            )}>
              {displayValueStr.replace(" Cr", "")}
            </span>
            <span className="text-xs sm:text-sm font-bold text-zinc-500 ml-1">
              {m.label === "EPS" ? "" : "Cr"}
            </span>
            <PenSquare className="h-3 w-3 ml-2 text-cyan-500 opacity-0 group-hover/value:opacity-100 transition-opacity" />
          </button>

          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-3">
              <span className={clsx("text-[9px] font-bold tabular-nums flex items-center gap-1 transition-opacity duration-200", hoveredIndex !== null ? "opacity-30" : "opacity-100")}>
                <span className="text-zinc-500">3Y</span>
                <span className={m.cagr3 != null && m.cagr3 >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {m.cagr3 != null ? `${m.cagr3 >= 0 ? "+" : ""}${m.cagr3.toFixed(0)}%` : "—"}
                </span>
              </span>
              <span className={clsx("text-[9px] font-bold tabular-nums flex items-center gap-1 transition-opacity duration-200", hoveredIndex !== null ? "opacity-30" : "opacity-100")}>
                <span className="text-zinc-500">5Y</span>
                <span className={m.cagr5 != null && m.cagr5 >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {m.cagr5 != null ? `${m.cagr5 >= 0 ? "+" : ""}${m.cagr5.toFixed(0)}%` : "—"}
                </span>
              </span>
            </div>
            <p className={clsx(
              "text-[9px] font-bold text-zinc-500 transition-opacity duration-200 flex gap-1",
              hoveredIndex !== null ? "opacity-30" : "opacity-100"
            )}>
              HIST AVG <span className="text-zinc-300 ml-0.5">{m.histAvg != null ? (m.label === "EPS" ? formatEps(m.histAvg) : formatCr(m.histAvg).replace(" Cr", "")) : "—"}</span>
            </p>
          </div>
        </div>

        {/* Right Side: Mini Bar Chart */}
        <div className="w-[45%] h-[60px] sm:h-[70px] flex justify-end items-end relative z-0">
          <MiniBarChart
            data={m.history}
            labels={m.yearLabels}
            width={120}
            height={70}
            color={m.yoy != null && m.yoy >= 0 ? "#10b981" : "#f43f5e"}
            formatValue={m.formatChart ?? ((v: number) => v.toLocaleString("en-IN"))}
            onHoverChange={setHoveredIndex}
          />
        </div>
      </div>

      {/* Glassmorphism Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] via-transparent to-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="absolute -inset-px rounded-3xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, #fff, transparent)' }} />
    </div>
  )
}
