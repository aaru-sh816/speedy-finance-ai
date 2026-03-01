"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import useSWR from "swr"
import { addMonths, subMonths, startOfMonth, format } from "date-fns"
import Link from "next/link"
import {
  CalendarHeader,
  CalendarGrid,
  CalendarWeekView,
  CalendarDayView,
  CalendarListView,
  CalendarYearView,
} from "@/components/result-calendar"
import { useSwipeMonth } from "@/hooks/useSwipeMonth"
import { useWatchlist } from "@/hooks/useWatchlist"
import { CalendarPreferencesProvider, useCalendarPreferences } from "@/contexts/CalendarPreferencesContext"
import { FEY_BG, FEY_CARD } from "@/lib/fey-tokens"
import {
  filterEventsByWatchlist,
  filterEventsByType,
  getDateRange,
  exportEventsToCSV,
  type ViewMode,
  type CalendarEvent,
  type EventTypeFilter,
  type CorpActionSubFilter,
} from "@/lib/calendar-utils"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { ArrowLeft, Calendar } from "lucide-react"

function FeyLogoMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="flex-shrink-0"
      aria-hidden
    >
      <path
        d="M3 15L9 3l6 12H3z"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col flex-1 animate-pulse" role="status">
      <div className="grid grid-cols-5 border-b border-white/[0.06]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-2.5 flex justify-center">
            <div className="h-3 w-16 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, weekIdx) => (
        <div
          key={weekIdx}
          className="grid grid-cols-5 flex-1"
          style={{ minHeight: "110px" }}
        >
          {Array.from({ length: 5 }).map((_, dayIdx) => (
            <div
              key={dayIdx}
              className="border-r border-b border-white/[0.06] px-2.5 pt-3 pb-2.5"
            >
              <div className="h-3 w-4 bg-white/[0.06] rounded mb-3" />
              {dayIdx % 3 === 0 && (
                <div className="h-3 w-3/4 bg-white/[0.04] rounded mb-1.5" />
              )}
              {dayIdx % 2 === 0 && (
                <div className="h-3 w-2/3 bg-white/[0.04] rounded" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function CalendarError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
      <p className="text-[13px] text-white/40" role="alert">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-[12px] text-cyan-400 hover:text-cyan-300 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50 rounded"
      >
        Try again
      </button>
    </div>
  )
}

export default function ResultCalendarPage() {
  return (
    <CalendarPreferencesProvider>
      <ResultCalendarPageContent />
    </CalendarPreferencesProvider>
  )
}

function ResultCalendarPageContent() {
  const { weekStartsOn, calendarFilterWatchlistId } = useCalendarPreferences()
  const [viewDate, setViewDate] = useState<Date>(startOfMonth(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [filterWatchlist, setFilterWatchlist] = useState(false)
  const [showWeekends, setShowWeekends] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] =
    useState<EventTypeFilter>("all")
  const [corpActionSubFilter, setCorpActionSubFilter] =
    useState<CorpActionSubFilter>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const swipeContainerRef = useRef<HTMLDivElement>(null)

  const { from, to } = useMemo(
    () => getDateRange(viewDate, viewMode, weekStartsOn),
    [viewDate, viewMode, weekStartsOn]
  )
  const swrKey = `calendar:${format(from, "yyyy-MM-dd")}:${format(to, "yyyy-MM-dd")}`

  const fetcher = useCallback(
    async ([_key, fromStr, toStr]: readonly [string, string, string]) => {
      const res = await fetchWithTimeout(
        `/api/bse/calendar-unified?fromDate=${fromStr}&toDate=${toStr}`,
        { timeoutMs: 25000 }
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      const rawEvents = data.events ?? []
      return rawEvents.map(
        (e: Omit<CalendarEvent, "resultDate"> & { resultDate: string }) => ({
          ...e,
          resultDate: new Date(e.resultDate),
        })
      ) as CalendarEvent[]
    },
    []
  )

  const { data: events = [], error, isLoading: loading, mutate } = useSWR(
    [swrKey, format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")] as const,
    fetcher,
    {
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  )

  const { items: watchlistItems } = useWatchlist(30000)
  const watchlistScripCodes = useMemo(() => {
    if (calendarFilterWatchlistId === "all") {
      return watchlistItems.map((i) => i.scripCode)
    }
    return watchlistItems
      .filter(
        (i) =>
          (calendarFilterWatchlistId === "default" && !i.groupId) ||
          i.groupId === calendarFilterWatchlistId
      )
      .map((i) => i.scripCode)
  }, [watchlistItems, calendarFilterWatchlistId])
  const watchlistSet = useMemo(
    () => new Set(watchlistScripCodes.map((s) => s.toUpperCase())),
    [watchlistScripCodes]
  )

  const goNext = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setViewDate((prev) => addMonths(prev, 1))
    setTimeout(() => setIsAnimating(false), 300)
  }, [isAnimating])

  const goPrev = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setViewDate((prev) => subMonths(prev, 1))
    setTimeout(() => setIsAnimating(false), 300)
  }, [isAnimating])

  const { bindRef } = useSwipeMonth({
    onNext: goNext,
    onPrev: goPrev,
    enabled: !isAnimating && viewMode === "month",
  })

  const fetchEvents = useCallback(() => mutate(), [mutate])

  let displayEvents = filterEventsByType(
    events,
    eventTypeFilter,
    corpActionSubFilter
  )
  displayEvents = filterWatchlist
    ? filterEventsByWatchlist(displayEvents, watchlistScripCodes)
    : displayEvents

  function handleExport() {
    const filename = `earnings-calendar-${format(viewDate, "yyyy-MM")}.csv`
    exportEventsToCSV(displayEvents, filename)
  }

  function handleSelectMonth(date: Date) {
    setViewDate(startOfMonth(date))
    setViewMode("month")
  }

  function handleSelectDate(date: Date) {
    setViewDate(date)
    setViewMode("day")
  }

  function renderContent() {
    if (loading) return <CalendarSkeleton />
    if (error) return <CalendarError message={error instanceof Error ? error.message : "Unable to load calendar."} onRetry={fetchEvents} />

    switch (viewMode) {
      case "month":
        return (
          <CalendarGrid
            viewMonth={viewDate}
            events={displayEvents}
            showWeekends={showWeekends}
            weekStartsOn={weekStartsOn}
            watchlistSet={watchlistSet}
            onSelectDate={handleSelectDate}
          />
        )
      case "week":
        return (
          <CalendarWeekView
            viewMonth={viewDate}
            events={displayEvents}
            weekStartsOn={weekStartsOn}
            watchlistSet={watchlistSet}
            onSelectDate={handleSelectDate}
          />
        )
      case "day":
        return (
          <CalendarDayView
            viewMonth={viewDate}
            events={displayEvents}
            watchlistSet={watchlistSet}
          />
        )
      case "year":
        return (
          <CalendarYearView
            viewDate={viewDate}
            events={displayEvents}
            onSelectMonth={handleSelectMonth}
            onSelectDate={handleSelectDate}
            weekStartsOn={weekStartsOn}
            watchlistSet={watchlistSet}
          />
        )
      case "list":
        return (
          <CalendarListView events={displayEvents} watchlistSet={watchlistSet} />
        )
    }
  }

  useEffect(() => {
    const el = swipeContainerRef.current
    if (!el) return
    const cleanup = bindRef(el)
    return cleanup
  }, [bindRef])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goPrev, goNext])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: FEY_BG }}
    >
      <div className="flex flex-col flex-1 max-w-none px-6 pt-28 pb-24">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <FeyLogoMark />
            <h1 className="text-[22px] font-medium text-white">
              Earnings calendar
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/35 px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08]">
              Coming soon
            </span>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-white/35 hover:text-white/50 transition-colors"
              aria-disabled="true"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden />
              Events
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-white font-medium bg-white/[0.07] border border-white/[0.1]"
              aria-current="page"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden />
              Calendar
            </button>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col rounded-xl border border-white/[0.06] overflow-hidden"
          style={{ backgroundColor: FEY_CARD }}
          ref={swipeContainerRef}
        >
          <CalendarHeader
            viewDate={viewDate}
            setViewDate={setViewDate}
            viewMode={viewMode}
            setViewMode={setViewMode}
            filterByWatchlist={filterWatchlist}
            setFilterByWatchlist={setFilterWatchlist}
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            corpActionSubFilter={corpActionSubFilter}
            setCorpActionSubFilter={setCorpActionSubFilter}
            onExport={handleExport}
            showWeekends={showWeekends}
            setShowWeekends={setShowWeekends}
          />

          <div
            className={`flex flex-col flex-1 overflow-hidden transition-opacity duration-200 ${
              isAnimating ? "opacity-60" : "opacity-100"
            }`}
          >
            {renderContent()}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 text-[12px] text-white/35 hover:text-white/60 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0D0D0F] rounded"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden /> Back to Market
          </Link>
        </div>
      </div>
    </div>
  )
}
