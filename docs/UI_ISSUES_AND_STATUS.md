# UI Issues Detection – What’s Working vs Not Working

**Last updated:** After full nse-bse-api shift. Everything that can run on nse-bse-api does; only **live market depth** still requires BSE Python (no public BSE order-book API).

---

## 1. **Company page (`/company/[scripCode]`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Error state** | **Working** | Error banner shown when `fetchCompanyData` fails. |
| **Market cap** | **Working** | From `getBseMarketCapFromApi` (listSecurities) + ComHeadernew fallback; no Python required. |
| **Volume** | **Partial** | Shown when BSE getScripHeaderData returns volume-like fields; nse-bse-api passes them through. Otherwise "—" unless Python used. |
| **52-week range** | **Working** | `getBse52WeekFromApi` (nse-bse-api). |
| **Live market depth** | **Partial** | **Requires BSE Python.** When down, message: "Depth requires BSE Python service (BSE_SERVICE_URL). Quote and 52W use nse-bse-api." |
| **15s loading timeout** | **Working** | Prevents infinite loading. |
| **Corporate actions tab** | **Working** | Past 90 days + next 30 days via `pastDays=90&days=30`; dedicated error banner when API fails. |

---

## 2. **Market page (`/market`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Error when fetch fails** | **Working** | User-visible `fetchError` shown. |
| **Gainers / losers / advance-decline / near 52-week** | **Working** | nse-bse-api first, then Python, then NSE index fallback for gainers/losers. |

---

## 3. **Result calendar (`/result-calendar`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Data & error display** | **Working** | `getBseResultCalendarFromApi`; error state rendered. |

---

## 4. **Corporate actions (`/corporate-actions`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Data load** | **Working** | nse-bse-api; 90-day default. |
| **Error display** | **Working** | Dedicated error message on fetch failure. |

---

## 5. **Announcements (`/announcements`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Data, error, bulk quotes** | **Working** | nse-bse-api. |
| **Market cap in cards** | **Working** | Bulk quote now returns marketCap (and 52-week) from nse-bse-api. |
| **Date range filter** | **Working** | fromDate/toDate sent to API; auto-swap in modal and API if from > to. |
| **Market hours only** | **Working** | BSE cash 09:15–15:30 IST via `isWithinMarketHoursIST()`. |

---

## 6. **Indices (`/indices`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **Data & error** | **Working** | nse-bse-api first; Python fallback. |

---

## 7. **Bulk deals**

| Issue | Status | Notes |
|-------|--------|--------|
| **Fetch today** | **Working** | When Python fails, returns **NSE bulk deals** for today via `getNseBulkDealsFromApi`. |
| **History** | **Working** | When DB is empty, **NSE bulk deals** for requested range used as fallback. |
| **Yesterday movers** | **Working** | When Python fails, uses **NSE bulk deals** for yesterday + app quote API for LTP. |

---

## 8. **FeyEnhancedQuote**

| Issue | Status | Notes |
|-------|--------|--------|
| **Quote, 52W, marketCap, volume** | **Working** | nse-bse-api fallback uses `getBseMarketCapFromApi` (listSecurities) and quote volume when present. |

---

## 9. **Market depth component**

| Issue | Status | Notes |
|-------|--------|--------|
| **When Python is up** | **Working** | Live depth from Python. |
| **When Python is down** | **Partial** | **No BSE public API for order book.** UI shows: "Depth requires BSE Python service (BSE_SERVICE_URL). Quote and 52W range use nse-bse-api." |

---

## 10. **Quotes bulk (`/api/bse/quotes/bulk`)**

| Issue | Status | Notes |
|-------|--------|--------|
| **BSE symbols** | **Working** | getBseQuoteFromApi. |
| **marketCap / 52-week in bulk** | **Working** | Per-symbol `getBse52WeekFromApi` + `getBseMarketCapFromApi`; response includes `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `marketCap`. |

---

## Summary: What is still partial

1. **Live market depth:** Only when BSE Python service is running; **no nse-bse-api alternative** (BSE does not expose public order-book API).
2. **Volume (BSE):** Shown when BSE getScripHeaderData includes volume-like fields; otherwise "—" unless Python is used.

Everything else is **fully functional** on nse-bse-api (with NSE fallback for bulk deals when Python is down).

---

## Fixes applied (nse-bse-api shift)

- **Market cap:** `getBseMarketCapFromApi(scripCode)` via listSecurities (ListofScripData); used in quote, enhanced-quote, bulk quote. ComHeadernew remains optional fallback.
- **Volume:** BSE.quote() in nse-bse-api passes through header volume fields (TotalTradedQty, etc.); unified-market maps to `volume`.
- **Bulk quote:** Adds `getBse52WeekFromApi` + `getBseMarketCapFromApi` per BSE symbol; response includes `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `marketCap`.
- **Corporate actions:** API supports `pastDays` (default 90 when scripCode present); company page shows past 90 days + next 30 days; dedicated error banner on company page when corporate-actions API fails.
- **Announcements:** Date range validated (modal and API auto-swap if fromDate > toDate); "Market hours only" uses BSE 09:15–15:30 IST via `isWithinMarketHoursIST()`.
- **Indices:** nse-bse-api first, Python fallback. **Market movers:** nse-bse-api first, then Python, then NSE index fallback.
- **Bulk deals:** NSE fallback everywhere: history (when DB empty), yesterday-movers (when Python fails), fetch-today (returns NSE deals for today when Python fails). Quotes for NSE fallback via app’s own `/api/bse/quote`.
- **Company page:** Error banner when `error` is set (already done earlier).
- **Market page:** User-visible error when `fetchMarketMovers` fails (already done earlier).
- **Enhanced-quote:** Fallback uses `getBseMarketCapFromApi` and quote volume.
