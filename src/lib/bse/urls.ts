/**
 * BSE URL Helpers - Generate links to BSE India website
 */

/**
 * Generate BSE stock page URL
 * Format: https://www.bseindia.com/stock-share-price/company-name/ticker/scripcode/
 */
export function getBSEStockUrl(company: string, ticker: string, scripCode: string): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()

  return `https://www.bseindia.com/stock-share-price/${slug}/${ticker.toLowerCase()}/${scripCode}/`
}

/**
 * Generate BSE announcement PDF URL
 */
export function getBSEPdfUrl(attachmentName: string): string {
  if (!attachmentName) return ""
  if (attachmentName.startsWith("http")) return attachmentName
  return `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachmentName}`
}

/**
 * Generate BSE corporate filings page URL
 */
export function getBSEFilingsUrl(scripCode: string): string {
  return `https://www.bseindia.com/corporates/ann.html?scrip=${scripCode}&dur=A&dur=M`
}

/**
 * Generate BSE company overview URL
 */
export function getBSECompanyUrl(scripCode: string): string {
  return `https://www.bseindia.com/stock-share-price/x/x/${scripCode}/`
}

/**
 * Generate NSE stock page URL (for cross-reference)
 */
export function getNSEStockUrl(symbol: string): string {
  return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol.toUpperCase())}`
}

/**
 * Generate TradingView widget URL for embedding
 */
export function getTradingViewWidgetUrl(
  symbol: string,
  exchange: "BSE" | "NSE" = "BSE",
  interval: string = "D"
): string {
  return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${exchange}%3A${symbol}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&showpopupbutton=1&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&showpopupbutton=1&locale=en`
}

/**
 * Generate simple TradingView chart URL
 */
export function getTradingViewChartUrl(symbol: string, exchange: "BSE" | "NSE" = "BSE"): string {
  return `https://www.tradingview.com/chart/?symbol=${exchange}%3A${symbol}`
}

/**
 * Categories available from BSE API (from BseIndiaApi constants)
 */
export const BSE_CATEGORIES = {
  AGM: 'AGM/EGM',
  BOARD_MEETING: 'Board Meeting',
  UPDATE: 'Company Update',
  ACTION: 'Corp. Action',
  INSIDER: 'Insider Trading / SAST',
  NEW_LISTING: 'New Listing',
  RESULT: 'Result',
  OTHERS: 'Others',
} as const

/**
 * Purpose codes for corporate actions
 */
export const BSE_PURPOSE_CODES = {
  BONUS: 'P5',
  BUYBACK: 'P6',
  DIVIDEND: 'P9',
  PREFERENCE_DIVIDEND: 'P10',
  SPLIT: 'P26',
  DELISTING: 'P29',
} as const

/**
 * Market segments
 */
export const BSE_SEGMENTS = {
  EQUITY: 'Equity',
  MF: 'MF',
  PREFERENCE_SHARES: 'Preference Shares',
  DEBENTURES_BONDS: 'Debentures and Bonds',
} as const

/**
 * Detect if announcement is a Result announcement
 */
export function isResultAnnouncement(category: string, headline: string): boolean {
  const lowerCategory = category.toLowerCase()
  const lowerHeadline = headline.toLowerCase()
  
  return (
    lowerCategory.includes('result') ||
    lowerHeadline.includes('financial result') ||
    lowerHeadline.includes('quarterly result') ||
    lowerHeadline.includes('half yearly result') ||
    lowerHeadline.includes('annual result') ||
    lowerHeadline.includes('audited result') ||
    lowerHeadline.includes('unaudited result')
  )
}

/**
 * Detect if announcement is Board Meeting related
 */
export function isBoardMeetingAnnouncement(category: string, headline: string): boolean {
  const lowerCategory = category.toLowerCase()
  const lowerHeadline = headline.toLowerCase()
  
  return (
    lowerCategory.includes('board meeting') ||
    lowerHeadline.includes('board meeting') ||
    lowerHeadline.includes('outcome of board') ||
    lowerHeadline.includes('board of directors')
  )
}

/**
 * Detect announcement type for filtering
 */
export function detectAnnouncementType(category: string, headline: string): string {
  if (isResultAnnouncement(category, headline)) return 'Result'
  if (isBoardMeetingAnnouncement(category, headline)) return 'Board Meeting'
  
  const lowerHeadline = headline.toLowerCase()
  
  if (lowerHeadline.includes('dividend')) return 'Dividend'
  if (lowerHeadline.includes('acquisition') || lowerHeadline.includes('acquire')) return 'Acquisition'
  if (lowerHeadline.includes('order') || lowerHeadline.includes('contract')) return 'Order'
  if (lowerHeadline.includes('bonus')) return 'Bonus'
  if (lowerHeadline.includes('split')) return 'Split'
  if (lowerHeadline.includes('buyback')) return 'Buyback'
  if (lowerHeadline.includes('agm') || lowerHeadline.includes('egm')) return 'AGM/EGM'
  if (lowerHeadline.includes('subsidiary')) return 'Subsidiary'
  if (lowerHeadline.includes('partnership') || lowerHeadline.includes('agreement')) return 'Agreement'
  
  return category || 'General'
}
