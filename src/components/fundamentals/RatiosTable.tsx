"use client"

import { useState, useMemo } from "react"
import { FundamentalsTable } from "./FundamentalsTable"

interface RatioRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface RatiosTableProps {
  scripCode: string
  dataConsolidatedPr?: RatioRow[] | null
  dataConsolidatedEf?: RatioRow[] | null
  dataConsolidatedLi?: RatioRow[] | null
  dataConsolidatedLe?: RatioRow[] | null
  dataStandalonePr?: RatioRow[] | null
  dataStandaloneEf?: RatioRow[] | null
  dataStandaloneLi?: RatioRow[] | null
  dataStandaloneLe?: RatioRow[] | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    returnOnEquity: "Return on Equity",
    returnOnAsset: "Return on Asset",
    returnOnCapital: "Return on Capital",
    grossMargin: "Gross Margin",
    netMargin: "Net Margin",
    operatingMargin: "Operating Margin",
    ebitMargin: "EBIT Margin",
    ebitdaMargin: "EBITDA Margin",
    dividendPayout: "Dividend Payout",
    retentionRatio: "Retention Ratio",
    debtorDays: "Debtor Days",
    creditorDays: "Creditor Days",
    inventoryDays: "Inventory Days",
    inventoryTurnover: "Inventory Turnover",
    assetTurnover: "Asset Turnover",
    currentRatio: "Current Ratio",
    quickRatio: "Quick Ratio",
    cashRatio: "Cash Ratio",
    interestCoverage: "Interest Coverage",
    debtToEquity: "Debt/Equity",
    debtEquity: "Debt/Equity",
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

function mergeRatioRows(
  pr: RatioRow[],
  ef: RatioRow[],
  li: RatioRow[],
  le: RatioRow[]
): { rows: RatioRow[]; allKeys: Set<string> } {
  const periodMap = new Map<string, Record<string, number | string | undefined>>()
  const addRow = (r: RatioRow) => {
    const period = String(r.header ?? r.year ?? "")
    if (!period) return
    const existing = periodMap.get(period) ?? { header: r.header ?? r.year, year: r.year }
    Object.entries(r).forEach(([k, v]) => {
      if (k !== "header" && k !== "year" && (typeof v === "number" || (typeof v === "string" && !isNaN(Number(v))))) {
        ;(existing as Record<string, unknown>)[k] = v
      }
    })
    periodMap.set(period, existing)
  }
  pr.forEach(addRow)
  ef.forEach(addRow)
  li.forEach(addRow)
  le.forEach(addRow)
  const allKeys = new Set<string>()
  periodMap.forEach((row) => {
    Object.keys(row).forEach((k) => {
      if (k !== "header" && k !== "year") allKeys.add(k)
    })
  })
  const periods = Array.from(periodMap.keys()).sort((a, b) => {
    const aYear = parseInt(a.replace(/\D/g, ""), 10) || 0
    const bYear = parseInt(b.replace(/\D/g, ""), 10) || 0
    return bYear - aYear // Changed to descending to match other tables
  })
  const rows = periods.map((p) => periodMap.get(p) as RatioRow).filter(Boolean)
  return { rows, allKeys }
}

export function RatiosTable({
  scripCode,
  dataConsolidatedPr = [],
  dataConsolidatedEf = [],
  dataConsolidatedLi = [],
  dataConsolidatedLe = [],
  dataStandalonePr = [],
  dataStandaloneEf = [],
  dataStandaloneLi = [],
  dataStandaloneLe = [],
  onNoteAction,
}: RatiosTableProps) {
  const [view, setView] = useState<"c" | "s">("c")
  const { rows, allKeys } = useMemo(() => {
    const pr = view === "c" ? (dataConsolidatedPr ?? []) : (dataStandalonePr ?? [])
    const ef = view === "c" ? (dataConsolidatedEf ?? []) : (dataStandaloneEf ?? [])
    const li = view === "c" ? (dataConsolidatedLi ?? []) : (dataStandaloneLi ?? [])
    const le = view === "c" ? (dataConsolidatedLe ?? []) : (dataStandaloneLe ?? [])
    return mergeRatioRows(pr, ef, li, le)
  }, [
    view,
    dataConsolidatedPr,
    dataConsolidatedEf,
    dataConsolidatedLi,
    dataConsolidatedLe,
    dataStandalonePr,
    dataStandaloneEf,
    dataStandaloneLi,
    dataStandaloneLe,
  ])

  const lineItemKeys = Array.from(allKeys).filter((k) => k !== "header" && k !== "year")

  if (rows.length === 0 && lineItemKeys.length === 0) return null

  return (
    <FundamentalsTable
      title="Ratios"
      data={rows}
      lineItemKeys={lineItemKeys}
      toLabel={toLabel}
      view={view}
      onViewChange={setView}
      onNoteAction={onNoteAction}
    />
  )
}
