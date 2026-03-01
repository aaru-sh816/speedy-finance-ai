# Portfolio Integration Strategy: Broker, CAS, Contract Notes

This document outlines the strategy for Phase 2+ portfolio integrations: broker APIs, CAS (NSDL/CDSL) import, and contract note extraction.

---

## 1. Contract Note / Statement Upload (Phase 2 – P1)

### Overview
- User uploads PDF or CSV of contract notes / holdings statement.
- Backend extraction service (similar to `BSE_SERVICE_URL` pattern) parses and reconstructs trades.
- Normalize to canonical `Trade` model and store.

### Implementation approach
- **PDF extraction**: Reuse/extend existing `BSE_SERVICE_URL` Python service or add `pdf-extract` microservice.
- **Supported formats**: Zerodha, Groww, Angel One, ICICI Direct, Upstox, etc.
- **Column mapping UI**: Detect columns (symbol, qty, price, date) with one-click presets per broker.
- **File**: `POST /api/portfolio/import` with multipart/form-data; response: parsed trades + preview.

### Data flow
1. User uploads PDF/CSV.
2. Backend calls extraction service (or uses in-app parser for known CSV formats).
3. Map broker-specific columns to `Trade` schema.
4. Validate symbols via `/api/lookup` (resolve scripCode for BSE).
5. Store trades via `addTrade()` and return summary.

---

## 2. Broker API Integration (Phase 3 – P2)

### Regulatory context
- SEBI regulates third-party access to broker data.
- Options: Zerodha Kite Connect, Upstox, Angel One APIs, or aggregators (Smallcase, Finbox).
- Each broker has its own auth (OAuth2) and rate limits.

### Suggested order
1. **Zerodha Kite Connect** – Widely used; has Connect API for holdings/orders.
2. **Upstox** – Open API for equity holdings.
3. **Angel One (SmartAPI)** – Similar Connect pattern.
4. **Groww** – Limited public API; may require reverse-engineering or partnership.

### Integration pattern
- OAuth2 flow: redirect to broker → callback with tokens.
- Store encrypted tokens in user session (or server DB when auth exists).
- Periodic sync: fetch holdings/orders; map to `Holding`/`Trade`; reconcile with local state.
- Dedupe: use `broker + orderId` as unique key to avoid duplicate trades.

### Security
- Never store passwords; use OAuth tokens only.
- Tokens encrypted at rest; short-lived refresh flow.
- Clear user consent and audit trail for data access.

---

## 3. CAS (NSDL/CDSL) Import (Phase 3 – P2)

### Overview
- CAS (Consolidated Account Statement) is the official statement from depositories (NSDL/CDSL).
- Contains: demat holdings, MF units, corporate action credits.
- PDF format; structured but varies by depository.

### Implementation approach
- **PDF parsing**: Dedicated parser for NSDL and CDSL CAS PDFs.
- **Data extracted**: ISIN, quantity, collateral type, etc.
- **Mapping**: ISIN → BSE scripCode / NSE symbol via lookup table.
- **MF/ETF**: Extend `Holding` model for instrument type (equity, MF, ETF).

### Data flow
1. User uploads CAS PDF.
2. Backend parses sections (Equity, MF, etc.).
3. For each line: resolve ISIN → security metadata; create/update `Holding`.
4. CAS is point-in-time; treat as snapshot, not trade history. Optionally backfill trades if we have prior CAS.

---

## 4. Aggregators (Finbox, Smallcase, etc.)

### Overview
- Third-party aggregators provide unified holdings across multiple brokers.
- Pros: Single integration, multiple brokers.
- Cons: Dependency, cost, compliance.

### When to consider
- If direct broker integrations are too heavy.
- If we need MF, bonds, etc. in addition to equity.

---

## 5. Rebalancing Engine (Phase 2)

### Overview
- User defines target allocation (e.g. large-cap 60%, mid-cap 25%, small-cap 15%; max 10% per stock).
- Engine computes current vs target; suggests buy/sell orders (non-execution).
- AI explains each suggestion in plain language.

### Implementation
- **Rules-based**: Compare current weights to targets; generate trade list.
- **AI layer**: Call `/api/ai/research` or dedicated `/api/ai/rebalance` with context (holdings, targets, constraints).
- **Output**: List of suggested trades with rationale.

---

## 6. Timeline and Dependencies

| Phase | Feature                         | Dependencies                    |
|-------|---------------------------------|---------------------------------|
| 2     | Contract note PDF/CSV import    | Extraction service, column mapping |
| 2     | Rebalancing suggestions         | Sector/mcap metadata, AI API    |
| 3     | Zerodha Kite Connect            | OAuth flow, token storage       |
| 3     | CAS import                      | CAS PDF parser, ISIN mapping    |
| 3     | Tax reports (STCG/LTCG)         | Trade history, FIFO lots        |
