/**
 * Portfolio Integration - Computation engine
 * Real-time metrics, allocation, risk flags
 */

import type { Holding, HoldingWithQuote, PortfolioMetrics } from "./types"

export function computePortfolioMetrics(
  holdings: Holding[],
  quotes: Record<string, { price: number }>
): PortfolioMetrics {
  let totalInvested = 0
  let currentValue = 0
  let earliestDate: string | null = null

  for (const h of holdings) {
    const invested = h.quantity * h.avgPrice
    totalInvested += invested
    const ltp = quotes[h.scripCode]?.price ?? quotes[h.symbol]?.price
    if (ltp != null) {
      currentValue += h.quantity * ltp
    } else {
      currentValue += invested
    }
    if (h.lots?.length) {
      const d = h.lots.reduce((a, l) => (l.date < a ? l.date : a), h.lots[0].date)
      if (!earliestDate || d < earliestDate) earliestDate = d
    }
  }

  const pnl = currentValue - totalInvested
  const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0
  let cagr: number | undefined
  let holdingDays: number | undefined
  if (earliestDate) {
    holdingDays = Math.floor((Date.now() - new Date(earliestDate).getTime()) / 86400000)
    if (holdingDays >= 365 && totalInvested > 0 && currentValue > 0) {
      const years = holdingDays / 365
      cagr = (Math.pow(currentValue / totalInvested, 1 / years) - 1) * 100
    }
  }

  return {
    totalInvested,
    currentValue,
    pnl,
    pnlPercent,
    holdingDays,
    cagr,
  }
}

export function enrichHoldingsWithQuotes(
  holdings: Holding[],
  quotes: Record<string, { price: number }>
): HoldingWithQuote[] {
  const totalInvested = holdings.reduce((s, h) => s + h.quantity * h.avgPrice, 0)
  const enriched: HoldingWithQuote[] = []

  for (const h of holdings) {
    const ltp = quotes[h.scripCode]?.price ?? quotes[h.symbol]?.price ?? h.avgPrice
    const currentValue = h.quantity * ltp
    const invested = h.quantity * h.avgPrice
    const pnl = currentValue - invested
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0
    const totalValue = holdings.reduce(
      (s, x) => s + x.quantity * (quotes[x.scripCode]?.price ?? quotes[x.symbol]?.price ?? x.avgPrice),
      0
    )
    const allocationPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0

    enriched.push({
      ...h,
      ltp,
      currentValue,
      pnl,
      pnlPercent,
      allocationPercent,
    })
  }

  return enriched
}

export function getSectorAllocation(
  holdings: HoldingWithQuote[],
  sectorMap: Record<string, string>
): Record<string, { value: number; percent: number }> {
  const bySector: Record<string, number> = {}
  let total = 0
  for (const h of holdings) {
    const sector = sectorMap[h.scripCode] ?? sectorMap[h.symbol] ?? "Unknown"
    bySector[sector] = (bySector[sector] ?? 0) + h.currentValue
    total += h.currentValue
  }
  const result: Record<string, { value: number; percent: number }> = {}
  for (const [sector, value] of Object.entries(bySector)) {
    result[sector] = { value, percent: total > 0 ? (value / total) * 100 : 0 }
  }
  return result
}

export function getConcentrationRisks(holdings: HoldingWithQuote[]): string[] {
  const risks: string[] = []
  const total = holdings.reduce((s, h) => s + h.currentValue, 0)
  if (total <= 0) return risks

  for (const h of holdings) {
    const pct = (h.currentValue / total) * 100
    if (pct >= 25) risks.push(`${h.symbol}: ${pct.toFixed(1)}% - High concentration`)
    else if (pct >= 15) risks.push(`${h.symbol}: ${pct.toFixed(1)}% - Moderate concentration`)
  }

  const sectorPct: Record<string, number> = {}
  for (const h of holdings) {
    const sector = "Equity"
    sectorPct[sector] = (sectorPct[sector] ?? 0) + h.currentValue
  }
  for (const [sector, val] of Object.entries(sectorPct)) {
    const pct = (val / total) * 100
    if (pct >= 80) risks.push(`${sector} allocation: ${pct.toFixed(1)}% - Consider diversifying`)
  }
  return risks
}
