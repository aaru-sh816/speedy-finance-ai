"use client"

import { useState, useMemo } from "react"
import { ProductSegmentsModal } from "./ProductSegmentsModal"
import { PieChart } from "lucide-react"
import { FundamentalsTable } from "./FundamentalsTable"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface IncomeStatementTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
  dataTtm?: FinancialRow[] | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    revenueFromOperations: "Revenue",
    operatingRevenue: "Operating Revenue",
    sales: "Sales",
    income: "Income",
    expenses: "Expenses",
    profitBeforeTax: "PBT",
    profitLossForPeriod: "PAT",
    EPS: "EPS",
    eps: "EPS",
    EBIT: "EBIT",
    EBITDA: "EBITDA",
    grossIncome: "Gross Income",
    operatingProfit: "Operating Profit",
    costOfMaterialsConsumed: "Cost of Materials",
    changesInInventories: "Changes in Inventories",
    totalIncome: "Total Income",
    totalExpenses: "Total Expenses",
    exceptionalItemsBeforeTax: "Exceptional Items",
    extraordinaryItems: "Extraordinary Items",
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

export function IncomeStatementTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
  dataTtm,
  onNoteAction,
}: IncomeStatementTableProps) {
  const [view, setView] = useState<"c" | "s">("c")
  const [productSegmentsOpen, setProductSegmentsOpen] = useState(false)
  const base = view === "c" ? (dataConsolidated ?? []) : (dataStandalone ?? [])
  const ttm = dataTtm ?? []
  
  const data = useMemo(() => {
    const d = [...base]
    if (ttm.length > 0) d.push({ ...ttm[0], header: "TTM" } as FinancialRow)
    return d
  }, [base, ttm])

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
    return { lineItemKeys: Array.from(keySet).slice(0, 18) }
  }, [data])

  if (data.length === 0) return null

  return (
    <>
      <FundamentalsTable
        title="Profit & Loss"
        data={data}
        lineItemKeys={lineItemKeys}
        toLabel={toLabel}
        view={view}
        onViewChange={setView}
        onActionClick={() => setProductSegmentsOpen(true)}
        actionLabel="Product Segments"
        actionIcon={<PieChart className="h-3 w-3" />}
        onNoteAction={onNoteAction}
      />

      <ProductSegmentsModal
        scripCode={scripCode}
        period="annual"
        isOpen={productSegmentsOpen}
        onClose={() => setProductSegmentsOpen(false)}
      />
    </>
  )
}
