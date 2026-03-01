/**
 * FinEdge API client for Speedy Finance AI.
 * @see https://www.finedgeapi.com/financial-data-api-documentation
 */

export {
  getStockSymbols,
  getCompanyProfile,
  stockSearch,
  getFinancials,
  getBasicFinancials,
  getRatios,
  getQuote,
  getDailyQuotes,
  getDailyPriceRatios,
  getAnnualPriceRatios,
  getPeers,
  getShareholdingPattern,
  getShareholdingSummary,
  getCorporateActionsAll,
  getCorporateActionByType,
  getDividend,
  getCorpAnnouncements,
  getResultsCalendar,
  getIndexMaster,
  getIndexDailyFeed,
  getIndexPriceReturns,
  getIndexValuationHistory,
  getCreditRatings,
  getHolidaysCalendar,
  getSegmentRevenue,
  getShareholdingBeneficialOwners,
  FinEdgeError,
} from "./client"

export type {
  StatementType,
  StatementCode,
  Period,
  RatioType,
} from "./client"

export {
  getSymbolMap,
  getReverseSymbolMap,
  resolveNseSymbol,
  resolveBseScripCode,
} from "./symbol-map"

export type {
  FinEdgeStockSymbol,
  FinEdgeCompanyProfile,
  FinEdgeFinancialRow,
  FinEdgeFinancialsResponse,
  FinEdgeBasicFinancialRow,
  FinEdgeBasicFinancialsResponse,
  FinEdgeRatioRow,
  FinEdgeRatiosResponse,
  FinEdgeQuoteItem,
  FinEdgeQuoteResponse,
  FinEdgePeersResponse,
  FinEdgeShareholdingRow,
  FinEdgeShareholdingPatternResponse,
  FinEdgeCorporateAction,
  FinEdgeDividendItem,
  FinEdgeDividendResponse,
  FinEdgeCorpAnnouncement,
  FinEdgeResultsCalendarItem,
  FinEdgeIndexRow,
  FinEdgeIndexMasterRow,
  FinEdgeIndexPriceReturnsRow,
} from "./types"
