"use client"

import { useEffect, useState, useMemo } from "react"
import { X, Loader2, PieChart as PieChartIcon, AlertCircle } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { formatCr } from "@/lib/format-numbers"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts"

interface ProductSegmentsModalProps {
  scripCode: string
  period: "annual" | "quarterly"
  isOpen: boolean
  onClose: () => void
}

interface FinEdgeSegmentData {
  segmentRevenue?: number
  segmentProfitLossBeforeTaxAndFinanceCosts?: number
  [key: string]: number | undefined
}

interface FinEdgeSegment {
  name: string
  data: FinEdgeSegmentData
}

interface FinEdgePeriod {
  header: string
  data: FinEdgeSegmentData
  segments: FinEdgeSegment[]
}

const COLORS = ['#22d3ee', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf'];

export function ProductSegmentsModal({
  scripCode,
  period,
  isOpen,
  onClose,
}: ProductSegmentsModalProps) {
  const [loading, setLoading] = useState(false)
  const [rawPeriods, setRawPeriods] = useState<FinEdgePeriod[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !scripCode) return
    setLoading(true)
    setError(null)
    setRawPeriods([])

    fetchWithTimeout(
      `/api/finedge/segment-revenue/${encodeURIComponent(scripCode)}?period=${period}&statement_type=c&statement_code=pl`,
      { timeoutMs: 15000 }
    )
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) {
          setError(res.error)
          return
        }
        if (res?.segment_revenues && Array.isArray(res.segment_revenues)) {
          // Process FinEdge structure
          setRawPeriods(res.segment_revenues)
          return
        }
        setError("No segment data available")
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to load segment revenue")
      })
      .finally(() => setLoading(false))
  }, [isOpen, scripCode, period])

  // Parse table structure
  const { periods, uniqueSegments, tableData, pieData } = useMemo(() => {
    if (rawPeriods.length === 0) return { periods: [], uniqueSegments: [], tableData: [], pieData: [] }

    // Reverse to chronological order (oldest left, newest right)
    const sortedRaw = [...rawPeriods].reverse()

    // 1. Extract period headers
    const periodHeaders = sortedRaw.map(p => p.header)

    // 2. Extract unique segment names
    const segmentSet = new Set<string>()
    sortedRaw.forEach(p => {
      p.segments?.forEach(s => {
        if (s.name && s.name !== "Unallocated") {
          segmentSet.add(s.name)
        }
      })
    })
    const segments = Array.from(segmentSet).sort()

    // 3. Build table data: Array of rows, each row maps period -> segmentRevenue
    const tableRows = segments.map(segName => {
      const rowData: Record<string, string | number | null> = { segment: segName }
      sortedRaw.forEach(p => {
        const matchingSeg = p.segments?.find(s => s.name === segName)
        rowData[p.header] = matchingSeg?.data?.segmentRevenue ?? null
      })
      return rowData as any
    })

    // 4. Build Pie Chart data from the latest period (last in sorted array)
    const latestPeriod = sortedRaw[sortedRaw.length - 1]
    const pData = latestPeriod?.segments
      ?.filter(s => s.name && s.name !== "Unallocated" && (s.data?.segmentRevenue ?? 0) > 0)
      .map(s => ({
        name: s.name,
        value: s.data.segmentRevenue!
      }))
      .sort((a, b) => b.value - a.value) ?? []

    return { periods: periodHeaders, uniqueSegments: segments, tableData: tableRows, pieData: pData }
  }, [rawPeriods])

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
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div>
            <h2
              id="product-segments-title"
              className="text-base font-black tracking-widest uppercase flex items-center gap-2 text-[var(--accent-cyan)]"
            >
              <PieChartIcon className="h-4 w-4" /> Segment Revenue
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium tracking-wide">
              {period === "quarterly" ? "Quarterly" : "Annual"} Breakdown in Rs. Crores
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors bg-white/5 border border-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
              <span className="text-sm font-medium tracking-wide text-zinc-400">Loading segment data...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-amber-400 border border-amber-500/20 bg-amber-500/5 m-6 rounded-xl">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && rawPeriods.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <p className="text-sm font-medium">No segment data available for this company.</p>
            </div>
          )}

          {!loading && !error && rawPeriods.length > 0 && (
            <div className="flex flex-col">
              {/* Top Chart Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-b border-[var(--border-subtle)] bg-white/[0.01]">
                <div className="flex flex-col items-center justify-center h-[280px]">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-300 mb-2">
                    Revenue Mix ({periods[periods.length - 1]})
                  </h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="transparent"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number | undefined) => [value != null ? formatCr(value) : '—', 'Revenue']}
                          contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#fff', fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">No chart data</div>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-3">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-300 mb-2 border-b border-white/5 pb-2">
                    Key Contributors
                  </h3>
                  {pieData.slice(0, 5).map((d, i) => {
                    const total = pieData.reduce((acc, curr) => acc + curr.value, 0)
                    const tempPct = (d.value / total) * 100
                    return (
                      <div key={d.name} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-medium text-zinc-200 truncate flex-1" title={d.name}>{d.name}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white block">{tempPct.toFixed(1)}%</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{formatCr(d.value)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Data Table Section */}
              <div className="p-6 overflow-x-auto">
                <h3 className="text-xs font-bold tracking-widest uppercase text-cyan-400 mb-4 flex items-center gap-2">
                  Historical Segment Revenue
                </h3>
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-zinc-400 bg-white/[0.02] rounded-tl-lg sticky left-0 z-10 shadow-[1px_0_0_rgba(255,255,255,0.04)]">
                        Segments
                      </th>
                      {periods.map((p, i) => (
                        <th
                          key={`th-${i}`}
                          className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono text-right bg-white/[0.01] last:rounded-tr-lg"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, rIdx) => (
                      <tr
                        key={`tr-${rIdx}`}
                        className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium text-zinc-200 sticky left-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[#1a1a1a] shadow-[1px_0_0_rgba(255,255,255,0.04)]">
                          {row.segment}
                        </td>
                        {periods.map((p, cIdx) => {
                          const val = row[p] as number | null
                          return (
                            <td
                              key={`td-${cIdx}`}
                              className="py-3.5 px-4 font-mono text-xs tabular-nums text-right text-zinc-300"
                            >
                              {val != null && val !== 0 ? formatCr(val) : "—"}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

