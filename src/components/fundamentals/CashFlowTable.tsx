"use client"

import { useState, useMemo } from "react"
import { FundamentalsTable } from "./FundamentalsTable"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface CashFlowTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    cashFromOperatingActivity: "Cash from Operating",
    cashFromInvestingActivity: "Cash from Investing",
    cashFromFinancingActivity: "Cash from Financing",
    netCashFlow: "Net Cash Flow",
    income: "Income",
    adjForDepreciationAndAmortisationExpense: "Adj Depreciation",
    adjForDividendIncome: "Adj Dividend Income",
    adjForFairValueGainsLosses: "Adj Fair Value",
    adjForFinanceCosts: "Adj Finance Costs",
    adjForImpairmentLossReversal: "Adj Impairment",
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

export function CashFlowTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
  onNoteAction,
}: CashFlowTableProps) {
  const [view, setView] = useState<"c" | "s">("c")
  const data = view === "c" ? (dataConsolidated ?? []) : (dataStandalone ?? [])

  const { lineItemKeys } = useMemo(() => {
    if (data.length === 0) return { lineItemKeys: [] as string[] }
    const keySet = new Set<string>()
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "header" && k !== "year" && (typeof row[k] === "number" || (typeof row[k] === "string" && !isNaN(Number(row[k]))))) {
          keySet.add(k)
        }
      })
    })
    return { lineItemKeys: Array.from(keySet).slice(0, 16) }
  }, [data])

  if (data.length === 0) return null

  return (
    <FundamentalsTable
      title="Cash Flows"
      data={data}
      lineItemKeys={lineItemKeys}
      toLabel={toLabel}
      view={view}
      onViewChange={setView}
      onNoteAction={onNoteAction}
    />
  )
}
