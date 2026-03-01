"use client"

import { useEffect, useState } from "react"
import { X, Loader2, PieChart } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { formatCr } from "@/lib/format-numbers"

interface ProductSegmentsModalProps {
  scripCode: string
  period: "annual" | "quarterly"
  isOpen: boolean
  onClose: () => void
}

interface SegmentRow {
  header?: string
  year?: number
  [key: string]: string | number | undefined
}

function toLabel(key: string): string {
  if (key === "header" || key === "year") return key
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

export function ProductSegmentsModal({
  scripCode,
  period,
  isOpen,
  onClose,
}: ProductSegmentsModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SegmentRow[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [lineItemKeys, setLineItemKeys] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !scripCode) return
    setLoading(true)
    setError(null)
    setData([])
    setPeriods([])
    setLineItemKeys([])

    fetchWithTimeout(
      `/api/finedge/segment-revenue/${encodeURIComponent(scripCode)}?period=${period}`,
      { timeoutMs: 10000 }
    )
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) {
          setError(res.error)
          return
        }
        if (Array.isArray(res) && res.length > 0) {
          const keySet = new Set<string>()
          res.forEach((row: SegmentRow) => {
            Object.keys(row).forEach((k) => {
              if (k !== "header" && k !== "year" && (typeof row[k] === "number" || (typeof row[k] === "string" && !isNaN(Number(row[k]))))) {
                keySet.add(k)
              }
            })
          })
          setData(res)
          setPeriods(res.map((r: SegmentRow) => String(r.header ?? r.year ?? "—")))
          setLineItemKeys(Array.from(keySet))
          return
        }
        setError("No segment data available")
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to load segment revenue")
      })
      .finally(() => setLoading(false))
  }, [isOpen, scripCode, period])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-segments-title"
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <h2
            id="product-segments-title"
            className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-[var(--accent-cyan)]"
          >
            <PieChart className="h-4 w-4" /> Product Segments ({period === "quarterly" ? "Quarterly" : "Annual"})
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
              <span className="text-sm text-[var(--text-muted)]">Loading segment data...</span>
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-amber-400 py-4">{error}</p>
          )}
          {!loading && !error && (data.length === 0 || lineItemKeys.length === 0) && (
            <p className="text-sm text-[var(--text-muted)] py-4">No product segment data available for this company.</p>
          )}
          {!loading && !error && data.length > 0 && lineItemKeys.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
                      Segment
                    </th>
                    {periods.map((p, i) => (
                      <th
                        key={`period-${i}-${p}`}
                        className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono whitespace-nowrap"
                      >
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItemKeys.map((key) => (
                    <tr
                      key={key}
                      className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]"
                    >
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {toLabel(key)}
                      </td>
                      {periods.map((_, i) => {
                        const row = data[i] as SegmentRow
                        const v = row?.[key]
                        const num = typeof v === "number" ? v : typeof v === "string" && !isNaN(Number(v)) ? Number(v) : undefined
                        return (
                          <td
                            key={i}
                            className="py-2.5 px-3 font-mono text-xs tabular-nums text-[var(--text-secondary)]"
                          >
                            {num != null ? formatCr(num) : "—"}
                          </td>
                        )
                      })}
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
