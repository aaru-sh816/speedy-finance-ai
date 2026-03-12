"use client"

import { useState, useMemo, useCallback } from "react"
import { FundamentalsTable } from "./FundamentalsTable"
import { formatRatioCell } from "@/lib/format-numbers"

interface RatioRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface FinancialRow {
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
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    returnOnEquity: "Return on Equity",
    returnOnAsset: "Return on Asset",
    returnOnCapital: "ROCE %",
    roce: "ROCE %",
    grossMargin: "Gross Margin",
    netMargin: "Net Margin",
    operatingMargin: "Operating Margin",
    ebitMargin: "EBIT Margin",
    ebitdaMargin: "EBITDA Margin",
    dividendPayout: "Dividend Payout",
    retentionRatio: "Retention Ratio",
    debtorDays: "Debtor Days",
    creditorDays: "Days Payable",
    daysPayable: "Days Payable",
    inventoryDays: "Inventory Days",
    inventoryTurnover: "Inventory Turnover",
    assetTurnover: "Asset Turnover",
    cashConversionCycle: "Cash Conversion Cycle",
    workingCapitalDays: "Working Capital Days",
    receivableTurnover: "Receivable Turnover",
    payableTurnover: "Payable Turnover",
    currentRatio: "Current Ratio",
    quickRatio: "Quick Ratio",
    cashRatio: "Cash Ratio",
    interestCoverage: "Interest Coverage",
    debtToEquity: "Debt/Equity",
    debtEquity: "Debt/Equity",
    workingCapitalTurnover: "Working Capital Turnover",
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
        ; (existing as Record<string, unknown>)[k] = v
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
    return aYear - bYear // Ascending: 2018-2025 left to right
  })
  const rows = periods.map((p) => periodMap.get(p) as RatioRow).filter(Boolean)
  return { rows, allKeys }
}

// Screener.in ratio order
const RATIO_ORDER = [
  "debtorDays",
  "inventoryDays",
  "daysPayable", "creditorDays",
  "cashConversionCycle",
  "workingCapitalDays",
  "returnOnCapital", "roce",
]

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
}: RatiosTableProps) {
  const hasConsolidated =
    (dataConsolidatedPr && dataConsolidatedPr.length > 0) ||
    (dataConsolidatedEf && dataConsolidatedEf.length > 0) ||
    (dataConsolidatedLi && dataConsolidatedLi.length > 0) ||
    (dataConsolidatedLe && dataConsolidatedLe.length > 0);

  const hasStandalone =
    (dataStandalonePr && dataStandalonePr.length > 0) ||
    (dataStandaloneEf && dataStandaloneEf.length > 0) ||
    (dataStandaloneLi && dataStandaloneLi.length > 0) ||
    (dataStandaloneLe && dataStandaloneLe.length > 0);

  const [selectedView, setView] = useState<"c" | "s">("c")
  const view = selectedView === "s" && !hasStandalone ? "c" : selectedView === "c" && !hasConsolidated ? "s" : selectedView
  const canToggle = hasConsolidated && hasStandalone;
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

  const lineItemKeys = useMemo(() => {
    const keys = Array.from(allKeys).filter((k) => k !== "header" && k !== "year")
    const ordered = RATIO_ORDER.filter((k) => keys.includes(k))
    const rest = keys.filter((k) => !RATIO_ORDER.includes(k))
    return [...ordered, ...rest]
  }, [allKeys])

  // Screener-style ratio formatting: ROCE as %, days as integers, turnover as decimals
  const ratioFormatCell = useCallback(
    (v: string | number | undefined, key: string, _row?: FinancialRow): string => {
      return formatRatioCell(v, key)
    },
    []
  )

  if (rows.length === 0 && lineItemKeys.length === 0) return null

  return (
    <FundamentalsTable
      title="Ratios"
      data={rows}
      lineItemKeys={lineItemKeys}
      toLabel={toLabel}
      view={view}
      onViewChange={canToggle ? (v) => setView(v) : undefined}
      highlightKeys={["returnOnCapital", "roce"]}
      subtitle={view === "c" ? "Consolidated Figures in Rs. Crores / View Standalone" : "Standalone Figures in Rs. Crores / View Consolidated"}
      periodOrder="asc"
      formatCell={ratioFormatCell}
    />
  )
}
