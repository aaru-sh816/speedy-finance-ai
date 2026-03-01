"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Users } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

interface BeneficialOwnersModalProps {
  scripCode: string
  period: "quarterly" | "annual"
  isOpen: boolean
  onClose: () => void
}

export function BeneficialOwnersModal({
  scripCode,
  period,
  isOpen,
  onClose,
}: BeneficialOwnersModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !scripCode) return
    setLoading(true)
    setError(null)
    setData(null)

    fetchWithTimeout(
      `/api/finedge/shareholdings/beneficial-owners/${encodeURIComponent(scripCode)}?period=${period}`,
      { timeoutMs: 10000 }
    )
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) {
          setError(res.error)
          return
        }
        setData(res)
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to load beneficial owners")
      })
      .finally(() => setLoading(false))
  }, [isOpen, scripCode, period])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">Loading beneficial owners...</span>
        </div>
      )
    }
    if (error) {
      return <p className="text-sm text-amber-400 py-4">{error}</p>
    }
    if (!data) {
      return <p className="text-sm text-[var(--text-muted)] py-4">No beneficial owner data available.</p>
    }
    const rows = Array.isArray(data) ? data : (data as { rows?: unknown[] })?.rows ?? (data as { beneficial_owners?: unknown[] })?.beneficial_owners ?? []
    if (!Array.isArray(rows) || rows.length === 0) {
      return <p className="text-sm text-[var(--text-muted)] py-4">No beneficial owner data available for this company.</p>
    }
    const first = rows[0] as Record<string, unknown>
    const cols = first ? Object.keys(first).filter((k) => k !== "id" && typeof first[k] !== "object") : []
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {cols.map((c, i) => (
                <th
                  key={`col-${i}-${c}`}
                  className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap"
                >
                  {c.replace(/([A-Z])/g, " $1").replace(/^./, (s) => String(s).toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]"
              >
                {cols.map((col, ci) => {
                  const v = (row as Record<string, unknown>)[col]
                  const str = v != null ? String(v) : "—"
                  const isNum = typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)))
                  return (
                    <td
                      key={ci}
                      className={`py-2.5 px-3 text-[var(--text-secondary)] ${isNum ? "font-mono text-xs tabular-nums" : ""}`}
                    >
                      {isNum && typeof v === "number" ? `${Number(v).toFixed(1)}%` : str}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beneficial-owners-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <h2
            id="beneficial-owners-title"
            className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-[var(--accent-cyan)]"
          >
            <Users className="h-4 w-4" /> View Shareholders (Beneficial Owners)
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      </div>
    </div>
  )
}
