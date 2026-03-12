"use client"

import { useState, useMemo, Fragment } from "react"
import { clsx } from "clsx"
import { formatFinancialCell } from "@/lib/format-numbers"
import { sortByPeriodAsc } from "@/lib/format-period"
import { PenSquare, ArrowUpRight, Download, Plus, Minus } from "lucide-react"

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
  onViewChange?: (view: "c" | "s") => void
  onActionClick?: () => void
  actionLabel?: string
  actionIcon?: React.ReactNode
  /** Keys for rows that should be bold with darker background */
  highlightKeys?: string[]
  /** Optional subtitle, e.g. "Consolidated Figures in Rs. Crores" */
  subtitle?: string
  /** Period order: "asc" = 2018-2025 left to right (chronological), "desc" = newest first */
  periodOrder?: "asc" | "desc"
  /** Custom cell formatter — overrides default formatFinancialCell when provided. row is the full data row for cross-field computation. */
  formatCell?: (value: string | number | undefined, key: string, row?: FinancialRow) => string
  /** Object mapping parent key to an array of child sub-item keys for expand/collapse functionality */
  expandableStructure?: Record<string, string[]>
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
  highlightKeys = [],
  subtitle,
  periodOrder = "asc",
  formatCell: formatCellOverride,
  expandableStructure,
}: FundamentalsTableProps) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const isHighlight = (key: string) => highlightKeys.includes(key)

  const sortedData = useMemo(() => {
    if (periodOrder === "asc") return sortByPeriodAsc(data)
    return [...data].sort((a, b) => {
      const ka = (a.header ?? a.year ?? "") as string | number
      const kb = (b.header ?? b.year ?? "") as string | number
      const ya = typeof ka === "number" ? ka : parseInt(String(ka).replace(/\D/g, ""), 10) || 0
      const yb = typeof kb === "number" ? kb : parseInt(String(kb).replace(/\D/g, ""), 10) || 0
      return yb - ya
    })
  }, [data, periodOrder])

  const periods = sortedData.map((r) => String(r.header ?? r.year ?? "—"))
  const cellFormatter = formatCellOverride ?? formatFinancialCell

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportCsv = () => {
    const header = ["Line Item", ...periods]
    const rows: string[][] = []

    lineItemKeys.forEach((key) => {
      // Parent row
      const preppedRow = [toLabel(key), ...periods.map((_, i) => {
        const row = sortedData[i] as FinancialRow
        return cellFormatter(row?.[key], key, row)
      })]
      rows.push(preppedRow)

      // Child rows
      const children = expandableStructure?.[key]
      if (children && children.length > 0) {
        children.forEach(childKey => {
          const childRow = [`  ${toLabel(childKey)}`, ...periods.map((_, i) => {
            const row = sortedData[i] as FinancialRow
            return cellFormatter(row?.[childKey], childKey, row)
          })]
          rows.push(childRow)
        })
      }
    })

    const csv = [header.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (data.length === 0) return null

  return (
    <div className="rounded-2xl bg-zinc-950/60 border border-white/[0.07] overflow-hidden shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] transition-all duration-500 hover:border-white/[0.12]">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-zinc-950/90 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-cyan-400 rounded-full" />
            <h3 className="text-[13px] font-bold tracking-wide uppercase text-zinc-300">
              {title}
              <span className="text-zinc-600 ml-2 text-[11px] font-medium tracking-normal lowercase">(₹ Cr)</span>
            </h3>
          </div>
          {subtitle && (
            <p className="text-[11px] text-zinc-600 ml-[18px] font-normal">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={exportCsv}
            className="px-3.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          {onActionClick && (
            <button
              onClick={onActionClick}
              className="px-3.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all flex items-center gap-1.5 group"
            >
              {actionIcon} {actionLabel}
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <div className="flex rounded-lg p-0.5 bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => onViewChange?.("c")}
              className={clsx(
                "px-3.5 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all duration-200",
                view === "c"
                  ? "bg-cyan-400 text-zinc-950 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Consolidated
            </button>
            <button
              onClick={() => onViewChange?.("s")}
              className={clsx(
                "px-3.5 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-md transition-all duration-200",
                view === "s"
                  ? "bg-cyan-400 text-zinc-950 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Standalone
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left min-w-[700px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/[0.08]">
              <th className="sticky left-0 z-20 py-3.5 px-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 whitespace-nowrap bg-zinc-950/95 backdrop-blur-xl shadow-[2px_0_6px_rgba(0,0,0,0.4)]">
                &nbsp;
              </th>
              {periods.map((p, i) => (
                <th
                  key={`period-${i}-${p}`}
                  onMouseEnter={() => setHoveredCol(i)}
                  onMouseLeave={() => setHoveredCol(null)}
                  className={clsx(
                    "py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-right bg-zinc-950/95 backdrop-blur-xl border-l border-white/[0.04] cursor-default transition-colors duration-150",
                    (periodOrder === "asc" ? i === periods.length - 1 : i === 0)
                      ? "text-cyan-400"
                      : "text-zinc-600",
                    hoveredCol === i && "text-cyan-300 bg-cyan-500/[0.04]"
                  )}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItemKeys.map((key) => {
              const label = toLabel(key)
              // If label has a '+' suffix and we have children, strip the '+' because we'll render an actual icon
              const activeLabel = label.endsWith('+') ? label.slice(0, -1) : label

              const highlight = isHighlight(key)
              const children = expandableStructure?.[key]
              const isExpandable = Boolean(children && children.length > 0)
              const isExpanded = expandedKeys.has(key)

              return (
                <Fragment key={key}>
                  {/* ── Parent Row ── */}
                  <tr
                    className={clsx(
                      "group transition-colors duration-200 border-b",
                      highlight
                        ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
                        : "border-white/[0.03] hover:bg-white/[0.02]"
                    )}
                  >
                    <td
                      className={clsx(
                        "sticky left-0 z-10 py-3 px-6 whitespace-nowrap shadow-[2px_0_6px_rgba(0,0,0,0.3)] transition-colors duration-200",
                        highlight
                          ? "bg-white/[0.03] group-hover:bg-white/[0.05] text-[13px] font-bold text-zinc-200 border-l-2 border-l-cyan-400/60"
                          : "bg-zinc-950/95 group-hover:bg-zinc-900/80 text-[13px] font-medium text-zinc-500 group-hover:text-zinc-300 border-l-2 border-l-transparent",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="leading-tight">{activeLabel}</span>
                        {isExpandable && (
                          <button
                            onClick={() => toggleExpand(key)}
                            className="inline-flex items-center justify-center w-4 h-4 rounded text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.06] transition-all cursor-pointer"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {periods.map((_, i) => {
                      const row = sortedData[i] as FinancialRow
                      const v = row?.[key]
                      const formatted = cellFormatter(v, key, row)
                      const isNegative = typeof v === "number" && v < 0

                      return (
                        <td
                          key={`parent-${key}-${i}`}
                          onMouseEnter={() => setHoveredCol(i)}
                          onMouseLeave={() => setHoveredCol(null)}
                          className={clsx(
                            "py-3 px-4 tabular-nums text-right border-l border-white/[0.03] transition-colors duration-150",
                            highlight ? "text-[13px] font-semibold" : "text-[12px] font-normal",
                            (periodOrder === "asc" ? i === periods.length - 1 : i === 0) && "bg-cyan-500/[0.02]",
                            hoveredCol === i && "bg-cyan-500/[0.04]",
                            isNegative
                              ? "text-rose-400/90"
                              : highlight
                                ? "text-zinc-200 group-hover:text-white"
                                : "text-zinc-500 group-hover:text-zinc-300",
                            formatted === "—" && "!text-zinc-800"
                          )}
                        >
                          {formatted}
                        </td>
                      )
                    })}
                  </tr>

                  {/* ── Child Rows ── */}
                  {isExpanded && isExpandable && children && children.map((childKey, childIdx) => {
                    const childLabel = toLabel(childKey)
                    return (
                      <tr
                        key={`child-${key}-${childKey}`}
                        className="group border-b border-white/[0.015] hover:bg-white/[0.02] bg-black/20"
                        style={{
                          animation: `expandRow 0.25s ease-out ${childIdx * 0.03}s both`,
                        }}
                      >
                        <td className="sticky left-0 z-10 py-2.5 px-6 whitespace-nowrap shadow-[2px_0_6px_rgba(0,0,0,0.3)] bg-zinc-950/95 transition-colors text-[12px] font-normal text-zinc-500 group-hover:text-zinc-400 border-l-2 border-l-transparent">
                          <div className="flex items-center gap-2 pl-9">
                            <span className="leading-tight opacity-90">{childLabel}</span>
                          </div>
                        </td>
                        {periods.map((_, i) => {
                          const row = sortedData[i] as FinancialRow
                          const v = row?.[childKey]
                          const formatted = cellFormatter(v, childKey, row)
                          const isNegative = typeof v === "number" && v < 0

                          return (
                            <td
                              key={`child-cell-${childKey}-${i}`}
                              onMouseEnter={() => setHoveredCol(i)}
                              onMouseLeave={() => setHoveredCol(null)}
                              className={clsx(
                                "py-2.5 px-4 tabular-nums text-right border-l border-white/[0.02] transition-colors text-[11.5px] font-normal",
                                (periodOrder === "asc" ? i === periods.length - 1 : i === 0) && "bg-cyan-500/[0.01]",
                                hoveredCol === i && "bg-cyan-500/[0.03]",
                                isNegative ? "text-rose-400/80" : "text-zinc-500 group-hover:text-zinc-400",
                                formatted === "—" && "!text-zinc-800/50"
                              )}
                            >
                              {formatted}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
