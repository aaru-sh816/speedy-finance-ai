"use client"

import { useState } from "react"
import { format, isToday } from "date-fns"
import { CalendarEventRow } from "./CalendarEventRow"
import { haptic } from "@/lib/haptic"
import type { CalendarEvent } from "@/lib/calendar-utils"

interface CalendarCellProps {
  date: Date
  events: CalendarEvent[]
  isCurrentMonth: boolean
  maxVisible?: number
  isLastInRow?: boolean
  watchlistSet?: Set<string>
  onSelectDate?: (date: Date) => void
}

const MAX_VISIBLE = 2

export function CalendarCell({
  date,
  events,
  isCurrentMonth,
  maxVisible = MAX_VISIBLE,
  isLastInRow = false,
  watchlistSet,
  onSelectDate,
}: CalendarCellProps) {
  const [expanded, setExpanded] = useState(false)
  const today = isToday(date)
  const overflow = events.length - maxVisible
  const visibleEvents = expanded ? events : events.slice(0, maxVisible)
  const hasOverflow = !expanded && overflow > 0

  function handleExpandOverflow(e: React.MouseEvent) {
    e.stopPropagation()
    haptic.cellExpand()
    setExpanded(true)
  }

  function handleDateClick() {
    haptic.cellExpand()
    onSelectDate?.(date)
  }

  const dateLabel = today
    ? `Today, ${format(date, "MMM d")}`
    : format(date, "d")

  return (
    <div
      className={`
        relative flex flex-col
        border-b border-white/[0.06]
        ${isLastInRow ? "border-r-0" : "border-r border-white/[0.06]"}
        px-2.5 pt-3 pb-2.5
        min-h-[110px]
        transition-colors duration-150
        ${today ? "bg-white/[0.04]" : ""}
        ${!isCurrentMonth ? "bg-black/20" : ""}
        ${isCurrentMonth && !today ? "hover:bg-white/[0.03]" : ""}
        ${onSelectDate ? "cursor-pointer" : ""}
      `}
      role="gridcell"
      aria-label={
        today
          ? `Today, ${format(date, "MMMM d")}, ${events.length} events`
          : `${format(date, "MMMM d")}, ${events.length} events`
      }
      {...(today && { "aria-current": "date" })}
      {...(onSelectDate && { onClick: handleDateClick })}
    >
      {onSelectDate ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDateClick()
          }}
          aria-label={`View events for ${format(date, "MMMM d")}`}
          className={`
            text-[13px] leading-4 mb-2 select-none text-left w-fit
            bg-transparent border-0 p-0 cursor-pointer
            hover:underline focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-transparent rounded
            ${today ? "text-white font-medium" : ""}
            ${!isCurrentMonth ? "text-white/25" : ""}
            ${isCurrentMonth && !today ? "text-white/80 hover:text-white" : ""}
          `}
        >
          {dateLabel}
        </button>
      ) : (
        <div
          className={`
            text-[13px] leading-4 mb-2 select-none
            ${today ? "text-white font-medium" : ""}
            ${!isCurrentMonth ? "text-white/25" : ""}
            ${isCurrentMonth && !today ? "text-white/80" : ""}
          `}
        >
          {dateLabel}
        </div>
      )}

      <div className="flex flex-col gap-[4px] flex-1">
        {visibleEvents.map((event) => (
          <CalendarEventRow
            key={`${event.scripCode}-${event.eventType}-${format(event.resultDate, "yyyy-MM-dd")}`}
            event={event}
            showTime={!!event.scheduledTime}
            compact
            isInWatchlist={watchlistSet?.has(event.scripCode.toUpperCase())}
          />
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={handleExpandOverflow}
            aria-label={`Show ${overflow} more events on ${format(date, "MMMM d")}`}
            className="flex items-center gap-1.5 w-full text-left px-0.5 py-0.5 rounded-[3px] hover:bg-white/[0.06] transition-colors duration-150 group"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 10 12"
              fill="none"
              className="flex-shrink-0 opacity-40"
              aria-hidden
            >
              <path
                d="M1 1h5l3 3v7a1 1 0 01-1 1H1a1 1 0 01-1-1V2a1 1 0 011-1z"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M6 1v3h3"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.2"
              />
            </svg>
            <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors">
              +{overflow} more
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
