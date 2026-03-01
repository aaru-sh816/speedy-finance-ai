# UI & API Verification Checklist

Use this checklist to confirm all BSE/nse-bse-api features are fully functional after fixes.

## 1. Result calendar
- **API:** `GET /api/bse/result-calendar` or `?fromDate=&toDate=`
- **Expected:** `{ results: [...], count: N, meta: { source: "nse-bse-api" } }` with N ≥ 0
- **UI:** Open **http://localhost:3000/result-calendar**
- **Check:** List shows "Upcoming corporate results (next 30 days). Source: nse-bse-api." and company rows with scrip code and result date (or "No results" if empty)

## 2. Corporate actions
- **API:** `GET /api/bse/corporate-actions?days=90`
- **Expected:** `{ actions: [...], count: N, purposeCodes: {...}, meta: { source: "nse-bse-api" } }`. Default 90 days; supports both array and BSE `Table` response
- **UI:** Open **http://localhost:3000/corporate-actions**
- **Check:** Table shows COMPANY, PURPOSE, EX-DATE, RECORD, DETAILS (e.g. dividends, bonus). Filters: Scrip Code, All Types; refresh button works

## 3. Announcements
- **API:** `GET /api/bse/announcements`
- **Expected:** `{ announcements: [...], meta: { count, source: "nse-bse-api" } }`
- **UI:** Open **http://localhost:3000/announcements**
- **Check:** Ticker bar with live prices; list of announcements (LIVE/SAVED/RECENT); select one to see details

## 4. BSE quote (single) – price, 52-week, marketCap, volume
- **API:** `GET /api/bse/quote?symbol=500325`
- **Expected:** `{ symbol, price, change, changePercent, volume, dayHigh, dayLow, previousClose, fiftyTwoWeekHigh, fiftyTwoWeekLow, marketCap, source: "nse-bse-api" }`. 52-week from nse-bse-api; marketCap/volume from company header or Python if configured
- **UI:** Company page and any component using this API
- **Check:** Company page shows price, 52W range bar, MCap (if available), volume (if available)

## 5. Enhanced quote (market depth fallback)
- **API:** `GET /api/bse/enhanced-quote?scripCode=500325`
- **Expected:** When Python is down: `{ success: true, data: { ..., weekHigh52, weekLow52, marketCapFull, buy: {}, sell: {} }, source: "nse-bse-api" }`. When Python is up: full quote + buy/sell depth
- **UI:** Company page → expand "Live Market Depth"
- **Check:** If depth loads: bid/ask table. If not: message "Depth requires BSE Python service (BSE_SERVICE_URL). Quote and 52W range use nse-bse-api."

## 6. BSE search & lookup
- **API:** `GET /api/bse/search?q=reliance` → `{ results: [...], count, source: "bse-list" }`; `GET /api/lookup?q=reliance` → `{ results: [...] }`
- **UI:** Search modal (Ctrl+K), command palette, announcements symbol search
- **Check:** Typing a company name returns BSE scrip results

## 7. BSE history
- **API:** `GET /api/bse/history?scripCode=500325&days=30`
- **Expected:** `{ data: [{ date, open, high, low, close, volume }, ...] }`. Symbol resolution via nse-bse-api (no direct BSE URL)
- **UI:** Company page chart; watchlist
- **Check:** Chart loads for a BSE scrip code

## 8. BSE company page
- **API:** `GET /api/bse/company/:scripCode`
- **Expected:** `{ scripCode, symbol, companyName, announcements, ... }`. Single direct BSE call: ComHeadernew (company header) only
- **UI:** Open **http://localhost:3000/company/500325**
- **Check:** Header shows company name; quote (price, 52W, MCap if available); announcements and corporate actions tabs; chart. Loading stops within 15s even if one request is slow

## 9. Company page loading
- **Fix applied:** Loading timeout 15s so "LOADING TERMINAL" does not block indefinitely; after 15s the page shows with whatever data is available or error state

## 10. NSE quote
- **API:** `GET /api/bse/quote?symbol=RELIANCE` (non-numeric symbol)
- **Expected:** NSE path returns price, etc., with `source: "nse"` or `"nse-bse-api"`

---

## Quick test script (with dev server running)

```powershell
# Result calendar
(Invoke-WebRequest -Uri "http://localhost:3000/api/bse/result-calendar" -UseBasicParsing).Content | ConvertFrom-Json | Select count

# Corporate actions (90 days)
(Invoke-WebRequest -Uri "http://localhost:3000/api/bse/corporate-actions?days=90" -UseBasicParsing).Content | ConvertFrom-Json | Select -ExpandProperty count

# BSE quote with 52-week
(Invoke-WebRequest -Uri "http://localhost:3000/api/bse/quote?symbol=500325" -UseBasicParsing).Content | ConvertFrom-Json | Select price, fiftyTwoWeekHigh, fiftyTwoWeekLow, marketCap, source
```

## Summary of fixes applied

| Area | Fix |
|------|-----|
| Corporate actions | Normalize BSE `Table` and array; default 90 days on page; API returns 69+ actions |
| Quote (BSE) | 52-week from `getBse52WeekFromApi`; marketCap/volume from company header or Python fallback |
| Enhanced quote | nse-bse-api fallback when Python down (quote + 52W + marketCap; depth empty with message) |
| Market depth UI | Message when depth unavailable: "Depth requires BSE Python service..." |
| Company page | 15s loading timeout so page never sticks on "LOADING TERMINAL" |

All BSE data flows through **nse-bse-api** (unified-market) except **ComHeadernew** in `lib/bse/company-header.ts`.
