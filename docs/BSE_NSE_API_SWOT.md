# SWOT: BSE / NSE Data & UI (nse-bse-api Migration)

## Strengths
- **Single BSE data layer**: All BSE flows go through `unified-market.ts` (nse-bse-api). One code path, no “try direct then fallback”.
- **Result calendar, announcements, search, history, company (scrip/lookup/announcements), lookup API, quote (BSE + NSE)** are integrated and working.
- **Only one direct BSE URL** left: ComHeadernew in `company-header.ts` (documented). Everything else uses nse-bse-api.
- **Corporate actions** now support both array and `{ Table: [...] }` response and default to 90 days for more results.
- **Quote** enriched with **52-week high/low** (nse-bse-api `quoteWeeklyHL`) and **marketCap** (company header) for BSE.
- **Enhanced-quote** has an **nse-bse-api fallback** when Python is down: quote + 52-week + marketCap; market depth stays empty with an explanatory message.

## Weaknesses
- **Live market depth** depends on **BSE Python service** (BSE_SERVICE_URL). If it’s down, depth is empty; we show a short message and still return quote/52W/marketCap via nse-bse-api.
- **Volume** for BSE quote is not filled by nse-bse-api (getScripHeaderData in the package only returns LTP, PrevClose, Open, High, Low). Volume would require package or API change.
- **Bulk quotes** (`/api/bse/quotes/bulk`) for BSE do not yet merge 52-week or marketCap (single-quote and enhanced-quote do). Bulk could be extended later to call the same enrichment per symbol.
- **Corporate actions** can still be empty if BSE has no actions in the requested window; we only improved parsing and default 90-day range.

## Opportunities
- Add **volume** to BSE quote if nse-bse-api or BSE API starts exposing it (e.g. from getScripHeaderData or another endpoint).
- Optionally add **market depth** to nse-bse-api if BSE provides a depth API, then remove Python dependency for depth.
- Enrich **bulk quote** responses with 52-week and marketCap for BSE (e.g. parallel getBse52WeekFromApi + fetchBseCompanyHeader per symbol, or internal call to single quote route).
- Run **sanity tests** (result-calendar, corporate-actions, announcements, quote, company) in CI.

## Threats
- **BSE API** rate limits or blocking: all BSE data (except ComHeadernew) goes through nse-bse-api; throttling is in the package.
- **Python service** unavailability: enhanced-quote and live depth degrade; we now fall back to nse-bse-api for quote/52W/marketCap and show a clear depth message.

---

## Areas That Were Broken / Empty and Fixes Applied

| Area | Issue | Fix |
|------|--------|-----|
| **Corporate actions** | Empty list; possible wrong response shape or short window | Normalize both array and `{ Table: [...] }` in `getBseCorporateActionsFromApi`; map BSE field names (Ex_date, Purpose, etc.). Default **90 days** on the page. |
| **Live market depth** | Empty when Python service down | Enhanced-quote uses **nse-bse-api fallback** (quote + 52-week + marketCap); depth shows message: "Depth requires BSE Python service (BSE_SERVICE_URL). Quote and 52W range use nse-bse-api." |
| **Market cap** | Not shown for BSE | **Quote route** and **enhanced-quote** now add marketCap from `fetchBseCompanyHeader(scripCode)` for BSE symbols. |
| **52-week range** | Not shown for BSE | **Quote route** and **enhanced-quote** now add fiftyTwoWeekHigh / fiftyTwoWeekLow from `getBse52WeekFromApi` (nse-bse-api `quoteWeeklyHL`). |
| **Volume** | Not shown for BSE | nse-bse-api `quote()` only returns OHLC; volume not available from current package. Left as null; can be added if the package or BSE API exposes it. |

---

## Summary

- **Corporate actions**: Parsing and default 90-day range fixed; empty is still possible if BSE has no data.
- **Market depth**: Works when Python is up; when down, we show a clear message and still return quote + 52W + marketCap.
- **Market cap & 52-week**: Now populated for BSE from company header and nse-bse-api HighLow/w in single quote and enhanced-quote.
- **Volume**: Still not available for BSE from current nse-bse-api; would need package or API support.
