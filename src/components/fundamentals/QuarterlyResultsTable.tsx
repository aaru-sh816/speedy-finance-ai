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

interface QuarterlyResultsTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    header: "Period",
    year: "Year",
    revenueFromOperations: "Revenue",
    operatingRevenue: "Operating Revenue",
    sales: "Sales",
    income: "Income",
    expenses: "Expenses",
    profitBeforeTax: "PBT",
    profitLossForPeriod: "PAT",
    EPS: "EPS",
    eps: "EPS",
    ebit: "EBIT",
    ebitda: "EBITDA",
    grossIncome: "Gross Income",
    operatingProfit: "Operating Profit",
    costOfMaterialsConsumed: "Cost of Materials",
    changesInInventories: "Changes in Inventories",
    costOfGoodsSold: "Cost of Goods Sold",
    currentTax: "Current Tax",
    deferredTax: "Deferred Tax",
    totalIncome: "Total Income",
    totalExpenses: "Total Expenses",
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

export function QuarterlyResultsTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
  onNoteAction,
}: QuarterlyResultsTableProps) {
  const [view, setView] = useState<"c" | "s">("c")
  const [productSegmentsOpen, setProductSegmentsOpen] = useState(false)
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
    <>
      <FundamentalsTable
        title="Quarterly Results"
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
        period="quarterly"
        isOpen={productSegmentsOpen}
        onClose={() => setProductSegmentsOpen(false)}
      />
    </>
  )
}
