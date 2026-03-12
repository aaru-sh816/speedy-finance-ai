/**
 * FinEdge API client.
 * Base URL: https://data.finedgeapi.com/api/v1
 * Auth: ?token=API_KEY (server-side only via FINEDGE_API_KEY)
 */

const BASE_URL = "https://data.finedgeapi.com/api/v1"
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

function getApiKey(): string | undefined {
  return process.env.FINEDGE_API_KEY
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class FinEdgeError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message)
    this.name = "FinEdgeError"
  }
}

async function finedgeFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new FinEdgeError("FINEDGE_API_KEY is not set", 500)
  }

  const searchParams = new URLSearchParams()
  searchParams.set("token", apiKey)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") {
      searchParams.set(k, String(v))
    }
  }
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}${searchParams.toString()}`
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      })

      if (res.status === 429) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) {
        throw new FinEdgeError(
          body?.error || body?.message || `FinEdge API error: ${res.status}`,
          res.status,
          body
        )
      }
      return body as T
    } catch (e) {
      lastError = e
      if (e instanceof FinEdgeError) throw e
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new FinEdgeError(String(lastError))
}

// ---------- Stock symbols ----------
export async function getStockSymbols(): Promise<
  import("./types").FinEdgeStockSymbol[]
> {
  return finedgeFetch("/stock-symbols")
}

// ---------- Company profile ----------
export async function getCompanyProfile(
  symbol: string
): Promise<import("./types").FinEdgeCompanyProfile> {
  return finedgeFetch(`/company-profile/${encodeURIComponent(symbol)}`)
}

// ---------- Stock search ----------
export async function stockSearch(
  group: "sector" | "industry" | "sub_industry" | "macro_sector",
  value: string
): Promise<{ symbols: string[] }> {
  return finedgeFetch("/stock-search", { group, value })
}

// ---------- Financials ----------
export type StatementType = "s" | "c"
export type StatementCode = "pl" | "bs" | "cf"
export type Period = "annual" | "quarterly" | "ttm" | "ytd"

export async function getFinancials(
  symbol: string,
  opts: {
    statement_type: StatementType
    statement_code: StatementCode
    period: Period
  }
): Promise<import("./types").FinEdgeFinancialsResponse> {
  return finedgeFetch(`/financials/${encodeURIComponent(symbol)}`, opts)
}

// ---------- Basic financials ----------
export async function getBasicFinancials(
  symbol: string,
  opts: { statement_type: StatementType; statement_code: StatementCode }
): Promise<import("./types").FinEdgeBasicFinancialsResponse> {
  return finedgeFetch(`/basic-financials/${encodeURIComponent(symbol)}`, opts)
}

// ---------- Ratios ----------
export type RatioType = "pr" | "ef" | "li" | "le"

export async function getRatios(
  symbol: string,
  opts: { statement_type: StatementType; ratio_type: RatioType }
): Promise<import("./types").FinEdgeRatiosResponse> {
  return finedgeFetch(`/ratios/${encodeURIComponent(symbol)}`, opts)
}

// ---------- Quote ----------
export async function getQuote(
  symbols?: string[]
): Promise<import("./types").FinEdgeQuoteResponse> {
  const symbolParam =
    symbols && symbols.length > 0
      ? symbols.slice(0, 100).join(",")
      : undefined
  return finedgeFetch("/quote", symbolParam ? { symbol: symbolParam } : {})
}

// ---------- Daily quotes (historical) ----------
export async function getDailyQuotes(
  symbol: string,
  opts?: { from?: number; to?: number }
): Promise<{ price: Array<{ close_price: number; quote_date: string;[k: string]: unknown }>; symbol: string }> {
  return finedgeFetch(`/daily-quotes/${encodeURIComponent(symbol)}`, opts ?? {})
}

// ---------- Price ratios ----------
export async function getDailyPriceRatios(
  symbol: string,
  opts?: {
    statement_type: StatementType
    from?: number
    to?: number
  }
): Promise<{
  price_ratios: Array<{ pe?: number; pb?: number; ps?: number; pfcf?: number; ptb?: number; quote_date: string }>
  symbol: string
}> {
  return finedgeFetch(
    `/daily-price-ratios/${encodeURIComponent(symbol)}`,
    opts ?? { statement_type: "c" }
  )
}

export async function getAnnualPriceRatios(
  symbol: string,
  opts?: { statement_type: StatementType }
): Promise<{
  price_ratios: Array<{ pe?: number; pb?: number; header?: string; year?: number;[k: string]: unknown }>
  symbol: string
}> {
  return finedgeFetch(
    `/annual-price-ratios/${encodeURIComponent(symbol)}`,
    opts ?? { statement_type: "c" }
  )
}

// ---------- Peers ----------
export async function getPeers(
  symbol: string,
  group?: "sector" | "industry" | "sub_industry" | "macro_sector"
): Promise<import("./types").FinEdgePeersResponse> {
  return finedgeFetch(`/peers/${encodeURIComponent(symbol)}`, group ? { group } : {})
}

// ---------- Shareholdings ----------
export async function getShareholdingPattern(
  symbol: string,
  period: "quarterly" | "annual"
): Promise<import("./types").FinEdgeShareholdingPatternResponse> {
  return finedgeFetch(`/shareholdings/pattern/${encodeURIComponent(symbol)}`, {
    period,
  })
}

export async function getShareholdingSummary(
  symbol: string,
  period: "quarterly" | "annual"
): Promise<{
  period: string
  summary: Array<Record<string, unknown>>
  symbol: string
}> {
  return finedgeFetch(`/shareholdings/summary/${encodeURIComponent(symbol)}`, {
    period,
  })
}

// ---------- Corporate actions ----------
export async function getCorporateActionsAll(opts?: {
  symbol?: string
  action?: string
  from_date?: string
  to_date?: string
}): Promise<import("./types").FinEdgeCorporateAction[]> {
  return finedgeFetch("/corporate-actions/all", opts ?? {})
}

export async function getCorporateActionByType(
  symbol: string,
  corp_action: "split" | "bonus" | "rights"
): Promise<Record<string, Array<{ action?: string; date?: string }>>> {
  return finedgeFetch(
    `/corporate-actions/${corp_action}/${encodeURIComponent(symbol)}`
  )
}

export async function getDividend(
  symbol: string
): Promise<import("./types").FinEdgeDividendResponse> {
  return finedgeFetch(`/dividend/${encodeURIComponent(symbol)}`)
}

// ---------- Corp announcements ----------
export async function getCorpAnnouncements(opts?: {
  symbol?: string
  from_date?: string
  to_date?: string
}): Promise<import("./types").FinEdgeCorpAnnouncement[]> {
  return finedgeFetch("/corp-announcements", opts ?? {})
}

// ---------- Results calendar ----------
export async function getResultsCalendar(opts?: {
  from_date?: string
  to_date?: string
}): Promise<import("./types").FinEdgeResultsCalendarItem[]> {
  return finedgeFetch("/results-calendar", opts ?? {})
}

// ---------- Indices ----------
export async function getIndexMaster(): Promise<
  import("./types").FinEdgeIndexMasterRow[]
> {
  return finedgeFetch("/index/master")
}

export async function getIndexDailyFeed(): Promise<
  import("./types").FinEdgeIndexRow[]
> {
  return finedgeFetch("/index/market-price/daily-feed")
}

export async function getIndexPriceReturns(): Promise<
  import("./types").FinEdgeIndexPriceReturnsRow[]
> {
  return finedgeFetch("/index/price-returns")
}

export async function getIndexValuationHistory(
  index_symbol: string,
  from_date: string,
  to_date: string
): Promise<unknown> {
  return finedgeFetch("/index/valuation-history", {
    index_symbol,
    from_date,
    to_date,
  })
}

// ---------- Credit ratings ----------
export async function getCreditRatings(opts?: {
  symbol?: string
  from_date?: string
  to_date?: string
}): Promise<unknown> {
  return finedgeFetch("/credit-ratings", opts ?? {})
}

// ---------- Holidays calendar ----------
export async function getHolidaysCalendar(opts?: Record<string, string>): Promise<unknown> {
  return finedgeFetch("/holidays-calendar", opts ?? {})
}

// ---------- Segment revenue ----------
export async function getSegmentRevenue(
  symbol: string,
  opts?: { period?: string; statement_type?: string; statement_code?: string }
): Promise<unknown> {
  return finedgeFetch(`/segment-revenue/${encodeURIComponent(symbol)}`, opts ?? {})
}

// ---------- Shareholdings beneficial owners ----------
export async function getShareholdingBeneficialOwners(
  symbol: string,
  period: "quarterly" | "annual" = "quarterly"
): Promise<unknown> {
  return finedgeFetch(
    `/shareholdings/beneficial-owners/${encodeURIComponent(symbol)}`,
    { period }
  )
}
