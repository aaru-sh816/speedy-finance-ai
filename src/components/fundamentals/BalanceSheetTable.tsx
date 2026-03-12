"use client"

import { useState, useMemo, useCallback } from "react"
import { CorporateActionsModal } from "./CorporateActionsModal"
import { Briefcase } from "lucide-react"
import { FundamentalsTable } from "./FundamentalsTable"
import { formatCr } from "@/lib/format-numbers"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface BalanceSheetTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    equityCapital: "Equity Capital",
    shareCapital: "Equity Capital",
    reserves: "Reserves",
    borrowings: "Borrowings+",
    debtSecurities: "Borrowings+",
    otherLiabilities: "Other Liabilities+",
    totalLiabilities: "Total Liabilities",
    totalAssets: "Total Assets",
    fixedAssets: "Fixed Assets+",
    cwip: "CWIP",
    investments: "Investments",
    otherAssets: "Other Assets+",
    netWorth: "Net Worth",
    currentInvestments: "Current Investments",
    currentLiabilities: "Current Liabilities",
    currentTaxAssetsNet: "Current Tax Assets",
    currentTaxLiabilities: "Current Tax Liabilities",
    longTermBorrowings: "Long term Borrowings", // Sub-item
    shortTermBorrowings: "Short term Borrowings", // Sub-item
    leaseLiabilities: "Lease Liabilities", // Sub-item
    tradePayables: "Trade Payables", // Sub-item
    advanceFromCustomers: "Advance from Customers", // Sub-item
    otherLiabilityItems: "Other liability items", // Sub-item
    grossBlock: "Gross Block", // Sub-item
    accumulatedDepreciation: "Accumulated Depreciation", // Sub-item
    inventories: "Inventories", // Sub-item
    tradeReceivables: "Trade receivables", // Sub-item
    cashAndEquivalents: "Cash Equivalents", // Sub-item
    loansAndAdvances: "Loans & Advances", // Sub-item
    otherAssetItems: "Other asset items", // Sub-item
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

const RAW_EXPANDABLE_STRUCTURE: Record<string, string[]> = {
  borrowings: ["longTermBorrowings", "shortTermBorrowings", "leaseLiabilities"],
  debtSecurities: ["longTermBorrowings", "shortTermBorrowings", "leaseLiabilities"],
  otherLiabilities: ["tradePayables", "advanceFromCustomers", "otherLiabilityItems"],
  fixedAssets: ["grossBlock", "accumulatedDepreciation"],
  otherAssets: ["inventories", "tradeReceivables", "cashAndEquivalents", "loansAndAdvances", "otherAssetItems"],
}

export function BalanceSheetTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
}: BalanceSheetTableProps) {
  const hasConsolidated = dataConsolidated != null && dataConsolidated.length > 0;
  const hasStandalone = dataStandalone != null && dataStandalone.length > 0;
  const [selectedView, setView] = useState<"c" | "s">("c")
  const [corporateActionsOpen, setCorporateActionsOpen] = useState(false)

  const view = selectedView === "s" && !hasStandalone ? "c" : selectedView === "c" && !hasConsolidated ? "s" : selectedView
  const data = view === "c" ? (dataConsolidated ?? []) : (dataStandalone ?? [])
  const canToggle = hasConsolidated && hasStandalone;

  // Screener Balance Sheet order
  const BS_ORDER = [
    "equityCapital", "shareCapital",
    "reserves",
    "borrowings", "debtSecurities",
    "otherLiabilities",
    "totalLiabilities",
    "fixedAssets",
    "cwip",
    "investments",
    "otherAssets",
    "totalAssets",
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
    const ordered = BS_ORDER.filter((k) => parentLevelKeys.includes(k))
    const rest = parentLevelKeys.filter((k) => !BS_ORDER.includes(k))
    return {
      lineItemKeys: [...ordered, ...rest].slice(0, 20),
      expandableStructure: activeExpandableStructure
    }
  }, [data])

  // Balance sheet values are in rupees — show in Crores
  const bsFormatCell = useCallback(
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
    <>
      <FundamentalsTable
        title="Balance Sheet"
        data={data}
        lineItemKeys={lineItemKeys}
        expandableStructure={expandableStructure}
        toLabel={toLabel}
        view={view}
        onViewChange={canToggle ? (v) => setView(v) : undefined}
        onActionClick={() => setCorporateActionsOpen(true)}
        actionLabel="Corporate Actions"
        actionIcon={<Briefcase className="h-3 w-3" />}
        highlightKeys={["totalLiabilities", "totalAssets"]}
        subtitle={view === "c" ? "Consolidated Figures in Rs. Crores / View Standalone" : "Standalone Figures in Rs. Crores / View Consolidated"}
        periodOrder="asc"
        formatCell={bsFormatCell}
      />
      <CorporateActionsModal
        scripCode={scripCode}
        isOpen={corporateActionsOpen}
        onClose={() => setCorporateActionsOpen(false)}
      />
    </>
  )
}
