"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Briefcase } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

interface CorporateActionItem {
  action?: string
  adj_amount?: number
  amount?: number
  dividend_type?: string
  ex_date?: string
  subject?: string
  symbol?: string
  timestamp_unix?: number
}

interface CorporateActionsModalProps {
  scripCode: string
  isOpen: boolean
  onClose: () => void
}

export function CorporateActionsModal({
  scripCode,
  isOpen,
  onClose,
}: CorporateActionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState<CorporateActionItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !scripCode) return
    setLoading(true)
    setError(null)
    setActions([])

    fetchWithTimeout(
      `/api/finedge/corporate-actions?symbol=${encodeURIComponent(scripCode)}`,
      { timeoutMs: 10000 }
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setActions(data)
        } else if (data?.error) {
          setError(data.error)
        } else {
          setActions([])
        }
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to load corporate actions")
        setActions([])
      })
      .finally(() => setLoading(false))
  }, [isOpen, scripCode])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="corporate-actions-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <h2
            id="corporate-actions-title"
            className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-[var(--accent-cyan)]"
          >
            <Briefcase className="h-4 w-4" /> Corporate Actions
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <span className="text-sm text-[var(--text-muted)]">Loading corporate actions...</span>
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-amber-400 py-4">{error}</p>
          )}
          {!loading && !error && actions.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-4">No corporate actions found for this company.</p>
          )}
          {!loading && !error && actions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
                      Ex Date
                    </th>
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
                      Subject / Action
                    </th>
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono whitespace-nowrap">
                      Amount / Ratio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, i) => (
                    <tr
                      key={`ca-${i}-${a.ex_date ?? a.timestamp_unix ?? i}`}
                      className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]"
                    >
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {a.ex_date ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-primary)]">
                        {a.subject ?? a.action ?? a.dividend_type ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                        {a.amount != null ? `₹${Number(a.amount).toLocaleString("en-IN")}` : a.adj_amount != null ? `₹${Number(a.adj_amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
