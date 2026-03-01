"use client"

import { clsx } from "clsx"
import { formatFinancialCell } from "@/lib/format-numbers"
import { PenSquare, ArrowUpRight } from "lucide-react"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface FundamentalsTableProps {
  title: string
  data: FinancialRow[]
  lineItemKeys: string[]
  toLabel: (key: string) => string
  view: "c" | "s"
  onViewChange: (view: "c" | "s") => void
  onActionClick?: () => void
  actionLabel?: string
  actionIcon?: React.ReactNode
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

export function FundamentalsTable({
  title,
  data,
  lineItemKeys,
  toLabel,
  view,
  onViewChange,
  onActionClick,
  actionLabel,
  actionIcon,
  onNoteAction,
}: FundamentalsTableProps) {
  const periods = data.map((r) => String(r.header ?? r.year ?? "—"))

  if (data.length === 0) return null

  return (
    <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-white/20">
      <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500">
            {title} <span className="text-zinc-700 ml-2 font-mono opacity-50 tracking-normal">(₹ CR)</span>
          </h3>
        </div>
        
        <div className="flex items-center gap-4">
          {onActionClick && (
            <button
              onClick={onActionClick}
              className="px-4 py-2 text-[10px] font-black tracking-[0.15em] uppercase rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-2 group"
            >
              {actionIcon} {actionLabel}
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <div className="flex rounded-xl p-1 bg-black/40 border border-white/5">
            <button
              onClick={() => onViewChange("c")}
              className={clsx(
                "px-4 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all",
                view === "c"
                  ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              CONSOLIDATED
            </button>
            <button
              onClick={() => onViewChange("s")}
              className={clsx(
                "px-4 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all",
                view === "s"
                  ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              STANDALONE
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left min-w-[700px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/10">
              <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 whitespace-nowrap bg-zinc-950 backdrop-blur-md">
                LINE ITEM
              </th>
              {periods.map((p, i) => (
                <th
                  key={`period-${i}-${p}`}
                  className={clsx(
                    "py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em] font-mono whitespace-nowrap text-right bg-zinc-950 backdrop-blur-md border-l border-white/5",
                    i === 0 ? "text-cyan-400 shadow-[inset_0_-2px_0_0_rgba(34,211,238,0.5)]" : "text-zinc-600"
                  )}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lineItemKeys.map((key) => {
              const label = toLabel(key)
              return (
                <tr
                  key={key}
                  className="group hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-4 px-6 text-[11px] font-black tracking-tight text-zinc-500 group-hover:text-white transition-colors whitespace-nowrap">
                    <div className="flex items-center justify-between">
                      {label}
                      {onNoteAction && (
                        <button
                          onClick={() => onNoteAction({
                            title: `Note: ${label}`,
                            content: `Strategic research on ${label}...`,
                            type: "note"
                          })}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-cyan-500 transition-all"
                        >
                          <PenSquare className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  {periods.map((_, i) => {
                    const row = data[i] as FinancialRow
                    const v = row?.[key]
                    const formatted = formatFinancialCell(v, key)
                    const isNegative = typeof v === "number" && v < 0
                    
                    return (
                      <td
                        key={i}
                        className={clsx(
                          "py-4 px-5 font-mono text-xs font-black tabular-nums text-right border-l border-white/[0.03] transition-colors",
                          i === 0 ? "bg-cyan-500/[0.02]" : "",
                          isNegative ? "text-rose-400" : "text-zinc-400 group-hover:text-zinc-200",
                          formatted === "—" && "text-zinc-800"
                        )}
                      >
                        {formatted}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
