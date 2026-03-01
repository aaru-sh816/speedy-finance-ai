/**
 * Portfolio Integration - Data Model
 * World-class portfolio data model for Speedy Finance AI
 * India-first: NSE/BSE scripCode + symbol mapping, corporate-actions aware
 */

export type TradeType = "BUY" | "SELL"

export type PortfolioSource = "manual" | "csv" | "broker" | "contract_note"

export interface SecurityRef {
  /** BSE scrip code (primary for equity) */
  scripCode: string
  /** NSE symbol */
  symbol: string
  /** Company name */
  name: string
  /** ISIN for MF/ETF (optional) */
  isin?: string
}

export interface TaxLot {
  /** Purchase date (YYYY-MM-DD) */
  date: string
  /** Quantity in this lot */
  quantity: number
  /** Average price per unit */
  avgPrice: number
  /** Holding period days (for LTCG/STCG) */
  holdingDays?: number
  /** Realized P&L if sold */
  realizedPnl?: number
}

export interface Trade {
  id: string
  /** Security identifier */
  scripCode: string
  symbol: string
  name: string
  type: TradeType
  date: string
  quantity: number
  price: number
  /** Brokerage, STT, etc. */
  charges?: number
  /** Optional broker/account label */
  broker?: string
  accountId?: string
  createdAt: string
}

export interface Holding {
  scripCode: string
  symbol: string
  name: string
  quantity: number
  avgPrice: number
  /** FIFO lots for tax computation */
  lots: TaxLot[]
  /** Tags for categorization */
  tags?: string[]
  /** Source of this holding */
  source?: PortfolioSource
}

export interface PortfolioMeta {
  id: string
  name: string
  /** Base currency (INR) */
  baseCurrency: string
  /** User-defined objective/benchmark */
  objective?: string
  benchmark?: string
  /** Source of portfolio data */
  source: PortfolioSource
  /** Creation timestamp */
  createdAt: string
  updatedAt: string
}

export interface PortfolioSnapshot {
  portfolioId: string
  date: string
  totalInvested: number
  totalValue: number
  pnl: number
  pnlPercent: number
  /** Per-holding breakdown (optional, for chart drill-down) */
  holdingsValue?: Record<string, number>
}

export interface PortfolioMetrics {
  totalInvested: number
  currentValue: number
  pnl: number
  pnlPercent: number
  /** Days since first trade (for CAGR) */
  holdingDays?: number
  /** Annualized return if holding > 1 year */
  cagr?: number
}

export interface HoldingWithQuote extends Holding {
  ltp?: number
  currentValue: number
  pnl: number
  pnlPercent: number
  allocationPercent: number
}
