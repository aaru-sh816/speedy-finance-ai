/**
 * Portfolio Integration - Storage (localStorage for Phase 1 MVP)
 * Single portfolio per user; extend to multi-portfolio + server later
 */

import type { PortfolioMeta, Trade, Holding } from "./types"

const PORTFOLIO_STORAGE_KEY = "speedy-portfolio-v1"
const TRADES_STORAGE_KEY = "speedy-portfolio-trades-v1"
const SNAPSHOTS_STORAGE_KEY = "speedy-portfolio-snapshots-v1"

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

export function getPortfolio(): PortfolioMeta | null {
  if (!isBrowser()) return null
  try {
    const data = localStorage.getItem(PORTFOLIO_STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function savePortfolio(portfolio: PortfolioMeta): void {
  if (!isBrowser()) return
  const updated = { ...portfolio, updatedAt: new Date().toISOString() }
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent("portfolio-updated", { detail: updated }))
}

export function createPortfolio(name: string, source: "manual" | "csv" = "manual"): PortfolioMeta {
  const now = new Date().toISOString()
  const portfolio: PortfolioMeta = {
    id: crypto.randomUUID(),
    name,
    baseCurrency: "INR",
    source,
    createdAt: now,
    updatedAt: now,
  }
  savePortfolio(portfolio)
  return portfolio
}

export function updatePortfolio(updates: Partial<Omit<PortfolioMeta, "id" | "createdAt">>): PortfolioMeta | null {
  const current = getPortfolio()
  if (!current) return null
  const updated = { ...current, ...updates }
  savePortfolio(updated)
  return updated
}

export function getTrades(): Trade[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(TRADES_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveTrades(trades: Trade[]): void {
  if (!isBrowser()) return
  localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades))
  window.dispatchEvent(new CustomEvent("portfolio-trades-updated", { detail: trades }))
}

export function addTrade(trade: Omit<Trade, "id" | "createdAt">): Trade {
  const current = getTrades()
  const newTrade: Trade = {
    ...trade,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const updated = [...current, newTrade].sort((a, b) => a.date.localeCompare(b.date))
  saveTrades(updated)
  return newTrade
}

export function removeTrade(id: string): Trade[] {
  const current = getTrades()
  const updated = current.filter((t) => t.id !== id)
  saveTrades(updated)
  return updated
}

export function getHoldings(): Holding[] {
  const trades = getTrades()
  return computeHoldingsFromTrades(trades)
}

/**
 * Derive holdings from trades using FIFO
 */
function computeHoldingsFromTrades(trades: Trade[]): Holding[] {
  const byScrip: Record<string, { buys: { date: string; qty: number; price: number }[]; sells: number }> = {}

  for (const t of trades.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!byScrip[t.scripCode]) {
      byScrip[t.scripCode] = { buys: [], sells: 0 }
    }
    const entry = byScrip[t.scripCode]
    if (t.type === "BUY") {
      entry.buys.push({ date: t.date, qty: t.quantity, price: t.price })
    } else {
      let remaining = t.quantity
      while (remaining > 0 && entry.buys.length > 0) {
        const lot = entry.buys[0]
        const consume = Math.min(lot.qty, remaining)
        lot.qty -= consume
        remaining -= consume
        if (lot.qty <= 0) entry.buys.shift()
      }
      entry.sells += t.quantity
    }
  }

  const holdings: Holding[] = []
  for (const [scripCode, data] of Object.entries(byScrip)) {
    let totalQty = 0
    let totalCost = 0
    const lots: { date: string; quantity: number; avgPrice: number }[] = []
    for (const b of data.buys) {
      if (b.qty > 0) {
        totalQty += b.qty
        totalCost += b.qty * b.price
        lots.push({ date: b.date, quantity: b.qty, avgPrice: b.price })
      }
    }
    if (totalQty > 0) {
      const t = trades.find((x) => x.scripCode === scripCode)
      holdings.push({
        scripCode,
        symbol: t?.symbol ?? scripCode,
        name: t?.name ?? scripCode,
        quantity: totalQty,
        avgPrice: totalCost / totalQty,
        lots: lots.map((l) => ({
          date: l.date,
          quantity: l.quantity,
          avgPrice: l.avgPrice,
        })),
      })
    }
  }
  return holdings
}

export function addHoldingAsManual(
  scripCode: string,
  symbol: string,
  name: string,
  quantity: number,
  avgPrice: number,
  date?: string
): void {
  const d = date ?? new Date().toISOString().split("T")[0]
  addTrade({
    scripCode,
    symbol,
    name,
    type: "BUY",
    date: d,
    quantity,
    price: avgPrice,
  })
}

export function getSnapshots(): { portfolioId: string; date: string; totalInvested: number; totalValue: number }[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(SNAPSHOTS_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveSnapshot(
  portfolioId: string,
  date: string,
  totalInvested: number,
  totalValue: number
): void {
  const current = getSnapshots()
  const filtered = current.filter((s) => !(s.portfolioId === portfolioId && s.date === date))
  filtered.push({ portfolioId, date, totalInvested, totalValue })
  filtered.sort((a, b) => b.date.localeCompare(a.date))
  localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 365)))
}
