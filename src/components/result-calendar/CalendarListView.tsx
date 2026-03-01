"use client"

import { useRef, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { format, isSameDay, isToday } from "date-fns"
import { CalendarEventRow } from "./CalendarEventRow"
import type { CalendarEvent } from "@/lib/calendar-utils"

type VirtualItem =
  | { type: "header"; date: Date; key: string }
  | { type: "event"; event: CalendarEvent; key: string; isFirstInGroup: boolean; isLastInGroup: boolean }

interface CalendarListViewProps {
  events: CalendarEvent[]
  watchlistSet?: Set<string>
}

export function CalendarListView({
  events,
  watchlistSet,
}: CalendarListViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const flatItems = useMemo<VirtualItem[]>(() => {
    if (events.length === 0) return []
    const items: VirtualItem[] = []
    let lastDate: Date | null = null
    let groupEvents: CalendarEvent[] = []
    for (const event of events) {
      if (!lastDate || !isSameDay(event.resultDate, lastDate)) {
        if (groupEvents.length > 0) {
          groupEvents.forEach((e, idx) => {
            const eventKey = `${e.scripCode}-${e.eventType}-${format(e.resultDate, "yyyy-MM-dd")}`
            items.push({
              type: "event",
              event: e,
              key: eventKey,
              isFirstInGroup: idx === 0,
              isLastInGroup: idx === groupEvents.length - 1,
            })
          })
          groupEvents = []
        }
        const dateKey = format(event.resultDate, "yyyy-MM-dd")
        items.push({ type: "header", date: event.resultDate, key: `h-${dateKey}` })
        lastDate = event.resultDate
      }
      groupEvents.push(event)
    }
    if (groupEvents.length > 0) {
      groupEvents.forEach((e, idx) => {
        const eventKey = `${e.scripCode}-${e.eventType}-${format(e.resultDate, "yyyy-MM-dd")}`
        items.push({
          type: "event",
          event: e,
          key: eventKey,
          isFirstInGroup: idx === 0,
          isLastInGroup: idx === groupEvents.length - 1,
        })
      })
    }
    return items
  }, [events])

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (flatItems[i]?.type === "header" ? 36 : 52),
    overscan: 5,
  })

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/20" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="text-[13px] text-white/35">No events in this period</p>
        <p className="text-[11px] text-white/20">Try a different date range or filter</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-5">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index]
          if (!item) return null
          if (item.type === "header") {
            return (
              <div
                key={item.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`pt-1 pb-2 px-1 uppercase tracking-wider ${
                    isToday(item.date)
                      ? "text-[11px] text-white/70 font-medium"
                      : "text-[11px] text-white/40"
                  }`}
                >
                  {isToday(item.date)
                    ? `Today — ${format(item.date, "MMMM d, yyyy")}`
                    : format(item.date, "EEEE, MMMM d, yyyy")}
                </div>
              </div>
            )
          }
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`px-3 py-2 hover:bg-white/[0.06] transition-colors duration-150 border border-white/[0.06] ${
                item.isFirstInGroup ? "rounded-t-lg" : "border-t-0"
              } ${item.isLastInGroup ? "rounded-b-lg border-b" : "border-b border-white/[0.04]"}`}
            >
              <CalendarEventRow
                event={item.event}
                showTime={!!item.event.scheduledTime}
                compact={false}
                isInWatchlist={watchlistSet?.has(item.event.scripCode.toUpperCase())}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
