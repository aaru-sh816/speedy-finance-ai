"use client"

import { useState, useMemo, useCallback } from "react"
import { ProductSegmentsModal } from "./ProductSegmentsModal"
import { PieChart } from "lucide-react"
import { FundamentalsTable } from "./FundamentalsTable"
import { formatCr } from "@/lib/format-numbers"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface QuarterlyResultsTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    header: "Period",
    year: "Year",
    revenueFromOperations: "Sales+",
    revenue: "Sales+",
    sales: "Sales+",
    operatingRevenue: "Operating Revenue",
    income: "Income",
    expenses: "Expenses+",
    totalExpenses: "Expenses+",
    operatingProfit: "Operating Profit",
    opm: "OPM %",
    operatingMargin: "OPM %",
    otherIncome: "Other Income+",
    interest: "Interest",
    financeCosts: "Interest",
    depreciation: "Depreciation",
    depreciationAmortisation: "Depreciation",
    profitBeforeTax: "Profit before tax",
    pbt: "Profit before tax",
    tax: "Tax %",
    currentTax: "Tax %",
    deferredTax: "Deferred Tax",
    netProfit: "Net Profit+",
    profitLossForPeriod: "Net Profit+",
    pat: "Net Profit+",
    EPS: "EPS in Rs",
    eps: "EPS in Rs",
    ebit: "EBIT",
    ebitda: "EBITDA",
    grossIncome: "Gross Income",
    costOfMaterialsConsumed: "Material Cost", // Sub-item
    changesInInventories: "Change in Inventory", // Sub-item
    costOfGoodsSold: "Cost of Goods Sold", // Sub-item
    employeeBenefitExpense: "Employee Cost", // Sub-item
    otherExpenses: "Other Cost", // Sub-item
    totalIncome: "Total Income",
    exceptionalItems: "Exceptional Items", // Sub-item
    dividendIncome: "Dividend Income", // Sub-item
    minorityInterest: "Minority Share", // Sub-item
    profitFromAssociates: "Profit from Associates", // Sub-item
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

// Screener-style parent to children mapping
const RAW_EXPANDABLE_STRUCTURE: Record<string, string[]> = {
  expenses: ["costOfMaterialsConsumed", "changesInInventories", "employeeBenefitExpense", "otherExpenses", "costOfGoodsSold"],
  totalExpenses: ["costOfMaterialsConsumed", "changesInInventories", "employeeBenefitExpense", "otherExpenses", "costOfGoodsSold"],
  otherIncome: ["exceptionalItems", "dividendIncome"],
  netProfit: ["profitFromAssociates", "minorityInterest"],
  profitLossForPeriod: ["profitFromAssociates", "minorityInterest"],
  pat: ["profitFromAssociates", "minorityInterest"],
  profitBeforeTax: ["exceptionalItemsBeforeTax"]
}

export function QuarterlyResultsTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
}: QuarterlyResultsTableProps) {
  const hasConsolidated = dataConsolidated != null && dataConsolidated.length > 0;
  const hasStandalone = dataStandalone != null && dataStandalone.length > 0;
  const [selectedView, setView] = useState<"c" | "s">("c")
  const [productSegmentsOpen, setProductSegmentsOpen] = useState(false)

  const view = selectedView === "s" && !hasStandalone ? "c" : selectedView === "c" && !hasConsolidated ? "s" : selectedView
  const data = view === "c" ? (dataConsolidated ?? []) : (dataStandalone ?? [])
  const canToggle = hasConsolidated && hasStandalone;

  const QUARTERLY_ORDER = [
    "revenueFromOperations", "revenue", "sales",
    "expenses", "totalExpenses",
    "operatingProfit",
    "opm", "operatingMargin",
    "otherIncome",
    "interest", "financeCosts",
    "depreciation", "depreciationAmortisation",
    "profitBeforeTax", "pbt",
    "tax", "currentTax",
    "profitLossForPeriod", "netProfit", "pat",
    "EPS", "eps",
  ]

  const { lineItemKeys, expandableStructure } = useMemo(() => {
    if (data.length === 0) return { lineItemKeys: [] as string[], expandableStructure: {} }
    const keySet = new Set<string>()
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "header" && k !== "year" && (typeof row[k] === "number" || (typeof row[k] === "string" && !isNaN(Number(row[k]))))) {
          keySet.add(k)
        }
      })
    })
    const availableKeys = Array.from(keySet)

    // Filter expandable structure to only include keys actually present in the data
    const activeExpandableStructure: Record<string, string[]> = {}
    let allChildKeys = new Set<string>()

    Object.entries(RAW_EXPANDABLE_STRUCTURE).forEach(([parent, children]) => {
      if (availableKeys.includes(parent)) {
        const activeChildren = children.filter(c => availableKeys.includes(c))
        if (activeChildren.length > 0) {
          activeExpandableStructure[parent] = activeChildren
          activeChildren.forEach(c => allChildKeys.add(c))
        }
      }
    })

    // Filter out child keys from the main line item list so they ONLY appear under parents
    const parentLevelKeys = availableKeys.filter(k => !allChildKeys.has(k))

    const ordered = QUARTERLY_ORDER.filter((k) => parentLevelKeys.includes(k))
    const rest = parentLevelKeys.filter((k) => !QUARTERLY_ORDER.includes(k))

    return {
      lineItemKeys: [...ordered, ...rest].slice(0, 16),
      expandableStructure: activeExpandableStructure
    }
  }, [data])

  const screenerFormatCell = useCallback(
    (v: string | number | undefined, key: string, row?: FinancialRow): string => {
      if (v == null || v === "") return "—"
      const n = Number(v)
      if (!Number.isFinite(n)) return String(v)
      const k = key.toLowerCase()

      if (k === "opm" || k === "operatingmargin") {
        if (Math.abs(n) <= 1) return `${Math.round(n * 100)}%`
        if (Math.abs(n) <= 100) return `${Math.round(n)}%`
        if (row) {
          const rev = Number(row.revenueFromOperations ?? row.revenue ?? row.sales ?? 0)
          const op = Number(row.operatingProfit ?? 0)
          if (rev > 0 && op !== 0) return `${Math.round((op / rev) * 100)}%`
        }
        return `${Math.round(n)}%`
      }

      if (k === "tax" || k === "currenttax") {
        if (Math.abs(n) <= 100) return `${Math.round(n)}%`
        if (row) {
          const pbt = Number(row.profitBeforeTax ?? row.pbt ?? 0)
          if (pbt !== 0) return `${Math.round((n / pbt) * 100)}%`
        }
        return "—"
      }

      if (k === "eps") {
        return n.toFixed(2)
      }

      return formatCr(n)
    },
    []
  )

  if (data.length === 0) return null

  return (
    <>
      <FundamentalsTable
        title="Quarterly Results"
        data={data}
        lineItemKeys={lineItemKeys}
        expandableStructure={expandableStructure}
        toLabel={toLabel}
        view={view}
        onViewChange={canToggle ? (v) => setView(v) : undefined}
        onActionClick={() => setProductSegmentsOpen(true)}
        actionLabel="Product Segments"
        actionIcon={<PieChart className="h-3 w-3" />}
        highlightKeys={[
          "revenueFromOperations", "revenue", "sales",
          "expenses", "totalExpenses",
          "operatingProfit",
          "otherIncome",
          "profitBeforeTax", "pbt",
          "profitLossForPeriod", "netProfit", "pat",
        ]}
        subtitle={view === "c" ? "Consolidated Figures in Rs. Crores / View Standalone" : "Standalone Figures in Rs. Crores / View Consolidated"}
        periodOrder="asc"
        formatCell={screenerFormatCell}
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
