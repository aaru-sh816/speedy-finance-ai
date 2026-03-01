"use client"

import { useState, useEffect } from "react"
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight, FileUp, ChevronDown, Settings } from "lucide-react"
import { haptic } from "@/lib/haptic"
import {
  getEventTypeColor,
  type ViewMode,
  type EventTypeFilter,
  type CorpActionSubFilter,
} from "@/lib/calendar-utils"
import { FEY_DROPDOWN_BG } from "@/lib/fey-tokens"
import { useCalendarPreferences } from "@/contexts/CalendarPreferencesContext"
import { getWatchlistGroups, type WatchlistGroup } from "@/lib/storage"

interface CalendarHeaderProps {
  viewDate: Date
  setViewDate: (date: Date) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  filterByWatchlist: boolean
  setFilterByWatchlist: (val: boolean) => void
  eventTypeFilter: EventTypeFilter
  setEventTypeFilter: (val: EventTypeFilter) => void
  corpActionSubFilter: CorpActionSubFilter
  setCorpActionSubFilter: (val: CorpActionSubFilter) => void
  onExport: () => void
  showWeekends?: boolean
  setShowWeekends?: (val: boolean) => void
}

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "list", label: "List" },
]

const EVENT_TYPE_FILTERS: { value: EventTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "results", label: "Results" },
  { value: "corp_action", label: "Corp. Action" },
  { value: "other", label: "Other" },
]

const CORP_ACTION_SUB_FILTERS: { value: CorpActionSubFilter; label: string }[] =
  [
    { value: null, label: "All" },
    { value: "dividend", label: "Dividend" },
    { value: "bonus", label: "Bonus" },
    { value: "rights", label: "Rights" },
    { value: "demerger", label: "Demerger" },
    { value: "merger", label: "Merger" },
  ]

export function CalendarHeader({
  viewDate,
  setViewDate,
  viewMode,
  setViewMode,
  filterByWatchlist,
  setFilterByWatchlist,
  eventTypeFilter,
  setEventTypeFilter,
  corpActionSubFilter,
  setCorpActionSubFilter,
  onExport,
  showWeekends = false,
  setShowWeekends,
}: CalendarHeaderProps) {
  const [corpActionDropdownOpen, setCorpActionDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [watchlistDropdownOpen, setWatchlistDropdownOpen] = useState(false)
  const [watchlistGroups, setWatchlistGroups] = useState<WatchlistGroup[]>([])
  const {
    weekStartsOn,
    setWeekStartsOn,
    calendarFilterWatchlistId,
    setCalendarFilterWatchlistId,
  } = useCalendarPreferences()

  useEffect(() => {
    const load = () => setWatchlistGroups(getWatchlistGroups())
    load()
    window.addEventListener("watchlist-groups-updated", load)
    return () => window.removeEventListener("watchlist-groups-updated", load)
  }, [])

  function handlePrev() {
    haptic.monthChange()
    if (viewMode === "day") {
      setViewDate(subDays(viewDate, 1))
    } else if (viewMode === "week" || viewMode === "list") {
      setViewDate(subWeeks(viewDate, 1))
    } else if (viewMode === "year") {
      setViewDate(subYears(viewDate, 1))
    } else {
      setViewDate(subMonths(viewDate, 1))
    }
  }

  function handleNext() {
    haptic.monthChange()
    if (viewMode === "day") {
      setViewDate(addDays(viewDate, 1))
    } else if (viewMode === "week" || viewMode === "list") {
      setViewDate(addWeeks(viewDate, 1))
    } else if (viewMode === "year") {
      setViewDate(addYears(viewDate, 1))
    } else {
      setViewDate(addMonths(viewDate, 1))
    }
  }

  function handleToday() {
    haptic.viewChange()
    setViewDate(new Date())
  }

  function handleViewMode(mode: ViewMode) {
    haptic.viewChange()
    setViewMode(mode)
  }

  function handleFilterToggle() {
    haptic.toggleFilter()
    setFilterByWatchlist(!filterByWatchlist)
  }

  function handleEventTypeFilter(filter: EventTypeFilter) {
    haptic.toggleFilter()
    setEventTypeFilter(filter)
    if (filter !== "corp_action") setCorpActionSubFilter(null)
  }

  function handleExport() {
    haptic.exportAction()
    onExport()
  }

  function getHeaderLabel() {
    if (viewMode === "year") return format(viewDate, "yyyy")
    if (viewMode === "day") return format(viewDate, "EEEE, MMM d")
    if (viewMode === "week") {
      const start = startOfWeek(viewDate, { weekStartsOn })
      const end = endOfWeek(viewDate, { weekStartsOn })
      return `${format(start, "MMMM d")} - ${format(end, "MMMM d, yyyy")}`
    }
    return (
      <>
        <span className="text-white">{format(viewDate, "MMMM")}</span>
        {" "}
        <span className="text-white/45">{format(viewDate, "yyyy")}</span>
      </>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          aria-label={
            viewMode === "day"
              ? "Previous day"
              : viewMode === "week" || viewMode === "list"
                ? "Previous week"
                : viewMode === "year"
                  ? "Previous year"
                  : "Previous month"
          }
          className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-[44px] min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>

        <h2
          className="text-[18px] font-medium leading-6 select-none"
          aria-live="polite"
        >
          {getHeaderLabel()}
        </h2>

        <button
          type="button"
          onClick={handleNext}
          aria-label={
            viewMode === "day"
              ? "Next day"
              : viewMode === "week" || viewMode === "list"
                ? "Next week"
                : viewMode === "year"
                  ? "Next year"
                  : "Next month"
          }
          className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-[44px] min-h-[44px]"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={handleToday}
          aria-label="Go to today"
          className="px-3 py-1.5 rounded-md text-[13px] text-white/70 hover:text-white hover:bg-white/[0.06] border border-white/[0.12] transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[44px]"
        >
          Today
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Event type filter */}
        <div className="flex items-center gap-1" role="group" aria-label="Event type filter">
          {EVENT_TYPE_FILTERS.map(({ value, label }) => {
            const isSelected = eventTypeFilter === value
            const selectedStyle =
              value === "results"
                ? "bg-amber-500/20 text-amber-300"
                : value === "corp_action"
                  ? "bg-indigo-500/20 text-indigo-300"
                  : value === "other"
                    ? "bg-zinc-500/20 text-zinc-300"
                    : "bg-white/10 text-white"
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleEventTypeFilter(value)}
                aria-pressed={isSelected}
                className={`px-2.5 py-1.5 rounded-md text-[12px] leading-none transition-all duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[36px] hover:scale-[1.02] active:scale-[0.98] font-medium ${
                  isSelected ? selectedStyle : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {eventTypeFilter === "corp_action" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setCorpActionDropdownOpen((o) => !o)}
              aria-expanded={corpActionDropdownOpen}
              aria-haspopup="listbox"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] text-white/70 hover:text-white bg-white/[0.06] border border-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[36px]"
            >
              {corpActionSubFilter
                ? CORP_ACTION_SUB_FILTERS.find((f) => f.value === corpActionSubFilter)?.label
                : "All"}
              <ChevronDown className="w-3 h-3" aria-hidden />
            </button>
            {corpActionDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setCorpActionDropdownOpen(false)}
                />
                <div
                  className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-white/[0.08] shadow-xl z-20 min-w-[120px]"
                  style={{ backgroundColor: FEY_DROPDOWN_BG }}
                  role="listbox"
                >
                  {CORP_ACTION_SUB_FILTERS.map(({ value, label }) => {
                    const color = value ? getEventTypeColor(value) : null
                    return (
                      <button
                        key={label}
                        type="button"
                        role="option"
                        aria-selected={corpActionSubFilter === value}
                        onClick={() => {
                          haptic.toggleFilter()
                          setCorpActionSubFilter(value)
                          setCorpActionDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white/[0.06] transition-colors ${
                          color ? color.text : "text-white/80"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-white/[0.08]" aria-hidden />

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white/45 select-none">
            Filter by watchlist
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={filterByWatchlist}
            aria-label="Filter by watchlist"
            onClick={handleFilterToggle}
            className="p-2 -m-1 rounded-full focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span
              className={`relative inline-flex h-[18px] w-[32px] flex-shrink-0 rounded-full border border-white/[0.12] transition-colors duration-200 ${
                filterByWatchlist ? "bg-cyan-500/80 border-cyan-400/30" : "bg-zinc-800"
              }`}
            >
              <span
                className={`absolute top-[2px] left-0 inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                  filterByWatchlist ? "translate-x-[15px]" : "translate-x-[1px]"
                }`}
              />
            </span>
          </button>
          {filterByWatchlist && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setWatchlistDropdownOpen((o) => !o)}
                aria-expanded={watchlistDropdownOpen}
                aria-haspopup="listbox"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] text-white/70 hover:text-white bg-white/[0.06] border border-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[36px]"
              >
                {calendarFilterWatchlistId === "all"
                  ? "All groups"
                  : watchlistGroups.find((g) => g.id === calendarFilterWatchlistId)?.name ?? "All groups"}
                <ChevronDown className="w-3 h-3" aria-hidden />
              </button>
              {watchlistDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setWatchlistDropdownOpen(false)}
                  />
                  <div
                    className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-white/[0.08] shadow-xl z-20 min-w-[140px]"
                    style={{ backgroundColor: FEY_DROPDOWN_BG }}
                    role="listbox"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={calendarFilterWatchlistId === "all"}
                      onClick={() => {
                        haptic.toggleFilter()
                        setCalendarFilterWatchlistId("all")
                        setWatchlistDropdownOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.06] transition-colors"
                    >
                      All groups
                    </button>
                    {watchlistGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        role="option"
                        aria-selected={calendarFilterWatchlistId === g.id}
                        onClick={() => {
                          haptic.toggleFilter()
                          setCalendarFilterWatchlistId(g.id)
                          setWatchlistDropdownOpen(false)
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.06] transition-colors"
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-white/[0.08]" aria-hidden />

        {viewMode === "month" && setShowWeekends && (
          <>
            <div className="w-px h-4 bg-white/[0.08]" aria-hidden />
            <button
              type="button"
              onClick={() => setShowWeekends(!showWeekends)}
              aria-pressed={showWeekends}
              className={`px-2.5 py-1.5 rounded-md text-[12px] leading-none transition-all duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[36px] hover:scale-[1.02] active:scale-[0.98] ${
                showWeekends
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              Weekends
            </button>
          </>
        )}

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Calendar view"
        >
          {VIEW_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleViewMode(value)}
              aria-pressed={viewMode === value}
              className={`px-3 py-1.5 rounded-md text-[13px] leading-none transition-all duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-h-[44px] hover:scale-[1.02] active:scale-[0.98] ${
                viewMode === value
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            aria-label="Calendar settings"
            className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-[44px] min-h-[44px]"
          >
            <Settings className="w-4 h-4" aria-hidden />
          </button>
          {settingsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setSettingsOpen(false)}
              />
              <div
                className="absolute top-full right-0 mt-1 py-2 px-3 rounded-lg border border-white/[0.08] shadow-xl z-20 min-w-[180px]"
                style={{ backgroundColor: FEY_DROPDOWN_BG }}
                role="dialog"
                aria-label="Calendar settings"
              >
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">Week starts</span>
                    <div className="flex gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          haptic.toggleFilter()
                          setWeekStartsOn(0)
                        }}
                        className={`flex-1 px-2 py-1 rounded text-[12px] ${
                          weekStartsOn === 0 ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                        }`}
                      >
                        Sun
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptic.toggleFilter()
                          setWeekStartsOn(1)
                        }}
                        className={`flex-1 px-2 py-1 rounded text-[12px] ${
                          weekStartsOn === 1 ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                        }`}
                      >
                        Mon
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleExport}
          aria-label="Export calendar as CSV"
          className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-[44px] min-h-[44px]"
        >
          <FileUp className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
