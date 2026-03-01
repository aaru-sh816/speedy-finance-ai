"use client"

import { useState, useMemo } from "react"
import { CorporateActionsModal } from "./CorporateActionsModal"
import { Briefcase } from "lucide-react"
import { FundamentalsTable } from "./FundamentalsTable"

interface FinancialRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

interface BalanceSheetTableProps {
  scripCode: string
  dataConsolidated?: FinancialRow[] | null
  dataStandalone?: FinancialRow[] | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function toLabel(key: string): string {
  const map: Record<string, string> = {
    equityCapital: "Equity Capital",
    reserves: "Reserves",
    totalAssets: "Total Assets",
    totalLiabilities: "Total Liabilities",
    netWorth: "Net Worth",
    shareCapital: "Share Capital",
    currentInvestments: "Current Investments",
    currentLiabilities: "Current Liabilities",
    currentTaxAssetsNet: "Current Tax Assets",
    currentTaxLiabilities: "Current Tax Liabilities",
    debtSecurities: "Debt Securities",
  }
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

export function BalanceSheetTable({
  scripCode,
  dataConsolidated,
  dataStandalone,
  onNoteAction,
}: BalanceSheetTableProps) {
  const [view, setView] = useState<"c" | "s">("c")
  const [corporateActionsOpen, setCorporateActionsOpen] = useState(false)
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
    return { lineItemKeys: Array.from(keySet).slice(0, 20) }
  }, [data])

  if (data.length === 0) return null

  return (
    <>
      <FundamentalsTable
        title="Balance Sheet"
        data={data}
        lineItemKeys={lineItemKeys}
        toLabel={toLabel}
        view={view}
        onViewChange={setView}
        onActionClick={() => setCorporateActionsOpen(true)}
        actionLabel="Corporate Actions"
        actionIcon={<Briefcase className="h-3 w-3" />}
        onNoteAction={onNoteAction}
      />
      <CorporateActionsModal
        scripCode={scripCode}
        isOpen={corporateActionsOpen}
        onClose={() => setCorporateActionsOpen(false)}
      />
    </>
  )
}
