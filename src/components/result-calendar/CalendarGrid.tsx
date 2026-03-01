"use client"

import { useMemo } from "react"
import { isSameMonth } from "date-fns"
import { CalendarCell } from "./CalendarCell"
import {
  buildMonthGridDays,
  buildMonthGridDays7Day,
  getEventsForDate,
  groupEventsByDate,
  type CalendarEvent,
  type WeekStartsOn,
} from "@/lib/calendar-utils"

interface CalendarGridProps {
  viewMonth: Date
  events: CalendarEvent[]
  showWeekends?: boolean
  weekStartsOn?: WeekStartsOn
  watchlistSet?: Set<string>
  onSelectDate?: (date: Date) => void
}

const DAY_NAMES_5 = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const DAY_NAMES_7_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_NAMES_7_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function CalendarGrid({
  viewMonth,
  events,
  showWeekends = false,
  weekStartsOn = 1,
  watchlistSet,
  onSelectDate,
}: CalendarGridProps) {
  const weeks = useMemo(
    () =>
      showWeekends
        ? buildMonthGridDays7Day(viewMonth, weekStartsOn)
        : buildMonthGridDays(viewMonth, weekStartsOn),
    [viewMonth, showWeekends, weekStartsOn]
  )
  const groupedEvents = useMemo(() => groupEventsByDate(events), [events])
  const dayNames = showWeekends
    ? weekStartsOn === 0
      ? DAY_NAMES_7_SUN
      : DAY_NAMES_7_MON
    : DAY_NAMES_5
  const cols = showWeekends ? 7 : 5

  return (
    <div className="flex flex-col flex-1 overflow-hidden" role="grid">
      <div
        className={`grid border-b border-white/[0.06]`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {dayNames.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-[12px] text-white/40 font-normal border-r border-white/[0.06] last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex flex-col flex-1">
        {weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="flex-1 grid"
            style={{
              minHeight: "120px",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
            role="row"
          >
            {week.map((date, dayIdx) => {
              const isCurrentMonth = isSameMonth(date, viewMonth)
              const cellEvents = getEventsForDate(groupedEvents, date)
              const isLastInRow = dayIdx === cols - 1
              return (
                <CalendarCell
                  key={date.toISOString()}
                  date={date}
                  events={cellEvents}
                  isCurrentMonth={isCurrentMonth}
                  maxVisible={2}
                  isLastInRow={isLastInRow}
                  watchlistSet={watchlistSet}
                  onSelectDate={onSelectDate}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
