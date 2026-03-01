import { NextResponse } from "next/server"
import {
  getBseResultCalendarFromApi,
  getBseCorporateActionsFromApi,
  getBseListSecuritiesFromApi,
  getBseLookupFromApi,
} from "@/lib/nse-bse/unified-market"
import { getResultsCalendar } from "@/lib/finedge"
import { SCRIP_TO_NSE_SYMBOL } from "@/lib/scrip-symbol-map"
import {
  transformResultsToEvents,
  transformCorpActionsToEvents,
  mergeCalendarEvents,
  type CalendarEvent,
} from "@/lib/calendar-utils"
import { buildLogoUrls } from "@/lib/logo-utils"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

const MAX_SCRIP_ENRICHMENT = 120

async function enrichEventsWithIsinAndSymbol(
  events: CalendarEvent[]
): Promise<CalendarEvent[]> {
  const uniqueScripCodes = [...new Set(events.map((e) => e.scripCode).filter(Boolean))]
  const toFetch = uniqueScripCodes.slice(0, MAX_SCRIP_ENRICHMENT)

  const companyNameByCode = new Map<string, string>()
  for (const e of events) {
    if (e.scripCode && e.companyName && !companyNameByCode.has(e.scripCode)) {
      companyNameByCode.set(e.scripCode, e.companyName)
    }
  }

  const lookupMap = new Map<
    string,
    { isin: string; symbol: string; companyname: string }
  >()

  const results = await Promise.all(
    toFetch.map(async (code) => {
      try {
        const rows = await getBseListSecuritiesFromApi({
          scripcode: code,
          segment: "Equity",
          status: "Active",
        })
        const first = rows[0]
        let symbol = ""
        let isin = ""
        let companyname = ""

        if (first) {
          symbol =
            first.symbol && /^[A-Z0-9&.-]+$/i.test(first.symbol)
              ? first.symbol.toUpperCase()
              : ""
          isin = first.isin?.trim() || ""
          companyname = (first.companyname ?? "").trim()
        }

        // When listSecurities returns nothing or numeric symbol: resolve NSE ticker for logos
        const isNumericSymbol = !symbol || /^\d+$/.test(symbol) || symbol === code
        if (isNumericSymbol) {
          const fromMap = SCRIP_TO_NSE_SYMBOL[code]
          if (fromMap) {
            symbol = fromMap
          } else {
            const lookup = await getBseLookupFromApi(code)
            const resolved = lookup?.symbol?.trim()
            if (resolved && !/^\d+$/.test(resolved)) symbol = resolved.toUpperCase()

            if (!symbol || /^\d+$/.test(symbol)) {
              const companyName = companyNameByCode.get(code)?.trim() || companyname
              if (companyName) {
                const lookupByName = await getBseLookupFromApi(companyName)
                const resolvedByName = lookupByName?.symbol?.trim()
                if (resolvedByName && !/^\d+$/.test(resolvedByName)) {
                  symbol = resolvedByName.toUpperCase()
                }
              }
              if (!symbol && companyName) {
                const extracted = companyName
                  .split(/\s+/)[0]
                  ?.toUpperCase()
                  .replace(/[^A-Z0-9&.-]/g, "")
                if (
                  extracted &&
                  extracted.length >= 2 &&
                  extracted.length <= 15 &&
                  !/^\d+$/.test(extracted)
                ) {
                  symbol = extracted
                }
              }
            }
          }
        }

        return {
          code,
          isin,
          symbol: symbol || code.toUpperCase(),
          companyname,
        }
      } catch {
        return { code, isin: "", symbol: "", companyname: "" }
      }
    })
  )

  for (const { code, isin, symbol, companyname } of results) {
    lookupMap.set(code, { isin, symbol, companyname })
  }

  return events.map((e) => {
    const lookup = lookupMap.get(e.scripCode)
    if (!lookup) return e
    const displayTicker = lookup.symbol || e.displayTicker
    const baseSymbol = lookup.symbol?.replace(/\.(BO|NS)$/i, "").trim() || lookup.symbol || ""
    const { logoUrl, logoUrlFallback } = buildLogoUrls(baseSymbol, lookup.isin)
    const companyName =
      lookup.companyname &&
      (!e.companyName ||
        e.companyName === e.scripCode ||
        e.companyName.length < lookup.companyname.length)
        ? lookup.companyname
        : e.companyName
    return {
      ...e,
      companyName: companyName || e.companyName,
      displayTicker,
      logoUrl,
      logoUrlFallback,
      isin: lookup.isin || undefined,
    }
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fromDateStr = searchParams.get("fromDate")
  const toDateStr = searchParams.get("toDate")
  const scripCode = searchParams.get("scripCode") || undefined

  if (!fromDateStr || !toDateStr) {
    return NextResponse.json(
      { events: [], count: 0, error: "fromDate and toDate are required" },
      { status: 400 }
    )
  }

  const fromDate = new Date(fromDateStr)
  const toDate = new Date(toDateStr)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json(
      { events: [], count: 0, error: "Invalid date format" },
      { status: 400 }
    )
  }
  if (fromDate > toDate) {
    return NextResponse.json(
      { events: [], count: 0, error: "fromDate must be before or equal to toDate" },
      { status: 400 }
    )
  }

  try {
    const [resultsRows, corpActionsRows] = await Promise.all([
      getBseResultCalendarFromApi({
        fromDate,
        toDate,
        scripcode: scripCode,
      }),
      getBseCorporateActionsFromApi({
        fromDate,
        toDate,
        scripcode: scripCode,
      }),
    ])

    const resultsEvents = transformResultsToEvents(resultsRows)
    const corpActionEvents = transformCorpActionsToEvents(corpActionsRows)
    let events: CalendarEvent[] = mergeCalendarEvents(
      resultsEvents,
      corpActionEvents
    )

    try {
      const [finedgeResults, reverseMap] = await Promise.all([
        getResultsCalendar({
          from_date: format(fromDate, "yyyy-MM-dd"),
          to_date: format(toDate, "yyyy-MM-dd"),
        }),
        import("@/lib/finedge").then((m) => m.getReverseSymbolMap()),
      ])
      const seenKeys = new Set(events.map((e) => `${e.scripCode}_${format(e.resultDate, "yyyy-MM-dd")}_result`))
      for (const r of finedgeResults) {
        const sym = (r.symbol ?? "").trim()
        const dt = r.expected_result_date
        if (!sym || !dt) continue
        const d = new Date(dt)
        if (isNaN(d.getTime()) || d < fromDate || d > toDate) continue
        const key = `${reverseMap.get(sym) ?? sym}_${format(d, "yyyy-MM-dd")}_result`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        events.push({
          scripCode: reverseMap.get(sym.toUpperCase()) ?? sym,
          companyName: r.company_name ?? sym,
          resultDate: d,
          eventType: "result",
          displayTicker: sym,
        })
      }
      events.sort((a, b) => a.resultDate.getTime() - b.resultDate.getTime())
    } catch (e) {
      console.warn("[Calendar Unified] FinEdge results merge failed:", e)
    }

    events = await enrichEventsWithIsinAndSymbol(events)

    return NextResponse.json(
      {
        events,
        count: events.length,
        meta: {
          fetchedAt: new Date().toISOString(),
          source: "nse-bse-api+finedge",
          fromDate: format(fromDate, "yyyy-MM-dd"),
          toDate: format(toDate, "yyyy-MM-dd"),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch calendar"
    console.error("[Calendar Unified] Error:", error)
    return NextResponse.json(
      { events: [], count: 0, error: message },
      { status: 500 }
    )
  }
}
