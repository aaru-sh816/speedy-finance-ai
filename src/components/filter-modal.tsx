"use client"

import { useState } from "react"
import { X, Calendar, Users, Sparkles, RefreshCw } from "lucide-react"
import { type VerdictType } from "@/lib/ai/verdict"
import type { BSEImpact } from "@/lib/bse/types"

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  initialFilters: FilterState
}

export interface FilterState {
  fromDate: string
  toDate: string
  duringMarketHours: boolean
  groups: string[]
  verdicts: VerdictType[]
  impacts: BSEImpact[]
}

const GROUP_OPTIONS = [
  { id: "all", label: "All" },
  { id: "bse500", label: "BSE 500" },
  { id: "watchlist", label: "My Watchlist" },
  { id: "portfolio", label: "My Portfolio Scrips" },
]

const VERDICT_OPTIONS: { id: VerdictType; label: string; icon: string }[] = [
  { id: "strong_positive", label: "Strong Positive", icon: "👍👍" },
  { id: "positive", label: "Positive", icon: "👍" },
  { id: "negative", label: "Negative", icon: "👎" },
  { id: "strong_negative", label: "Strong Negative", icon: "👎👎" },
  { id: "mixed", label: "Mixed", icon: "🔄" },
  { id: "neutral", label: "Neutral", icon: "➖" },
]

const IMPACT_OPTIONS: { id: BSEImpact; label: string }[] = [
  { id: "high", label: "High impact" },
  { id: "medium", label: "Medium impact" },
  { id: "low", label: "Low impact" },
]

export function getDefaultFilters(): FilterState {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`
  
  return {
    fromDate: todayStr,  // Changed to TODAY (was 7 days ago)
    toDate: todayStr,
    duringMarketHours: false,
    groups: [],
    verdicts: [],
    impacts: [],
  }
}

export function FilterModal({ isOpen, onClose, onApply, initialFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)

  if (!isOpen) return null

  const handleReset = () => {
    setFilters(getDefaultFilters())
  }

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const toggleGroup = (id: string) => {
    setFilters((f) => ({
      ...f,
      groups: f.groups.includes(id) ? f.groups.filter((g) => g !== id) : [...f.groups, id],
    }))
  }

  const toggleVerdict = (id: VerdictType) => {
    setFilters((f) => ({
      ...f,
      verdicts: f.verdicts.includes(id) ? f.verdicts.filter((v) => v !== id) : [...f.verdicts, id],
    }))
  }

  const toggleImpact = (id: BSEImpact) => {
    setFilters((f) => ({
      ...f,
      impacts: f.impacts.includes(id) ? f.impacts.filter((v) => v !== id) : [...f.impacts, id],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal - Full height on mobile, centered on desktop */}
      <div className="relative z-10 w-full md:max-w-3xl md:mx-4 rounded-t-2xl md:rounded-2xl glass-card overflow-hidden max-h-[90vh] md:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Filter Announcements</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Date Range */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Calendar className="h-4 w-4 text-cyan-400" />
              </div>
              <span className="font-medium text-white">Date Range</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-10">From</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-10">To</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer mt-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={filters.duringMarketHours}
                  onChange={(e) => setFilters((f) => ({ ...f, duringMarketHours: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span className="text-sm text-zinc-300">Arrived During Market Hours</span>
              </label>
            </div>
          </div>

          {/* Groups */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-4 w-4 text-purple-400" />
              </div>
              <span className="font-medium text-white">Groups</span>
            </div>
            <div className="space-y-1">
              {GROUP_OPTIONS.map((group) => (
                <label 
                  key={group.id} 
                  className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={filters.groups.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                    {group.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Impact */}
            <div className="mt-6 space-y-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Impact</span>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <input
                  type="checkbox"
                  checked={filters.impacts.length === 0}
                  onChange={() => setFilters((f) => ({ ...f, impacts: [] }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                  All impacts
                </span>
              </label>
              {IMPACT_OPTIONS.map((impact) => (
                <label
                  key={impact.id}
                  className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={filters.impacts.includes(impact.id)}
                    onChange={() => toggleImpact(impact.id)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                    {impact.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Verdict */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="font-medium text-white">AI Verdict</span>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <input
                  type="checkbox"
                  checked={filters.verdicts.length === 0}
                  onChange={() => setFilters((f) => ({ ...f, verdicts: [] }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">All</span>
              </label>
              {VERDICT_OPTIONS.map((verdict) => (
                <label 
                  key={verdict.id} 
                  className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={filters.verdicts.includes(verdict.id)}
                      onChange={() => toggleVerdict(verdict.id)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                      {verdict.label}
                    </span>
                  </div>
                  <span className="text-lg opacity-80">{verdict.icon}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Sticky at bottom */}
        <div className="flex-shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-5 border-t border-white/10 bg-zinc-900/95 backdrop-blur-md" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="hidden md:block px-5 py-2.5 rounded-xl border border-white/20 text-zinc-300 hover:bg-white/5 transition-all font-medium"
          >
            Close
          </button>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleReset}
              className="flex-1 md:flex-none px-5 py-3 md:py-2.5 rounded-xl border border-white/20 text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={handleApply}
              className="flex-1 md:flex-none px-6 py-3 md:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
