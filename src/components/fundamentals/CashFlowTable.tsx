"use client"

import { useState, useMemo, useCallback } from "react"
import { FundamentalsTable } from "./FundamentalsTable"
import { formatCr } from "@/lib/format-numbers"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface CashFlowTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    cashFromOperatingActivity: "Cash from Operating Activity+",
    cashFromInvestingActivity: "Cash from Investing Activity+",
    cashFromFinancingActivity: "Cash from Financing Activity+",
    netCashFlow: "Net Cash Flow",
    income: "Income",
    adjForDepreciationAndAmortisationExpense: "Adj Depreciation",
    adjForDividendIncome: "Adj Dividend Income",
    adjForFairValueGainsLosses: "Adj Fair Value",
    adjForFinanceCosts: "Adj Finance Costs",
    adjForImpairmentLossReversal: "Adj Impairment",
    profitFromOperations: "Profit from operations", // Sub-item
    receivables: "Receivables", // Sub-item
    inventory: "Inventory", // Sub-item
    payables: "Payables", // Sub-item
    loansAdvances: "Loans Advances", // Sub-item
    otherWcItems: "Other WC items", // Sub-item
    workingCapitalChanges: "Working capital changes", // Sub-item
    directTaxes: "Direct taxes", // Sub-item
    fixedAssetsPurchased: "Fixed assets purchased", // Sub-item
    fixedAssetsSold: "Fixed assets sold", // Sub-item
    investmentsPurchased: "Investments purchased", // Sub-item
    investmentsSold: "Investments sold", // Sub-item
    interestReceived: "Interest received", // Sub-item
    dividendsReceived: "Dividends received", // Sub-item
    investInSubsidiaries: "Invest in subsidiaries", // Sub-item
    investmentInGroupCos: "Investment in group cos", // Sub-item
    otherInvestingItems: "Other investing items", // Sub-item
    proceedsFromShares: "Proceeds from shares", // Sub-item
    proceedsFromBorrowings: "Proceeds from borrowings", // Sub-item
    repaymentOfBorrowings: "Repayment of borrowings", // Sub-item
    interestPaid: "Interest paid", // Sub-item
    dividendsPaid: "Dividends paid", // Sub-item
    financialLiabilities: "Financial liabilities", // Sub-item
    otherFinancingItems: "Other financing items", // Sub-item
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

const RAW_EXPANDABLE_STRUCTURE: Record<string, string[]> = {
  cashFromOperatingActivity: ["profitFromOperations", "receivables", "inventory", "payables", "loansAdvances", "otherWcItems", "workingCapitalChanges", "directTaxes"],
  cashFromInvestingActivity: ["fixedAssetsPurchased", "fixedAssetsSold", "investmentsPurchased", "investmentsSold", "interestReceived", "dividendsReceived", "investInSubsidiaries", "investmentInGroupCos", "otherInvestingItems"],
  cashFromFinancingActivity: ["proceedsFromShares", "proceedsFromBorrowings", "repaymentOfBorrowings", "interestPaid", "dividendsPaid", "financialLiabilities", "otherFinancingItems"],
}

export function CashFlowTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
}: CashFlowTableProps) {
  const hasConsolidated = dataConsolidated != null && dataConsolidated.length > 0;
  const hasStandalone = dataStandalone != null && dataStandalone.length > 0;
  const [selectedView, setView] = useState<"c" | "s">("c")

  const view = selectedView === "s" && !hasStandalone ? "c" : selectedView === "c" && !hasConsolidated ? "s" : selectedView
  const data = view === "c" ? (dataConsolidated ?? []) : (dataStandalone ?? [])
  const canToggle = hasConsolidated && hasStandalone;

  // Screener Cash Flow order
  const CF_ORDER = [
    "cashFromOperatingActivity",
    "cashFromInvestingActivity",
    "cashFromFinancingActivity",
    "netCashFlow",
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

    const parentLevelKeys = availableKeys.filter(k => !allChildKeys.has(k))
    const ordered = CF_ORDER.filter((k) => parentLevelKeys.includes(k))
    const rest = parentLevelKeys.filter((k) => !CF_ORDER.includes(k))
    return {
      lineItemKeys: [...ordered, ...rest].slice(0, 16),
      expandableStructure: activeExpandableStructure
    }
  }, [data])

  // Cash flow values are in rupees — show in Crores
  const cfFormatCell = useCallback(
    (v: string | number | undefined, _key: string): string => {
      if (v == null || v === "") return "—"
      const n = Number(v)
      if (!Number.isFinite(n)) return String(v)
      return formatCr(n)
    },
    []
  )

  if (data.length === 0) return null

  return (
    <FundamentalsTable
      title="Cash Flows"
      data={data}
      lineItemKeys={lineItemKeys}
      expandableStructure={expandableStructure}
      toLabel={toLabel}
      view={view}
      onViewChange={canToggle ? (v) => setView(v) : undefined}
      highlightKeys={[
        "cashFromOperatingActivity",
        "cashFromInvestingActivity",
        "cashFromFinancingActivity",
        "netCashFlow",
      ]}
      subtitle={view === "c" ? "Consolidated Figures in Rs. Crores / View Standalone" : "Standalone Figures in Rs. Crores / View Consolidated"}
      periodOrder="asc"
      formatCell={cfFormatCell}
    />
  )
}
