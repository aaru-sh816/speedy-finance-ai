"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Star } from "lucide-react"
import {
  type CalendarEvent,
  getEventTypeLabel,
  getEventTypeColor,
  formatScheduledTimeForTimezone,
} from "@/lib/calendar-utils"
import { FEY_BEAT, FEY_MISS } from "@/lib/fey-tokens"
import { useCalendarPreferences } from "@/contexts/CalendarPreferencesContext"
import { FallbackAvatar } from "@/components/FallbackAvatar"

interface CalendarEventRowProps {
  event: CalendarEvent
  showTime?: boolean
  compact?: boolean
  isInWatchlist?: boolean
}

export function CalendarEventRow({
  event,
  showTime = true,
  compact = true,
  isInWatchlist = false,
}: CalendarEventRowProps) {
  const { timezone } = useCalendarPreferences()
  const logoSize = compact ? 18 : 22
  const [logoSrc, setLogoSrc] = useState<string | null>(event.logoUrl ?? null)
  const hasLogo = !!logoSrc
  const eventColor = getEventTypeColor(event.eventType)

  useEffect(() => {
    setLogoSrc(event.logoUrl ?? null)
  }, [event.logoUrl])

  function handleLogoError() {
    setLogoSrc((prev) =>
      event.logoUrlFallback && prev === event.logoUrl
        ? event.logoUrlFallback
        : null
    )
  }

  const isNumericTicker = /^\d+$/.test(event.displayTicker?.trim() ?? "")
  const displayLabel =
    event.displayTicker && !isNumericTicker
      ? compact && event.displayTicker.length > 14
        ? event.displayTicker.slice(0, 12) + "…"
        : event.displayTicker
      : event.companyName || event.scripCode

  const tooltipParts: string[] = [
    `${event.companyName || event.displayTicker} (${event.scripCode}) — ${getEventTypeLabel(event.eventType)}`,
  ]
  if (event.dividendAmount != null) tooltipParts.push(`Rs ${event.dividendAmount}`)
  if (event.ratio) tooltipParts.push(event.ratio)
  if (!event.dividendAmount && !event.ratio && event.purpose) {
    const snippet = event.purpose.length > 60 ? event.purpose.slice(0, 60) + "…" : event.purpose
    tooltipParts.push(snippet)
  }
  if (isInWatchlist) tooltipParts.push("In watchlist")
  const tooltipTitle = tooltipParts.join(" — ")

  const ariaLabel = `${event.companyName} ${getEventTypeLabel(event.eventType)} on ${event.resultDate.toLocaleDateString()}${isInWatchlist ? ", In watchlist" : ""}`

  return (
    <Link
      href={`/company/${event.scripCode}`}
      title={tooltipTitle}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 w-full min-w-0 rounded-[3px] px-0.5 py-0.5 hover:bg-white/[0.06] hover:ring-1 hover:ring-white/10 transition-all duration-150 group"
      aria-label={ariaLabel}
    >
      {hasLogo ? (
        <div
          className="flex-shrink-0 rounded-full overflow-hidden border border-white/10 bg-zinc-800 group-hover:ring-1 group-hover:ring-white/20 transition-shadow"
          style={{ width: logoSize, height: logoSize }}
        >
          <img
            src={logoSrc}
            alt=""
            width={logoSize}
            height={logoSize}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleLogoError}
          />
        </div>
      ) : (
        <FallbackAvatar
          initial={displayLabel}
          size={logoSize}
          className="group-hover:ring-1 group-hover:ring-white/20 transition-shadow"
        />
      )}

      {isInWatchlist && (
        <Star className="w-3 h-3 text-amber-400/80 flex-shrink-0 fill-amber-400/40" aria-hidden />
      )}

      {event.beatMiss === "beat" && (
        <span className="text-[11px] flex-shrink-0" style={{ color: FEY_BEAT }} aria-hidden>▲</span>
      )}
      {event.beatMiss === "miss" && (
        <span className="text-[11px] flex-shrink-0" style={{ color: FEY_MISS }} aria-hidden>▼</span>
      )}
      <span
        className={`text-[12px] font-medium text-white truncate flex-shrink min-w-0 group-hover:text-white/90 ${
          displayLabel === event.displayTicker ? "font-mono uppercase tracking-wide" : ""
        }`}
      >
        {displayLabel}
      </span>

      {!compact && (
        <span className="text-[10px] flex-shrink-0 text-white/45">
          {getEventTypeLabel(event.eventType)}
        </span>
      )}

      {!compact && event.resultType && event.eventType === "result" && (
        <span className={`text-[10px] border border-white/10 px-1 py-0.5 rounded-sm flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
          {event.resultType}
        </span>
      )}

      {!compact && event.dividendAmount != null && event.eventType === "dividend" && (
        <span className={`text-[10px] px-1 py-0.5 rounded-sm flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
          Rs {event.dividendAmount}
        </span>
      )}

      {!compact && event.ratio && (event.eventType === "bonus" || event.eventType === "split") && (
        <span className={`text-[10px] px-1 py-0.5 rounded-sm flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
          {event.ratio}
        </span>
      )}

      {!compact && !event.dividendAmount && !event.ratio && event.purpose && event.eventType !== "result" && (
        <span className={`text-[10px] px-1 py-0.5 rounded-sm flex-shrink-0 max-w-[120px] truncate ${eventColor.bg} ${eventColor.text}`} title={event.purpose}>
          {event.purpose.length > 40 ? event.purpose.slice(0, 40) + "…" : event.purpose}
        </span>
      )}

      <span className="flex-1 min-w-0" />

      {compact ? (
        <>
          <span className="text-[11px] flex-shrink-0 text-white/45">
            {getEventTypeLabel(event.eventType)}
          </span>
          {event.eventType === "dividend" && event.dividendAmount != null && (
            <span className={`text-[10px] px-1 py-0.5 rounded flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
              Rs {event.dividendAmount}
            </span>
          )}
          {event.eventType === "result" && event.resultType && (
            <span className={`text-[10px] px-1 py-0.5 rounded flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
              {event.resultType}
            </span>
          )}
          {(event.eventType === "bonus" || event.eventType === "split") && event.ratio && (
            <span className={`text-[10px] px-1 py-0.5 rounded flex-shrink-0 ${eventColor.bg} ${eventColor.text}`}>
              {event.ratio}
            </span>
          )}
        </>
      ) : (
        showTime &&
        event.scheduledTime && (
          <span className="text-[11px] flex-shrink-0 tabular-nums text-white/45">
            {formatScheduledTimeForTimezone(
              event.scheduledTime,
              event.resultDate,
              timezone
            )}
          </span>
        )
      )}

      {event.beatMiss === "beat" && (
        <span
          className="text-[11px] flex-shrink-0 font-semibold"
          style={{ color: FEY_BEAT }}
        >
          Beat
        </span>
      )}
      {event.beatMiss === "miss" && (
        <span
          className="text-[11px] flex-shrink-0 font-semibold"
          style={{ color: FEY_MISS }}
        >
          Missed
        </span>
      )}
      {event.beatMiss === "estimate" && (
        <span className="text-[11px] text-white/35 flex-shrink-0">Est.</span>
      )}
    </Link>
  )
}
