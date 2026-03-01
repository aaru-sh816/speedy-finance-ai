# Limitations and reliability

## If “services” don’t work

The app expects a **BSE Python service** on port 5000 for quotes, bulk deals, and some company data. If you see missing data or errors there:

1. Start the BSE service: `cd speedy-finance-ai/python-services && python bse_service.py`
2. Optionally set `BSE_SERVICE_URL=http://localhost:5000` in `.env.local` (5000 is the default in code).

See **SERVICES.md** for what each service does and how to run and verify them.

## External dependencies

The app depends on external services. Outages or rate limits can cause errors or empty data:

- **BSE / NSE (or your data provider)** – announcements, quotes, corporate actions, market movers, company data.
- **Optional AI providers** (e.g. OpenAI) – summaries, chat, voice, sentiment. These are best-effort; failures show an error state and do not block the rest of the app.

## Timeouts

To avoid the UI hanging, critical fetches use timeouts:

| Context | Timeout | Notes |
|--------|---------|--------|
| Search modal – announcements | 18 s | Timeout or abort on tab/modal change |
| Search modal – corporate actions | 15 s | Timeout or abort on tab/modal change |
| Announcements page – list | 20 s | Abort on navigation |
| Announcements page – quote | 10 s | |
| Company page – company + corporate actions | 20 s / 15 s | Abort on route change |
| Company page – quote | 10 s | |
| Market page – market movers / advance-decline / near-52week | 15 s each | Each request can fail independently; partial data is shown |
| Indices page | 20 s | |
| Result calendar page | 20 s | |
| Corporate actions page | 20 s | |
| API routes (BSE fetcher) | 15 s | Outbound BSE requests from `lib/bse/fetcher` |

If a request exceeds the timeout, the user sees an error state (e.g. "Couldn't load announcements") and can retry or refresh.

## What "zero errors" means

- **No unhandled runtime errors** in normal use: critical fetch paths have timeout and error handling; loading states always resolve to success, error, or empty.
- **Third-party failures** (BSE, NSE, OpenAI, etc.) can still occur and are outside the app's control. The app surfaces them as errors and retry options instead of hanging.
