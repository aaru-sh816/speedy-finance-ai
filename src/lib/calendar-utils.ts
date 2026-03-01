import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
  format,
  addMonths,
  subMonths,
  parseISO,
  isValid,
  startOfDay,
  addDays,
  startOfYear,
  endOfYear,
} from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEventType =
  | "result"
  | "dividend"
  | "bonus"
  | "rights"
  | "demerger"
  | "merger"
  | "split"
  | "buyback"
  | "delisting"
  | "meeting"
  | "other"

export type ViewMode = "day" | "week" | "month" | "year" | "list"

export type EventTypeFilter = "all" | "results" | "corp_action" | "other"

export type CorpActionSubFilter =
  | "dividend"
  | "bonus"
  | "rights"
  | "demerger"
  | "merger"
  | null

export interface RawBSEResult {
  scripcode: string
  companyname: string
  resultdate: string
  resulttype?: string
}

export interface RawBSECorpAction {
  scripcode: string
  companyname: string
  exdate: string
  purpose: string
  recorddate?: string
  bcstartdate?: string
  bcenddate?: string
}

/** API response shape from /api/bse/result-calendar */
export interface APIResultItem {
  id?: string
  scripCode: string
  company: string
  symbol: string
  resultDate: string
  resultType?: string
}

export interface CalendarEvent {
  scripCode: string
  companyName: string
  resultDate: Date
  eventType: CalendarEventType
  resultType?: string
  purpose?: string
  purposeType?: string
  dividendAmount?: number
  ratio?: string
  displayTicker: string
  scheduledTime?: string
  logoUrl?: string
  /** Fallback logo (e.g. Truedata) when primary (e.g. FMP) fails */
  logoUrlFallback?: string
  isin?: string
  beatMiss?: "beat" | "miss" | "estimate"
}

export interface DayEvents {
  date: Date
  events: CalendarEvent[]
  isToday: boolean
  isCurrentMonth: boolean
  isOverflow: boolean
}

// ─── getPurposeType (shared for corp actions) ───────────────────────────────────

export function getPurposeType(purpose: string): CalendarEventType {
  const p = purpose.toLowerCase()
  if (p.includes("dividend")) return "dividend"
  if (p.includes("bonus")) return "bonus"
  if (p.includes("split")) return "split"
  if (p.includes("right")) return "rights"
  if (p.includes("demerger")) return "demerger"
  if (p.includes("merger")) return "merger"
  if (p.includes("buyback")) return "buyback"
  if (p.includes("delist")) return "delisting"
  if (p.includes("agm") || p.includes("egm")) return "meeting"
  return "other"
}

function parseDividendAmount(purpose: string): number | undefined {
  if (!purpose.toLowerCase().includes("dividend")) return undefined
  const match = purpose.match(/([\d.]+)\s*$/)
  if (match) return parseFloat(match[1])
  return undefined
}

function parseRatio(purpose: string): string | undefined {
  const bonusMatch = purpose.match(/(\d+):(\d+)/)
  if (bonusMatch) return `${bonusMatch[1]}:${bonusMatch[2]}`
  const splitMatch = purpose.match(/Rs\.?(\d+).*to.*Rs\.?(\d+)/i)
  if (splitMatch) return `${splitMatch[1]}:${splitMatch[2]}`
  return undefined
}

// ─── Date Parsing ──────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

/**
 * Parses BSE date strings. Supports ISO, DD/MM/YYYY, DD-MM-YYYY, "23 Oct 2023", "23-Oct-2023".
 */
export function parseBseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null
  const s = dateStr.trim()
  if (!s) return null

  const isoAttempt = parseISO(s)
  if (isValid(isoAttempt)) return isoAttempt

  const parts = s.split("/")
  if (parts.length === 3) {
    const attempt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    if (isValid(attempt)) return attempt
  }

  const ddmmyy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (ddmmyy) {
    const attempt = new Date(`${ddmmyy[3]}-${ddmmyy[2]}-${ddmmyy[1]}`)
    if (isValid(attempt)) return attempt
  }

  const ddMmmYyyy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (ddMmmYyyy) {
    const day = parseInt(ddMmmYyyy[1], 10)
    const monthKey = ddMmmYyyy[2].toLowerCase().slice(0, 3)
    const month = MONTH_NAMES[monthKey]
    const year = parseInt(ddMmmYyyy[3], 10)
    if (month !== undefined) {
      const attempt = new Date(year, month, day)
      if (isValid(attempt)) return attempt
    }
  }

  const ddMmmYyyy2 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (ddMmmYyyy2) {
    const day = parseInt(ddMmmYyyy2[1], 10)
    const monthKey = ddMmmYyyy2[2].toLowerCase().slice(0, 3)
    const month = MONTH_NAMES[monthKey]
    const year = parseInt(ddMmmYyyy2[3], 10)
    if (month !== undefined) {
      const attempt = new Date(year, month, day)
      if (isValid(attempt)) return attempt
    }
  }

  return null
}

/** User preference: 0 = Sunday, 1 = Monday */
export type WeekStartsOn = 0 | 1

// ─── Date Range Computation ───────────────────────────────────────────────────

export function getDateRange(
  viewDate: Date,
  viewMode: ViewMode,
  weekStartsOn: WeekStartsOn = 1
): { from: Date; to: Date } {
  switch (viewMode) {
    case "month": {
      const monthStart = startOfMonth(viewDate)
      const monthEnd = endOfMonth(viewDate)
      const from = startOfWeek(monthStart, { weekStartsOn })
      const to = endOfWeek(monthEnd, { weekStartsOn })
      return { from, to }
    }
    case "week": {
      const from = startOfWeek(viewDate, { weekStartsOn })
      const to = endOfWeek(viewDate, { weekStartsOn })
      return { from, to }
    }
    case "day":
      return { from: startOfDay(viewDate), to: startOfDay(viewDate) }
    case "year":
      return {
        from: startOfYear(viewDate),
        to: endOfYear(viewDate),
      }
    case "list":
      return {
        from: startOfDay(viewDate),
        to: addDays(startOfDay(viewDate), 30),
      }
  }
}

/**
 * For the calendar grid (month view), generates 5 weeks x 5 days (Mon-Fri only).
 */
export function buildMonthGridDays(
  viewMonth: Date,
  weekStartsOn: WeekStartsOn = 1
): Date[][] {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekdays = allDays.filter((day) => !isWeekend(day))
  const weeks: Date[][] = []
  for (let i = 0; i < weekdays.length; i += 5) {
    weeks.push(weekdays.slice(i, i + 5))
  }
  return weeks
}

/**
 * For year-at-a-glance: generates weeks with all 7 days (Sun-Sat).
 */
export function buildMonthGridDays7Day(
  viewMonth: Date,
  weekStartsOn: WeekStartsOn = 0
): Date[][] {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }
  return weeks
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000 // UTC+5:30

/**
 * Format scheduledTime (e.g. "09:15") for display in target timezone.
 * Assumes API times are in IST (Asia/Kolkata) for BSE data.
 */
export function formatScheduledTimeForTimezone(
  scheduledTime: string,
  resultDate: Date,
  timezone: string
): string {
  if (!scheduledTime?.trim()) return scheduledTime
  const match = scheduledTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return scheduledTime
  const [, h, m, s] = match
  const hour = parseInt(h!, 10)
  const min = parseInt(m!, 10)
  const sec = s ? parseInt(s, 10) : 0
  const utcMs =
    Date.UTC(
      resultDate.getFullYear(),
      resultDate.getMonth(),
      resultDate.getDate(),
      hour,
      min,
      sec
    ) - IST_OFFSET_MS
  const d = new Date(utcMs)
  try {
    return d.toLocaleTimeString("en", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return scheduledTime
  }
}

// ─── Event Grouping ───────────────────────────────────────────────────────────

export function groupEventsByDate(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const key = format(event.resultDate, "yyyy-MM-dd")
    const existing = map.get(key) ?? []
    existing.push(event)
    map.set(key, existing)
  }
  return map
}

export function getEventsForDate(
  groupedEvents: Map<string, CalendarEvent[]>,
  date: Date
): CalendarEvent[] {
  return groupedEvents.get(format(date, "yyyy-MM-dd")) ?? []
}

// ─── Transforms ───────────────────────────────────────────────────────────────

export function transformResultsToEvents(
  rows: { scripcode: string; companyname: string; resultdate: string; resulttype?: string }[]
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const row of rows) {
    const resultDate = parseBseDate(row.resultdate)
    if (!resultDate) continue
    events.push({
      scripCode: row.scripcode,
      companyName: row.companyname || row.scripcode,
      resultDate,
      eventType: "result",
      resultType: row.resulttype,
      displayTicker: row.scripcode.toUpperCase(),
      scheduledTime: undefined,
      beatMiss: undefined,
    })
  }
  return events.sort((a, b) => a.resultDate.getTime() - b.resultDate.getTime())
}

export function transformCorpActionsToEvents(
  rows: RawBSECorpAction[]
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const row of rows) {
    const resultDate = parseBseDate(row.exdate)
    if (!resultDate) continue
    const purpose = row.purpose || ""
    const purposeType = getPurposeType(purpose)
    events.push({
      scripCode: row.scripcode,
      companyName: row.companyname || row.scripcode,
      resultDate,
      eventType: purposeType,
      purpose,
      purposeType,
      dividendAmount: parseDividendAmount(purpose),
      ratio: parseRatio(purpose),
      displayTicker: row.scripcode.toUpperCase(),
      scheduledTime: undefined,
      beatMiss: undefined,
    })
  }
  return events.sort((a, b) => a.resultDate.getTime() - b.resultDate.getTime())
}

export function mergeCalendarEvents(
  results: CalendarEvent[],
  corpActions: CalendarEvent[]
): CalendarEvent[] {
  const combined = [...results, ...corpActions]
  return combined.sort((a, b) => a.resultDate.getTime() - b.resultDate.getTime())
}

// ─── Legacy API Transform (for backward compat) ────────────────────────────────

export function transformAPIResults(items: APIResultItem[]): CalendarEvent[] {
  return transformResultsToEvents(
    items.map((item) => ({
      scripcode: item.scripCode,
      companyname: item.company || item.symbol || item.scripCode,
      resultdate: item.resultDate,
      resulttype: item.resultType,
    }))
  )
}

export function transformBSEResults(raw: RawBSEResult[]): CalendarEvent[] {
  return transformResultsToEvents(raw)
}

// ─── Event Type Filter ────────────────────────────────────────────────────────

const CORP_ACTION_TYPES: CalendarEventType[] = [
  "dividend",
  "bonus",
  "rights",
  "demerger",
  "merger",
]
const OTHER_TYPES: CalendarEventType[] = [
  "split",
  "buyback",
  "delisting",
  "meeting",
  "other",
]

export function filterEventsByType(
  events: CalendarEvent[],
  eventTypeFilter: EventTypeFilter,
  corpActionSubFilter: CorpActionSubFilter
): CalendarEvent[] {
  if (eventTypeFilter === "all") {
    if (corpActionSubFilter) {
      return events.filter((e) => e.eventType === corpActionSubFilter)
    }
    return events
  }
  if (eventTypeFilter === "results") {
    return events.filter((e) => e.eventType === "result")
  }
  if (eventTypeFilter === "corp_action") {
    const filtered = events.filter((e) => CORP_ACTION_TYPES.includes(e.eventType))
    if (corpActionSubFilter) {
      return filtered.filter((e) => e.eventType === corpActionSubFilter)
    }
    return filtered
  }
  if (eventTypeFilter === "other") {
    return events.filter((e) => OTHER_TYPES.includes(e.eventType))
  }
  return events
}

// ─── Watchlist Filter ─────────────────────────────────────────────────────────

export function filterEventsByWatchlist(
  events: CalendarEvent[],
  watchlistScripCodes: string[]
): CalendarEvent[] {
  const set = new Set(watchlistScripCodes.map((s) => s.toUpperCase()))
  return events.filter((e) => set.has(e.scripCode.toUpperCase()))
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportEventsToCSV(
  events: CalendarEvent[],
  filename = "calendar-events.csv"
): void {
  const header = ["Company", "Symbol", "Date", "Event Type", "Result Type", "Dividend Amount", "Ratio", "Purpose"]
  const rows = events.map((e) => [
    `"${(e.companyName || "").replace(/"/g, '""')}"`,
    e.displayTicker,
    format(e.resultDate, "yyyy-MM-dd"),
    e.eventType,
    e.resultType ?? "N/A",
    e.dividendAmount != null ? String(e.dividendAmount) : "",
    e.ratio ?? "",
    e.purpose ?? "N/A",
  ])
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Event Type Display Label ─────────────────────────────────────────────────

export function getEventTypeLabel(eventType: CalendarEventType): string {
  const labels: Record<CalendarEventType, string> = {
    result: "Result",
    dividend: "Dividend",
    bonus: "Bonus",
    rights: "Rights",
    demerger: "Demerger",
    merger: "Merger",
    split: "Split",
    buyback: "Buyback",
    delisting: "Delisting",
    meeting: "Meeting",
    other: "Other",
  }
  return labels[eventType] ?? eventType
}

export type EventTypeColorStyle = { text: string; bg: string; border?: string }

export const EVENT_TYPE_COLORS: Record<CalendarEventType, EventTypeColorStyle> = {
  result: { text: "text-amber-400", bg: "bg-amber-500/15" },
  dividend: { text: "text-pink-400", bg: "bg-pink-500/15" },
  bonus: { text: "text-violet-400", bg: "bg-violet-500/15" },
  rights: { text: "text-indigo-400", bg: "bg-indigo-500/15" },
  split: { text: "text-sky-400", bg: "bg-sky-500/15" },
  meeting: { text: "text-cyan-400", bg: "bg-cyan-500/15" },
  buyback: { text: "text-emerald-400", bg: "bg-emerald-500/15" },
  demerger: { text: "text-blue-400", bg: "bg-blue-500/15" },
  merger: { text: "text-blue-400", bg: "bg-blue-500/15" },
  delisting: { text: "text-rose-400", bg: "bg-rose-500/15" },
  other: { text: "text-zinc-400", bg: "bg-zinc-500/10" },
}

export function getEventTypeColor(eventType: CalendarEventType): EventTypeColorStyle {
  return EVENT_TYPE_COLORS[eventType] ?? EVENT_TYPE_COLORS.other
}
