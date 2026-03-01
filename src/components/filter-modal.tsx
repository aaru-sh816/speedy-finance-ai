"use client"

import { useState, useEffect } from "react"
import { X, Calendar, Users, Sparkles, RefreshCw, TrendingUp, ArrowUpDown, Clock, Zap } from "lucide-react"
import { type VerdictType } from "@/lib/ai/verdict"
import type { BSEImpact } from "@/lib/bse/types"

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  initialFilters: FilterState
}

export type McapRange = "micro" | "small" | "mid" | "large" | "mega"
export type SortBy = "time" | "mcap_high" | "mcap_low" | "change_high" | "change_low" | "price_high" | "price_low"

export interface FilterState {
  fromDate: string
  toDate: string
  duringMarketHours: boolean
  groups: string[]
  verdicts: VerdictType[]
  impacts: BSEImpact[]
  mcapRanges: McapRange[]
  sortBy: SortBy
  mcapMin: number | null
  mcapMax: number | null
}

const GROUP_OPTIONS = [
  { id: "all", label: "All" },
  { id: "bse500", label: "BSE 500" },
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
]

const VERDICT_OPTIONS: { id: VerdictType; label: string; emoji: string }[] = [
  { id: "strong_positive", label: "Strong +", emoji: "🚀" },
  { id: "positive", label: "Positive", emoji: "📈" },
  { id: "neutral", label: "Neutral", emoji: "➖" },
  { id: "negative", label: "Negative", emoji: "📉" },
  { id: "strong_negative", label: "Strong -", emoji: "💥" },
  { id: "mixed", label: "Mixed", emoji: "🔀" },
]

const IMPACT_OPTIONS: { id: BSEImpact; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
]

const MCAP_RANGE_OPTIONS: { id: McapRange; label: string }[] = [
  { id: "micro", label: "Micro" },
  { id: "small", label: "Small" },
  { id: "mid", label: "Mid" },
  { id: "large", label: "Large" },
  { id: "mega", label: "Mega" },
]

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "time", label: "Latest" },
  { id: "mcap_high", label: "MCap ↓" },
  { id: "mcap_low", label: "MCap ↑" },
  { id: "change_high", label: "Gainers" },
  { id: "change_low", label: "Losers" },
]

export function getDefaultFilters(): FilterState {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`
  return {
    fromDate: todayStr,
    toDate: todayStr,
    duringMarketHours: false,
    groups: [],
    verdicts: [],
    impacts: [],
    mcapRanges: [],
    sortBy: "time",
    mcapMin: null,
    mcapMax: null,
  }
}

function Pill({ 
  active, 
  onClick, 
  children,
  variant = "default"
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode
  variant?: "default" | "positive" | "negative" | "warning"
}) {
  const variants = {
    default: active ? "bg-white/10 text-white border-white/20" : "bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/10",
    positive: active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-transparent text-zinc-500 border-white/[0.06] hover:text-emerald-400/70 hover:border-emerald-500/20",
    negative: active ? "bg-rose-500/15 text-rose-400 border-rose-500/30" : "bg-transparent text-zinc-500 border-white/[0.06] hover:text-rose-400/70 hover:border-rose-500/20",
    warning: active ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-transparent text-zinc-500 border-white/[0.06] hover:text-amber-400/70 hover:border-amber-500/20",
  }

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${variants[variant]}`}
    >
      {children}
    </button>
  )
}

export function FilterModal({ isOpen, onClose, onApply, initialFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [activeTab, setActiveTab] = useState<"filters" | "sort">("filters")

  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters)
    }
  }, [isOpen, initialFilters])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleReset = () => setFilters(getDefaultFilters())
  const handleApply = () => {
    const from = filters.fromDate
    const to = filters.toDate
    const normalized = from && to && from > to ? { ...filters, fromDate: to, toDate: from } : filters
    onApply(normalized)
    onClose()
  }

  const toggleArrayItem = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]

  const activeCount = 
    filters.groups.length + 
    filters.verdicts.length + 
    filters.impacts.length + 
    filters.mcapRanges.length + 
    (filters.duringMarketHours ? 1 : 0) +
    (filters.mcapMin !== null || filters.mcapMax !== null ? 1 : 0) +
    (filters.sortBy !== "time" ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-lg bg-zinc-950 sm:rounded-2xl rounded-t-2xl border border-white/[0.08] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold tabular-nums">
                {activeCount}
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab("filters")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === "filters" ? "text-white border-b-2 border-cyan-500" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Filters
          </button>
          <button
            onClick={() => setActiveTab("sort")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === "sort" ? "text-white border-b-2 border-cyan-500" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Sort & Order
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {activeTab === "filters" ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Date Range</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-600 mb-1 block">From</label>
                    <input
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-xs focus:border-cyan-500/50 focus:ring-0 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-600 mb-1 block">To</label>
                    <input
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-xs focus:border-cyan-500/50 focus:ring-0 outline-none transition-colors"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filters.duringMarketHours ? "bg-cyan-500 border-cyan-500" : "border-white/20 group-hover:border-white/40"}`}>
                    {filters.duringMarketHours && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Market hours only (9:15 AM - 3:30 PM)
                  </span>
                </label>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">AI Verdict</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill active={filters.verdicts.length === 0} onClick={() => setFilters((f) => ({ ...f, verdicts: [] }))}>
                    All
                  </Pill>
                  {VERDICT_OPTIONS.map((v) => (
                    <Pill
                      key={v.id}
                      active={filters.verdicts.includes(v.id)}
                      onClick={() => setFilters((f) => ({ ...f, verdicts: toggleArrayItem(f.verdicts, v.id) }))}
                      variant={v.id.includes("positive") ? "positive" : v.id.includes("negative") ? "negative" : "default"}
                    >
                      {v.emoji} {v.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Impact Level</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill active={filters.impacts.length === 0} onClick={() => setFilters((f) => ({ ...f, impacts: [] }))}>
                    All
                  </Pill>
                  {IMPACT_OPTIONS.map((i) => (
                    <Pill
                      key={i.id}
                      active={filters.impacts.includes(i.id)}
                      onClick={() => setFilters((f) => ({ ...f, impacts: toggleArrayItem(f.impacts, i.id) }))}
                      variant={i.id === "high" ? "negative" : i.id === "medium" ? "warning" : "default"}
                    >
                      {i.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Market Cap</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Pill 
                    active={filters.mcapRanges.length === 0 && filters.mcapMin === null && filters.mcapMax === null} 
                    onClick={() => setFilters((f) => ({ ...f, mcapRanges: [], mcapMin: null, mcapMax: null }))}
                  >
                    All
                  </Pill>
                  {MCAP_RANGE_OPTIONS.map((r) => (
                    <Pill
                      key={r.id}
                      active={filters.mcapRanges.includes(r.id)}
                      onClick={() => setFilters((f) => ({ ...f, mcapRanges: toggleArrayItem(f.mcapRanges, r.id) }))}
                    >
                      {r.label}
                    </Pill>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min Cr"
                    value={filters.mcapMin ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, mcapMin: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-xs focus:border-cyan-500/50 focus:ring-0 outline-none placeholder:text-zinc-600"
                  />
                  <span className="text-zinc-600 text-xs">to</span>
                  <input
                    type="number"
                    placeholder="Max Cr"
                    value={filters.mcapMax ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, mcapMax: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-xs focus:border-cyan-500/50 focus:ring-0 outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Stock Groups</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GROUP_OPTIONS.map((g) => (
                    <Pill
                      key={g.id}
                      active={g.id === "all" ? filters.groups.length === 0 : filters.groups.includes(g.id)}
                      onClick={() => g.id === "all" 
                        ? setFilters((f) => ({ ...f, groups: [] }))
                        : setFilters((f) => ({ ...f, groups: toggleArrayItem(f.groups, g.id) }))
                      }
                    >
                      {g.label}
                    </Pill>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Sort By</span>
              </div>
              <div className="space-y-1">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFilters((f) => ({ ...f, sortBy: s.id }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                      filters.sortBy === s.id 
                        ? "bg-cyan-500/10 border border-cyan-500/30 text-white" 
                        : "bg-white/[0.02] border border-white/[0.04] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-xs font-medium">{s.label}</span>
                    {filters.sortBy === s.id && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06] bg-black/40">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
