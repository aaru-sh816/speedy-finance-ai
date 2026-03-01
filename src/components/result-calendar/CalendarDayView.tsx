"use client"

import { useMemo } from "react"
import { format, isToday } from "date-fns"
import { CalendarEventRow } from "./CalendarEventRow"
import type { CalendarEvent } from "@/lib/calendar-utils"

interface CalendarDayViewProps {
  viewMonth: Date
  events: CalendarEvent[]
  watchlistSet?: Set<string>
}

export function CalendarDayView({
  viewMonth,
  events,
  watchlistSet,
}: CalendarDayViewProps) {
  const today = isToday(viewMonth)
  const dayEvents = useMemo(
    () =>
      events.filter(
        (e) => format(e.resultDate, "yyyy-MM-dd") === format(viewMonth, "yyyy-MM-dd")
      ),
    [events, viewMonth]
  )
  const hasEvents = dayEvents.length > 0

  return (
    <div className="flex flex-col flex-1 p-5">
      <div className="mb-4">
        <h3 className="text-[15px] font-medium text-white">
          {today
            ? `Today — ${format(viewMonth, "EEEE, MMMM d")}`
            : format(viewMonth, "EEEE, MMMM d, yyyy")}
        </h3>
        <p className="text-[12px] text-white/40 mt-0.5">
          {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {hasEvents ? (
        <div className="flex flex-col gap-1">
          {dayEvents.map((event) => (
            <div
              key={`${event.scripCode}-${event.eventType}-${format(event.resultDate, "yyyy-MM-dd")}`}
              className="border border-white/[0.06] rounded-lg px-3 py-2.5 hover:bg-white/[0.06] transition-colors duration-150"
            >
              <CalendarEventRow
                event={event}
                showTime={!!event.scheduledTime}
                compact={false}
                isInWatchlist={watchlistSet?.has(event.scripCode.toUpperCase())}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/20" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-[13px] text-white/35">No events scheduled for this day</p>
        </div>
      )}
    </div>
  )
}
