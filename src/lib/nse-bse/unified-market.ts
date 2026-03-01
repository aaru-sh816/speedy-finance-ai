/**
 * Unified NSE/BSE Market Data Service
 * Uses nse-bse-api for direct exchange data - no external microservice required.
 * Enhances Speedy Finance with NSE + BSE data from a single TypeScript SDK.
 */

import path from "node:path";
import { NSE, BSE } from "nse-bse-api";

// Lazy singletons (Node.js server context only)
let _nse: InstanceType<typeof NSE> | null = null;
let _bse: InstanceType<typeof BSE> | null = null;

/** NSE download dir: under process cwd so it works in serverless and from any CWD */
function getNseDownloadDir(): string {
  return path.join(process.cwd(), ".nse-downloads");
}

function getNSE(): InstanceType<typeof NSE> {
  if (!_nse) _nse = new NSE(getNseDownloadDir());
  return _nse;
}

function getBSE(): InstanceType<typeof BSE> {
  if (!_bse) _bse = new BSE();
  return _bse;
}

/** Check if symbol is BSE scrip code (5-6 digits) */
export function isBseScripCode(symbol: string): boolean {
  return /^\d{5,6}$/.test(symbol.trim());
}

export interface UnifiedQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  open?: number | null;
  source: "nse" | "bse";
}

/**
 * Get BSE quote via nse-bse-api (getScripHeaderData)
 * BSE.quote returns { LTP, PrevClose, Open, High, Low }
 */
export async function getBseQuoteFromApi(scripCode: string): Promise<UnifiedQuote | null> {
  if (!scripCode?.trim()) return null;
  try {
    const bse = getBSE();
    const q = await bse.quote(scripCode);
    if (q && typeof (q as { LTP?: number }).LTP === "number") {
      const h = q as { LTP: number; PrevClose: number; Open: number; High: number; Low: number; volume?: number };
      const prev = h.PrevClose ?? 0;
      const ltp = h.LTP ?? 0;
      const change = prev ? ltp - prev : 0;
      const changePercent = prev ? (change / prev) * 100 : 0;
      const vol = h.volume != null && Number.isFinite(h.volume) ? h.volume : null;
      return {
        symbol: scripCode,
        price: ltp,
        change,
        changePercent,
        volume: vol,
        dayHigh: h.High ?? null,
        dayLow: h.Low ?? null,
        previousClose: prev || null,
        marketCap: null,
        open: h.Open ?? null,
        source: "bse",
      };
    }
  } catch {
    // Fallback to existing BSE service
  }
  return null;
}

/** BSE 52-week high/low from nse-bse-api (HighLow/w) */
export interface Bse52WeekRow {
  fifty2WeekHigh: number;
  fifty2WeekLow: number;
  dateHigh?: string;
  dateLow?: string;
}

/**
 * Get BSE 52-week high/low via nse-bse-api. Returns null on error.
 */
export async function getBse52WeekFromApi(scripCode: string): Promise<Bse52WeekRow | null> {
  if (!scripCode?.trim()) return null;
  try {
    const bse = getBSE();
    const data = await bse.quoteWeeklyHL(scripCode);
    const d = data as { fifty2WeekHigh?: number; fifty2WeekLow?: number; dateHigh?: string; dateLow?: string };
    if (typeof d.fifty2WeekHigh === "number" && typeof d.fifty2WeekLow === "number") {
      return {
        fifty2WeekHigh: d.fifty2WeekHigh,
        fifty2WeekLow: d.fifty2WeekLow,
        dateHigh: d.dateHigh,
        dateLow: d.dateLow,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get NSE quote via nse-bse-api
 */
export async function getNseQuoteFromApi(symbol: string): Promise<UnifiedQuote | null> {
  if (!symbol?.trim()) return null;
  try {
    const nse = getNSE();
    const q = await nse.equityQuote(symbol);
    const pi = (q as { priceInfo?: { lastPrice?: number; change?: number; pChange?: number; previousClose?: number; intraDayHighLow?: { max?: number; min?: number } } })?.priceInfo;
    if (pi?.lastPrice != null) {
      return {
        symbol: symbol.toUpperCase(),
        price: Number(pi.lastPrice),
        change: Number(pi.change ?? 0) || null,
        changePercent: Number(pi.pChange ?? 0) || null,
        volume: null,
        dayHigh: pi.intraDayHighLow?.max != null ? Number(pi.intraDayHighLow.max) : null,
        dayLow: pi.intraDayHighLow?.min != null ? Number(pi.intraDayHighLow.min) : null,
        previousClose: pi.previousClose != null ? Number(pi.previousClose) : null,
        marketCap: null,
        source: "nse",
      };
    }
  } catch {
    // Fallback handled by caller
  }
  return null;
}

/**
 * Get BSE gainers (group A by default)
 */
export async function getBseGainersFromApi(): Promise<any[]> {
  try {
    const bse = getBSE();
    const data = await bse.gainers();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Get BSE losers
 */
export async function getBseLosersFromApi(): Promise<any[]> {
  try {
    const bse = getBSE();
    const data = await bse.losers();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** BSE corporate action row from nse-bse-api (ActionData) */
export interface BseActionRow {
  scripcode: string;
  companyname: string;
  exdate: string;
  purpose: string;
  recorddate?: string;
  bcstartdate?: string;
  bcenddate?: string;
}

/** Normalize raw BSE corporate action row to BseActionRow (handles Table shape and casing) */
function toBseActionRow(row: Record<string, unknown>): BseActionRow {
  return {
    scripcode: String(row.scripcode ?? row.scrip_code ?? "").trim(),
    companyname: String(row.companyname ?? row.long_name ?? row.short_name ?? "").trim(),
    exdate: String(row.exdate ?? row.Ex_date ?? row.EX_DT ?? "").trim(),
    purpose: String(row.purpose ?? row.Purpose ?? "").trim(),
    recorddate: row.recorddate != null ? String(row.recorddate) : row.RD_Date != null ? String(row.RD_Date) : undefined,
    bcstartdate: row.bcstartdate != null ? String(row.bcstartdate) : row.BCRD_FROM != null ? String(row.BCRD_FROM) : undefined,
    bcenddate: row.bcenddate != null ? String(row.bcenddate) : row.BCRD_TO != null ? String(row.BCRD_TO) : undefined,
  };
}

/**
 * Get BSE corporate actions via nse-bse-api.
 * Handles both array response and { Table: [...] } from BSE API.
 */
export async function getBseCorporateActionsFromApi(options?: {
  fromDate?: Date;
  toDate?: Date;
  scripcode?: string;
  segment?: "equity" | "sme" | "debt" | "mf";
}): Promise<BseActionRow[]> {
  try {
    const bse = getBSE();
    const data = await bse.actions(options);
    if (Array.isArray(data)) {
      return data.map((item) => toBseActionRow((item as unknown) as Record<string, unknown> ?? {}));
    }
    // BSE sometimes returns { Table: [...] } for DefaultData/w
    const table = data && typeof data === "object" && "Table" in data && Array.isArray((data as { Table?: unknown[] }).Table)
      ? (data as { Table: unknown[] }).Table
      : [];
    return table.map((item) => toBseActionRow((item as unknown) as Record<string, unknown> ?? {}));
  } catch {
    return [];
  }
}

// --- BSE extended (nse-bse-api) ---

/** Raw BSE announcements response from nse-bse-api (API may return Table/Table1) */
export type BseAnnouncementsRaw = { Table?: unknown[]; Table1?: unknown[] } | unknown[];

const BSE_ANNOUNCEMENTS_URL = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w";

function formatBseDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Direct fetch to BSE announcements API with browser-like headers (bypasses 403 when nse-bse-api is blocked).
 */
async function fetchBseAnnouncementsDirect(options?: {
  pageNo?: number;
  fromDate?: Date;
  toDate?: Date;
  segment?: "equity" | "sme" | "debt" | "mf";
  scripcode?: string;
  category?: string;
  subcategory?: string;
}): Promise<BseAnnouncementsRaw | null> {
  const {
    pageNo = 1,
    fromDate = new Date(),
    toDate = new Date(),
    segment = "equity",
    scripcode = "",
    category = "-1",
    subcategory = "-1",
  } = options ?? {};
  const segmentType = segment === "equity" ? "C" : segment === "debt" ? "D" : "M";
  const params = new URLSearchParams({
    pageno: String(pageNo),
    strCat: category,
    subcategory,
    strPrevDate: formatBseDate(fromDate),
    strToDate: formatBseDate(toDate),
    strSearch: "P",
    strscrip: scripcode,
    strType: segmentType,
  });
  const url = `${BSE_ANNOUNCEMENTS_URL}?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.bseindia.com/",
        Origin: "https://www.bseindia.com",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BseAnnouncementsRaw;
    return data;
  } catch {
    return null;
  }
}

/**
 * Get BSE announcements via nse-bse-api, with direct fetch fallback when 403.
 * Returns raw API shape; route should normalize to BSEAnnouncement.
 */
export async function getBseAnnouncementsFromApi(options?: {
  pageNo?: number;
  fromDate?: Date;
  toDate?: Date;
  segment?: "equity" | "sme" | "debt" | "mf";
  scripcode?: string;
  category?: string;
  subcategory?: string;
}): Promise<BseAnnouncementsRaw | null> {
  try {
    const bse = getBSE();
    const data = await bse.announcements(options as any);
    return data as BseAnnouncementsRaw;
  } catch (e) {
    console.error("[getBseAnnouncementsFromApi] nse-bse-api error:", e);
    const direct = await fetchBseAnnouncementsDirect(options);
    if (direct) {
      console.log("[getBseAnnouncementsFromApi] Fallback direct fetch succeeded");
    }
    return direct;
  }
}

/** BSE result calendar row from nse-bse-api */
export interface BseResultCalendarRow {
  scripcode: string;
  companyname: string;
  resultdate: string;
  resulttype: string;
}

/** Raw row from BSE API (may use different keys) */
function toResultCalendarRow(row: Record<string, unknown>, index: number): BseResultCalendarRow {
  const scripcode = String(row.scripcode ?? row.scrip_Code ?? "").trim();
  const companyname = String(row.companyname ?? row.long_name ?? row.short_name ?? "").trim();
  const resultdate = String(row.resultdate ?? row.meeting_date ?? "").trim();
  const resulttype = String(row.resulttype ?? row.Result_Type ?? "").trim();
  return { scripcode, companyname, resultdate, resulttype };
}

/**
 * Get BSE result calendar via nse-bse-api.
 * Handles both array and { Table: [] } response; normalizes BSE field names.
 */
export async function getBseResultCalendarFromApi(options?: {
  fromDate?: Date;
  toDate?: Date;
  scripcode?: string;
}): Promise<BseResultCalendarRow[]> {
  try {
    const bse = getBSE();
    const data = await bse.resultCalendar(options as any);
    const rawList: unknown[] = Array.isArray(data)
      ? data
      : data && typeof data === "object" && "Table" in data && Array.isArray((data as { Table?: unknown[] }).Table)
        ? (data as { Table: unknown[] }).Table
        : [];
    return rawList.map((item, i) => toResultCalendarRow((item as unknown) as Record<string, unknown> ?? {}, i));
  } catch {
    return [];
  }
}

/** BSE advance/decline row from nse-bse-api */
export interface BseAdvanceDeclineRow {
  advances?: number;
  declines?: number;
  unchanged?: number;
  [key: string]: unknown;
}

/**
 * Get BSE advance/decline via nse-bse-api
 */
export async function getBseAdvanceDeclineFromApi(): Promise<BseAdvanceDeclineRow[]> {
  try {
    const bse = getBSE();
    const data = await bse.advanceDecline();
    return (Array.isArray(data) ? data : []) as BseAdvanceDeclineRow[];
  } catch {
    return [];
  }
}

/** BSE symbol lookup result from nse-bse-api */
export interface BseLookupRow {
  company_name?: string;
  symbol?: string;
  isin?: string;
  bse_code?: string;
}

/**
 * Get BSE symbol lookup via nse-bse-api (search by name, symbol, ISIN or BSE code)
 */
export async function getBseLookupFromApi(text: string): Promise<BseLookupRow | null> {
  if (!text?.trim()) return null;
  try {
    const bse = getBSE();
    const result = await bse.lookupSymbol(text);
    return result as BseLookupRow | null;
  } catch {
    return null;
  }
}

/** Read market cap from a listSecurities row (BSE may use various property names). */
function readMcapFromRow(row: Record<string, unknown>): number | null {
  const mcap =
    row.Mktcap ??
    row.MktCap ??
    row.mktcap ??
    row.marketCap ??
    row.CUR_MKTCAP ??
    row.MKTCAP ??
    row.market_cap ??
    row.MktCap;
  if (mcap == null || mcap === "") return null;
  const n = typeof mcap === "string" ? parseFloat(String(mcap).replace(/,/g, "")) : Number(mcap);
  return Number.isFinite(n) ? n : null;
}

/**
 * Get BSE market cap via nse-bse-api listSecurities (ListofScripData returns Mktcap).
 * Use this instead of ComHeadernew when company header fails; fully nse-bse-api.
 * Tries group "A" first; if no row, retries with relaxed group so scripts in other groups get mcap.
 */
export async function getBseMarketCapFromApi(scripCode: string): Promise<number | null> {
  if (!scripCode?.trim()) return null;
  const bse = getBSE();
  const code = scripCode.trim();
  const attempts: { group: string }[] = [{ group: "A" }, { group: "" }];
  for (const opts of attempts) {
    try {
      const data = await bse.listSecurities({
        scripcode: code,
        segment: "Equity",
        status: "Active",
        group: opts.group,
      });
      const raw = Array.isArray(data) ? data : [];
      const first = raw[0] as unknown as Record<string, unknown> | undefined;
      if (!first) continue;
      const mcap = readMcapFromRow(first);
      if (mcap != null) return mcap;
    } catch {
      // continue to next attempt or return null
    }
  }
  return null;
}

/** Normalized BSE list security row (handles both nse-bse-api and raw BSE API shapes) */
export interface BseListSecurityRow {
  scripcode: string;
  symbol: string;
  companyname: string;
  isin: string;
  group?: string;
}

function toListSecurityRow(row: Record<string, unknown>): BseListSecurityRow {
  const scripcode = String(row.scripcode ?? row.SCRIP_CD ?? "").trim();
  const symbol = String(row.scrip_id ?? row.scripcode ?? row.SCRIP_CD ?? "").trim();
  const companyname = String(row.companyname ?? row.Scrip_Name ?? row.Issuer_Name ?? "").trim();
  const isin = String(row.ISIN_NUMBER ?? row.isin ?? "").trim();
  const group = row.group != null ? String(row.group) : row.GROUP != null ? String(row.GROUP) : undefined;
  return { scripcode, symbol, companyname, isin, group };
}

/**
 * Get BSE list of securities via nse-bse-api (ListofScripData).
 * Use for single scrip (scripcode) or full list (omit scripcode, pass segment/status).
 */
export async function getBseListSecuritiesFromApi(options?: {
  scripcode?: string;
  segment?: string;
  status?: string;
  group?: string;
}): Promise<BseListSecurityRow[]> {
  try {
    const bse = getBSE();
    const data = await bse.listSecurities({
      scripcode: options?.scripcode ?? "",
      segment: (options?.segment as "Equity" | undefined) ?? "Equity",
      status: (options?.status as "Active" | undefined) ?? "Active",
      group: options?.group ?? "A",
    });
    const rawList = Array.isArray(data) ? data : [];
    return rawList.map((item) => toListSecurityRow((item as unknown) as Record<string, unknown> ?? {}));
  } catch {
    return [];
  }
}

/** BSE index row from nse-bse-api */
export interface BseIndexRow {
  indexname?: string;
  currentvalue?: number;
  change?: number;
  pchange?: number;
  high?: number;
  low?: number;
  open?: number;
  previousclose?: number;
  [key: string]: unknown;
}

/**
 * Get BSE index names/list via nse-bse-api (fetchIndexNames returns Record<string, IndexData[]>)
 */
export async function getBseIndicesFromApi(): Promise<Record<string, BseIndexRow[]>> {
  try {
    const bse = getBSE();
    const data = await bse.fetchIndexNames();
    return (data ?? {}) as Record<string, BseIndexRow[]>;
  } catch {
    return {};
  }
}

/**
 * Get BSE indices data for a given date via nse-bse-api
 */
export async function getBseIndicesByDateFromApi(date: Date): Promise<Record<string, BseIndexRow[]>> {
  try {
    const bse = getBSE();
    const data = await bse.fetchAllIndicesDataByDate(date);
    return (data ?? {}) as Record<string, BseIndexRow[]>;
  } catch {
    return {};
  }
}

/** BSE near 52-week API returns { highs?: array, lows?: array } */
export interface BseNear52WeekResult {
  highs?: unknown[];
  lows?: unknown[];
}

/**
 * Get BSE stocks near 52-week high/low via nse-bse-api (same as nse-bse-mcp bse_near_52week).
 * Options: by = "group" (e.g. name "A") or "index" (e.g. name "S&P BSE SENSEX").
 */
export async function getBseNear52WeekFromApi(options?: {
  by?: "group" | "index";
  name?: string;
}): Promise<BseNear52WeekResult> {
  try {
    const bse = getBSE();
    const data = (await bse.near52WeekHighLow(options)) as BseNear52WeekResult;
    return {
      highs: Array.isArray(data?.highs) ? data.highs : [],
      lows: Array.isArray(data?.lows) ? data.lows : [],
    };
  } catch {
    return { highs: [], lows: [] };
  }
}

// --- NSE extended (nse-bse-api) ---

/**
 * Get NSE market status via nse-bse-api
 */
export async function getNseMarketStatusFromApi(): Promise<unknown[] | null> {
  try {
    const nse = getNSE();
    const data = await nse.status();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** NSE bulk deal row (raw from nse-bse-api); normalize to app shape in routes */
export interface NseBulkDealRow {
  symbol?: string;
  securityName?: string;
  clientName?: string;
  dealType?: string;
  quantity?: number;
  price?: number;
  date?: string;
  [key: string]: unknown;
}

/**
 * Get NSE bulk deals for date range via nse-bse-api (historical/bulk-deals).
 * Use as fallback when BSE Python service is down. Max 1 year range.
 */
export async function getNseBulkDealsFromApi(
  fromDate: Date,
  toDate: Date
): Promise<NseBulkDealRow[]> {
  try {
    const nse = getNSE();
    const data = await nse.bulkdeals(fromDate, toDate);
    return Array.isArray(data) ? (data as NseBulkDealRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Get NSE symbol lookup via nse-bse-api
 */
export async function getNseLookupFromApi(query: string): Promise<Record<string, unknown> | null> {
  if (!query?.trim()) return null;
  try {
    const nse = getNSE();
    const data = await nse.lookup(query);
    return data ?? null;
  } catch {
    return null;
  }
}

/** NSE historical params for fetch_equity_historical_data */
export interface NseHistoricalParams {
  symbol: string;
  from_date?: Date;
  to_date?: Date;
  series?: string[];
}

/**
 * Get NSE equity historical data via nse-bse-api
 */
export async function getNseHistoricalFromApi(params: NseHistoricalParams): Promise<Record<string, unknown>[]> {
  if (!params?.symbol?.trim()) return [];
  try {
    const nse = getNSE();
    const data = await nse.fetch_equity_historical_data(params as any);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Get NSE option chain via nse-bse-api
 */
export async function getNseOptionChainFromApi(symbol: string): Promise<unknown | null> {
  if (!symbol?.trim()) return null;
  try {
    const nse = getNSE();
    const data = await nse.optionChain(symbol);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Get NSE expiry dates (V3) for option chain - call this before optionChainV3/compileOptionChainV3
 */
export async function getNseExpiryDatesV3(symbol: string): Promise<string[]> {
  if (!symbol?.trim()) return [];
  try {
    const nse = getNSE();
    const data = await nse.getExpiryDatesV3(symbol.toUpperCase());
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Get NSE option chain V3 (with optional expiry) via nse-bse-api
 */
export async function getNseOptionChainV3FromApi(params: {
  symbol: string;
  type?: "Indices" | "Equity";
  expiry?: string;
}): Promise<unknown | null> {
  if (!params?.symbol?.trim()) return null;
  try {
    const nse = getNSE();
    const data = await nse.optionChainV3({
      symbol: params.symbol.toUpperCase(),
      type: params.type,
      expiry: params.expiry,
    });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Get NSE compiled option chain (ATM, max pain, PCR, OI) via nse-bse-api V3
 */
export async function getNseCompiledOptionChainFromApi(
  symbol: string,
  expiry: string
): Promise<unknown | null> {
  if (!symbol?.trim() || !expiry?.trim()) return null;
  try {
    const nse = getNSE();
    const data = await nse.compileOptionChainV3(symbol.toUpperCase(), expiry);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Calculate max pain strike from NSE option chain V3 (nse-bse-api)
 */
export async function getNseMaxPainFromApi(
  symbol: string,
  expiry: string
): Promise<number | null> {
  if (!symbol?.trim() || !expiry?.trim()) return null;
  try {
    const nse = getNSE();
    const chain = await nse.optionChainV3({ symbol: symbol.toUpperCase(), expiry });
    if (!chain) return null;
    return NSE.maxpainV3(chain as any, expiry);
  } catch {
    return null;
  }
}

function toIpoArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown }).data))
    return (data as { data: unknown[] }).data;
  return [];
}

/**
 * Get NSE current IPOs via nse-bse-api (ipo-current-issue). Data from nse-bse-api only.
 */
export async function getNseIpoListCurrentFromApi(): Promise<unknown[]> {
  try {
    const nse = getNSE();
    const data = await nse.listCurrentIPO();
    return toIpoArray(data);
  } catch {
    return [];
  }
}

/**
 * Get NSE upcoming IPOs via nse-bse-api (all-upcoming-issues?category=ipo). Data from nse-bse-api only.
 */
export async function getNseIpoListUpcomingFromApi(): Promise<unknown[]> {
  try {
    const nse = getNSE();
    const data = await nse.listUpcomingIPO();
    return toIpoArray(data);
  } catch {
    return [];
  }
}

/**
 * Get NSE corporate actions via nse-bse-api
 */
export async function getNseCorporateActionsFromApi(params?: Record<string, unknown>): Promise<unknown[]> {
  try {
    const nse = getNSE();
    const data = await nse.actions(params ?? {});
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Get NSE gainers from index (e.g. NIFTY 50) via nse-bse-api. Fetches index constituents and filters by pChange > 0.
 */
export async function getNseGainersFromApi(indexName?: string, count?: number): Promise<unknown[]> {
  try {
    const nse = getNSE();
    const data = await nse.listEquityStocksByIndex(indexName ?? "NIFTY 50");
    const list = (data as { data?: { pChange?: number }[] })?.data;
    if (!Array.isArray(list)) return [];
    const sorted = list.filter((d) => (d.pChange ?? 0) > 0).sort((a, b) => (b.pChange ?? 0) - (a.pChange ?? 0));
    return typeof count === "number" ? sorted.slice(0, count) : sorted;
  } catch {
    return [];
  }
}

/**
 * Get NSE losers from index via nse-bse-api
 */
export async function getNseLosersFromApi(indexName?: string, count?: number): Promise<unknown[]> {
  try {
    const nse = getNSE();
    const data = await nse.listEquityStocksByIndex(indexName ?? "NIFTY 50");
    const list = (data as { data?: { pChange?: number }[] })?.data;
    if (!Array.isArray(list)) return [];
    const sorted = list.filter((d) => (d.pChange ?? 0) < 0).sort((a, b) => (a.pChange ?? 0) - (b.pChange ?? 0));
    return typeof count === "number" ? sorted.slice(0, count) : sorted;
  } catch {
    return [];
  }
}

/**
 * Get NSE indices list via nse-bse-api
 */
export async function getNseIndicesFromApi(): Promise<unknown> {
  try {
    const nse = getNSE();
    const data = await nse.listIndices();
    return data ?? null;
  } catch {
    return null;
  }
}

