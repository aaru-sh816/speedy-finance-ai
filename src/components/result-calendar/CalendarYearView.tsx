"use client"

import { useMemo } from "react"
import { startOfMonth, addMonths, format, isSameMonth } from "date-fns"
import {
  buildMonthGridDays7Day,
  groupEventsByDate,
  getEventsForDate,
  getEventTypeColor,
  type WeekStartsOn,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/calendar-utils"
import { haptic } from "@/lib/haptic"

interface CalendarYearViewProps {
  viewDate: Date
  events: CalendarEvent[]
  onSelectMonth: (date: Date) => void
  onSelectDate?: (date: Date) => void
  weekStartsOn?: WeekStartsOn
  watchlistSet?: Set<string>
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] // Sun, Mon, Tue, Wed, Thu, Fri, Sat

function getDominantEventType(dayEvents: CalendarEvent[]): CalendarEventType | null {
  if (dayEvents.length === 0) return null
  if (dayEvents.length === 1) return dayEvents[0].eventType
  const counts = new Map<CalendarEventType, number>()
  for (const e of dayEvents) {
    counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1)
  }
  let maxCount = 0
  let dominant: CalendarEventType | null = null
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      dominant = type
    }
  }
  return dominant
}

export function CalendarYearView({
  viewDate,
  events,
  onSelectMonth,
  onSelectDate,
  weekStartsOn = 0,
  watchlistSet: _watchlistSet,
}: CalendarYearViewProps) {
  const yearStart = useMemo(
    () => new Date(viewDate.getFullYear(), 0, 1),
    [viewDate.getFullYear()]
  )

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events])

  const months = useMemo(() => {
    return MONTH_NAMES.map((name, i) => {
      const monthDate = addMonths(yearStart, i)
      const weeks = buildMonthGridDays7Day(monthDate, weekStartsOn)
      return { name, monthDate, weeks }
    })
  }, [yearStart, weekStartsOn])

  function handleMonthClick(monthDate: Date) {
    haptic.cellExpand()
    onSelectMonth(startOfMonth(monthDate))
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-5"
      role="grid"
      aria-label={`Year ${viewDate.getFullYear()} calendar`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(({ name, monthDate, weeks }) => (
          <div
            key={name}
            className="flex flex-col p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors duration-150 text-left"
          >
            <button
              type="button"
              onClick={() => handleMonthClick(monthDate)}
              className="text-[12px] font-medium text-white mb-2 block w-fit text-left hover:underline focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-transparent rounded"
              aria-label={`${name} ${viewDate.getFullYear()} - view month`}
            >
              {name}
            </button>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAY_LABELS.map((d, i) => (
                <span
                  key={i}
                  className="text-[9px] text-white/40 font-medium"
                >
                  {d}
                </span>
              ))}
              {weeks.flat().map((date) => {
                const isCurrentMonth = isSameMonth(date, monthDate)
                const dayEvents = getEventsForDate(groupedEvents, date)
                const hasEvents = dayEvents.length > 0
                const dominantType = getDominantEventType(dayEvents)
                const dayColor = dominantType
                  ? getEventTypeColor(dominantType)
                  : null
                const eventDayClass = dayColor
                  ? `${dayColor.text} ${dayColor.bg} font-medium`
                  : "text-cyan-400 bg-cyan-500/20 font-medium"
                const dayClass = `text-[10px] leading-5 rounded ${
                  isCurrentMonth
                    ? hasEvents
                      ? eventDayClass
                      : "text-white/70"
                    : "text-white/25"
                }`
                if (onSelectDate) {
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        haptic.cellExpand()
                        onSelectDate(date)
                      }}
                      className={`${dayClass} bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:ring-offset-0 rounded min-w-[1.25rem]`}
                      aria-label={`View ${format(date, "MMMM d")}`}
                    >
                      {format(date, "d")}
                    </button>
                  )
                }
                return (
                  <span key={date.toISOString()} className={dayClass}>
                    {format(date, "d")}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
