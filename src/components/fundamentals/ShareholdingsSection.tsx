"use client"

import { useState } from "react"
import { BeneficialOwnersModal } from "./BeneficialOwnersModal"
import { Users, PieChart as PieChartIcon, TrendingUp } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"
import { clsx } from "clsx"

const CHART_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#fbbf24"]

interface ShareholdingRow {
  name: string
  data: Record<string, number>
  shareholders?: Array<{ name: string; data: Record<string, number> }>
}

interface ShareholdingsSectionProps {
  scripCode?: string
  shareholding: {
    columns: string[]
    rows: ShareholdingRow[]
  } | null
}

export function ShareholdingsSection({ scripCode, shareholding }: ShareholdingsSectionProps) {
  const [view, setView] = useState<"percentage" | "details">("percentage")
  const [beneficialOwnersOpen, setBeneficialOwnersOpen] = useState(false)
  if (!shareholding || shareholding.rows.length === 0) return null

  const { columns, rows } = shareholding
  const latestCol = columns[columns.length - 1]
  const pieData = rows
    .slice(0, 6)
    .map((row) => ({
      name: row.name,
      value: row.data[latestCol] != null ? Number(row.data[latestCol]) : 0,
    }))
    .filter((d) => d.value > 0)

  const promotersRow = rows.find(
    (r) =>
      r.name.toLowerCase().includes("promoter") ||
      r.name.toLowerCase() === "promoters"
  )
  const promotersShareholders = promotersRow?.shareholders ?? []

  return (
      <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
        <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
            <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500">
              SHAREHOLDING PATTERN
            </h3>
          </div>
          <div className="flex items-center gap-4">
            {scripCode && (
              <button
                onClick={() => setBeneficialOwnersOpen(true)}
                className="px-4 py-2 text-[10px] font-black tracking-wider uppercase rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all flex items-center gap-2 group"
              >
                <Users className="h-3.5 w-3.5 group-hover:text-cyan-400 transition-colors" /> Shareholders
              </button>
            )}
            <div className="flex rounded-xl p-1 bg-black/40 border border-white/5">
              <button
                onClick={() => setView("percentage")}
                className={clsx(
                  "px-4 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all",
                  view === "percentage"
                    ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                PERCENT
              </button>
              <button
                onClick={() => setView("details")}
                className={clsx(
                  "px-4 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all",
                  view === "details"
                    ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                DETAILS
              </button>
            </div>
          </div>
        </div>

      
      {scripCode && (
        <BeneficialOwnersModal
          scripCode={scripCode}
          period="quarterly"
          isOpen={beneficialOwnersOpen}
          onClose={() => setBeneficialOwnersOpen(false)}
        />
      )}

      <div className="p-6 flex flex-col lg:flex-row gap-8">
        {view === "percentage" && pieData.length > 0 && (
          <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-zinc-600 tracking-wider uppercase">Current Allocation</span>
              <span className="text-[9px] font-mono text-zinc-500">{latestCol}</span>
            </div>
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "12px",
                      fontSize: "11px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                    }}
                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                    formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, ""]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">LATEST</span>
                 <span className="text-xl font-black text-white tabular-nums">100<span className="text-xs opacity-50 ml-0.5">%</span></span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
               {pieData.map((d, i) => (
                 <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-[9px] font-bold text-zinc-500 truncate">{d.name}</span>
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {view === "percentage" && (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      CATEGORY
                    </th>
                    {columns.slice(-4).map((c) => (
                      <th
                        key={c}
                        className="py-3 pr-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 font-mono text-right"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="group border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                        {row.name}
                      </td>
                      {columns.slice(-4).map((col) => (
                        <td key={col} className="py-3 pr-4 font-mono text-[11px] font-medium tabular-nums text-zinc-500 group-hover:text-zinc-300 text-right">
                          {row.data[col] != null
                            ? `${Number(row.data[col]).toFixed(1)}%`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === "details" && promotersShareholders.length > 0 && (
            <div className="overflow-x-auto scrollbar-thin">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-600 tracking-wider uppercase">Promoters Holding Breakdown</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      HOLDER
                    </th>
                    {columns.slice(-4).map((c) => (
                      <th
                        key={c}
                        className="py-3 pr-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 font-mono text-right"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promotersShareholders.map((sh, i) => (
                    <tr key={i} className="group border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors pl-4 border-l border-white/5">
                        {sh.name}
                      </td>
                      {columns.slice(-4).map((col) => (
                        <td
                          key={col}
                          className="py-3 pr-4 font-mono text-[11px] font-medium tabular-nums text-zinc-500 group-hover:text-zinc-300 text-right"
                        >
                          {sh.data[col] != null
                            ? `${Number(sh.data[col]).toFixed(1)}%`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {columns.length >= 2 && rows.length > 0 && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-600 tracking-wider uppercase flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-cyan-400" /> Ownership Trend
                </span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={columns.slice(-8).map((col) => {
                      const point: Record<string, string | number> = { period: col }
                      rows.slice(0, 4).forEach((row) => {
                        const v = row.data[col]
                        point[row.name] = v != null ? Number(v) : 0
                      })
                      return point
                    })}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="period"
                      stroke="#3f3f46"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#3f3f46"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#09090b",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: "12px",
                        fontSize: "10px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                      }}
                      itemStyle={{ fontWeight: "bold" }}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, ""]}
                    />
                    {rows.slice(0, 4).map((row, i) => (
                      <Line
                        key={row.name}
                        type="monotone"
                        dataKey={row.name}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        name={row.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
