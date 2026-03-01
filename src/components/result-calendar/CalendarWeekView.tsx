"use client"

import { useMemo } from "react"
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  isSameMonth,
} from "date-fns"
import { CalendarCell } from "./CalendarCell"
import {
  groupEventsByDate,
  getEventsForDate,
  type CalendarEvent,
  type WeekStartsOn,
} from "@/lib/calendar-utils"

interface CalendarWeekViewProps {
  viewMonth: Date
  events: CalendarEvent[]
  weekStartsOn?: WeekStartsOn
  watchlistSet?: Set<string>
  onSelectDate?: (date: Date) => void
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

export function CalendarWeekView({
  viewMonth,
  events,
  weekStartsOn = 1,
  watchlistSet,
  onSelectDate,
}: CalendarWeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(viewMonth, { weekStartsOn })
    const end = endOfWeek(viewMonth, { weekStartsOn })
    return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d))
  }, [viewMonth, weekStartsOn])

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events])

  return (
    <div className="flex flex-col flex-1" role="grid">
      <div className="grid grid-cols-5 border-b border-white/[0.06]">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-[12px] text-white/40 border-r border-white/[0.06] last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-5 flex-1"
        style={{ minHeight: "400px" }}
        role="row"
      >
        {weekDays.map((date, i) => (
          <CalendarCell
            key={date.toISOString()}
            date={date}
            events={getEventsForDate(groupedEvents, date)}
            isCurrentMonth={isSameMonth(date, viewMonth)}
            maxVisible={8}
            isLastInRow={i === 4}
            watchlistSet={watchlistSet}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    </div>
  )
}
