/**
 * FinEdge API response types.
 * @see https://www.finedgeapi.com/financial-data-api-documentation
 */

export interface FinEdgeStockSymbol {
  bse_code: string
  consolidated_ind?: boolean
  name: string
  nse_code: string
  symbol: string
}

export interface FinEdgeCompanyProfile {
  bse_code: string
  description?: string
  industry?: string
  macro_sector?: string
  market_cap?: number
  name: string
  nse_code: string
  sector?: string
  sub_industry?: string
  symbol: string
  website?: string
}

export interface FinEdgeFinancialRow {
  [key: string]: string | number | undefined
  header?: string
  year?: number
  EPS?: number
  revenueFromOperations?: number
  profitLossForPeriod?: number
  profitBeforeTax?: number
  income?: number
  expenses?: number
}

export interface FinEdgeFinancialsResponse {
  financials: FinEdgeFinancialRow[]
  symbol: string
}

export interface FinEdgeBasicFinancialRow {
  [key: string]: string | number | undefined
  header?: string
  year?: number
  ebit?: number
  ebitda?: number
  grossIncome?: number
  operatingRevenue?: number
  operatingProfit?: number
  dilutedSharesOutstanding?: number
  salesPerShare?: number
}

export interface FinEdgeBasicFinancialsResponse {
  basic_financials: FinEdgeBasicFinancialRow[]
  symbol: string
}

export type FinEdgeRatioType = "pr" | "ef" | "li" | "le"

export interface FinEdgeRatioRow {
  header?: string
  year?: number
  returnOnEquity?: number
  returnOnAsset?: number
  returnOnCapital?: number
  grossMargin?: number
  netMargin?: number
  operatingMargin?: number
  ebitMargin?: number
  ebitdaMargin?: number
  dividendPayout?: number
  retentionRatio?: number
  [key: string]: string | number | undefined
}

export interface FinEdgeRatiosResponse {
  ratios: FinEdgeRatioRow[]
  symbol: string
}

export interface FinEdgeQuoteItem {
  change?: string
  high52?: number
  low52?: number
  market_cap?: number
  price?: number
  shares?: number
  tradetime?: string
  volume?: number
}

export type FinEdgeQuoteResponse = Record<string, FinEdgeQuoteItem>

export interface FinEdgePeersResponse {
  peers: string[]
}

export interface FinEdgeShareholdingRow {
  catagory?: string
  name: string
  data: Record<string, number>
  shareholders?: Array<{ name: string; data: Record<string, number> }>
}

export interface FinEdgeShareholdingPatternResponse {
  columns: string[]
  company_name: string
  rows: FinEdgeShareholdingRow[]
  status?: string
  stock_symbol: string
}

export interface FinEdgeCorporateAction {
  action?: string
  adj_amount?: number
  amount?: number
  dividend_type?: string
  ex_date?: string
  subject?: string
  symbol?: string
  timestamp_unix?: number
}

export interface FinEdgeDividendItem {
  adj_amount?: number
  amount?: number
  date?: string
  dividend_type?: string
  subject?: string
}

export interface FinEdgeDividendResponse {
  dividend: FinEdgeDividendItem[]
  symbol: string
}

export interface FinEdgeCorpAnnouncement {
  bse_code?: string
  category?: string
  description?: string
  ex_date?: string
  nse_code?: string
  pdf_file_link?: string
  pdf_file_link_hist?: string
  stock_symbol?: string
  sub_category?: string
  timestamp_unix?: number
}

export interface FinEdgeResultsCalendarItem {
  company_name: string
  expected_result_date?: string
  symbol: string
}

export interface FinEdgeIndexRow {
  change_pct?: number
  close_price?: number
  div_yield?: number
  high_price?: number
  index_name?: string
  index_symbol?: string
  low_price?: number
  market_cap?: number
  open_price?: number
  pb?: number
  pe?: number
  points_change?: number
  turnover?: number
  volume?: number
}

export interface FinEdgeIndexMasterRow {
  constituents?: string[]
  description?: string
  exchange?: string
  index_name?: string
  index_sub_type?: string
  index_symbol?: string
  index_type?: string
  market_cap?: number
  rebalance_frequency?: string
}

export interface FinEdgeIndexPriceReturnsRow {
  "1M"?: number
  "3M"?: number
  "6M"?: number
  "1Y"?: number
  "3Y"?: number
  "5Y"?: number
  "7Y"?: number
  "10Y"?: number
  dates?: Record<string, string>
  index_name?: string
  index_symbol?: string
  last_date?: string
}
