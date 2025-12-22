"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Landmark, TrendingUp, Info } from "lucide-react"

interface RevenueSegment {
  name: string
  value: number
  color: string
  [key: string]: any
}

interface RevenueBreakdownProps {
  data?: RevenueSegment[]
  companyName: string
  year?: string
}

const DEFAULT_DATA: RevenueSegment[] = [
  { name: 'Segment A', value: 45, color: '#06b6d4' },
  { name: 'Segment B', value: 30, color: '#3b82f6' },
  { name: 'Segment C', value: 15, color: '#8b5cf6' },
  { name: 'Others', value: 10, color: '#6366f1' },
]

export function RevenueBreakdown({ data = DEFAULT_DATA, companyName, year = "FY2024" }: RevenueBreakdownProps) {
  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Revenue Mix</h3>
            <p className="text-[10px] text-zinc-500">Segmental Breakdown • {year}</p>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-white/5 cursor-help" title="Data extracted from latest annual report">
          <Info className="h-4 w-4 text-zinc-500" />
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
            />
            <Legend 
              verticalAlign="bottom" 
              align="center"
              iconType="circle"
              wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500 font-medium">Primary Driver</span>
          <span className="text-white font-bold">{data[0].name} ({data[0].value}%)</span>
        </div>
        <div className="mt-2 text-[10px] text-zinc-500 leading-relaxed italic">
          * AI-generated breakdown based on Management Discussion & Analysis (MD&A) in the latest financial filing.
        </div>
      </div>
    </div>
  )
}
