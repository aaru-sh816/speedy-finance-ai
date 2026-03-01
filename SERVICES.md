# Why services might not be working

The app depends on **two kinds** of backends. If something doesn’t load (quotes, bulk deals, company data, etc.), check the following.

---

## 1. BSE Python service (quotes, bulk deals, company fallback)

Many features call a **separate BSE service** that must be running on your machine (or at the URL you set).

- **What it provides:** Live quotes, gainers/losers, bulk deals, company quote fallback, health.
- **Default URL:** `http://localhost:5000`
- **How to run it:**
  ```bash
  cd speedy-finance-ai/python-services
  pip install -r requirements.txt
  python bse_service.py
  ```
  The service listens on **port 5000**. See `python-services/README.md` for details.

- **If it’s not running:**  
  Quote widgets, bulk-deals data, and some company-page data will fail or show errors. Announcements, corporate actions, and result calendar can still work via direct BSE/NSE APIs or the nse-bse-api package.

- **Override URL:** Set in `.env.local`:
  ```env
  BSE_SERVICE_URL=http://localhost:5000
  ```
  (Use a different host/port if your BSE service runs elsewhere.)

**Check that it’s up:**
```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/quote/500325
```

---

## 2. Next.js dev server

The UI and all `/api/*` routes run inside the Next.js app.

- **Run:** From `speedy-finance-ai`: `npm run dev` (default port 3000).
- **If it’s not running:** You can’t open the app or use any API routes.

---

## 3. Optional: Voice / Personaplex

`run_server.bat` in the repo root starts only the **Personaplex/Moshi voice server** (port 8998). It does **not** start the BSE service or the Next.js app. For quotes and bulk deals you must start the BSE Python service separately (see above).

---

## 4. Optional: AI (OpenAI, etc.)

For AI chat, summaries, voice, and sentiment you need the right env vars (e.g. `OPENAI_API_KEY`). If they’re missing, AI features show an error; the rest of the app still works. See `README_DEPLOYMENT.md` for a full list.

---

## Quick checklist

| Symptom | Check |
|--------|--------|
| Quotes / company data / bulk deals don’t load | BSE Python service running on port 5000? `BSE_SERVICE_URL` set if not using 5000? |
| App doesn’t open | Next.js: `npm run dev` in `speedy-finance-ai` |
| AI chat/summary fails | `OPENAI_API_KEY` (and optional model/env) in `.env.local` |
| Voice features don’t work | Personaplex server (e.g. `run_server.bat`) and correct config |

All BSE-service fallbacks in the codebase use **port 5000** by default so that running `python bse_service.py` is enough when `BSE_SERVICE_URL` is not set.
