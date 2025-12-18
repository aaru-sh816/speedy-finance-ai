// BSE Announcement types matching the actual BSE API response shape

export type BSERawAnnouncement = {
  NEWSID: string
  NEWS_DT: string
  DT_TM: string
  SLONGNAME: string
  SCRIP_CD: string
  NSURL?: string
  HEADLINE: string
  NEWSSUB: string
  ATTACHMENTNAME?: string
  MORE?: string
  CATEGORYNAME?: string
  SUBCATNAME?: string
  CRITICALNEWS?: string
  // Additional fields from BSE API
  XML_NAME?: string
  ANNOUNCEMENT_TYPE?: string
  QUARTER_ID?: string
  FILESTATUS?: string
  OLD?: number
  RN?: number
  PDFFLAG?: number
  AGENDA_ID?: number
  TotalPageCnt?: number
  News_submission_dt?: string
  DissemDT?: string
  TimeDiff?: string
  Fld_Attachsize?: number
  AUDIO_VIDEO_FILE?: string
}

export type BSEAnnouncementCategory =
  | "General"
  | "Acquisition"
  | "Board Meeting"
  | "Analyst/Investor Meet"
  | "Outcome"
  | "Financial Results"
  | "AGM/EGM"
  | "Dividend"
  | "Bonus"
  | "Stock Split"
  | "Rights Issue"
  | "Buyback"
  | "Insider Trading"
  | "Change in Directors"
  | "Credit Rating"
  | "Other"

export type BSEImpact = "high" | "medium" | "low"

export type BSEAnnouncement = {
  id: string
  ticker: string
  scripCode: string
  company: string
  headline: string
  summary: string
  category: string
  subCategory: string
  impact: BSEImpact
  time: string // ISO string
  pdfUrl: string | null
  source: "BSE"
  tags: string[]
  isCritical: boolean
  // Additional fields for enhanced UI
  bseUrl?: string // Direct link to BSE stock page
  nsUrl?: string // NSE URL if available
  announcementType?: string
  pdfSize?: number // File size in bytes
  disseminationTime?: string // When it was disseminated
  submissionTime?: string // When it was submitted
}

// Impact scoring based on category/subcategory
export const CATEGORY_IMPACT: Record<string, BSEImpact> = {
  // High impact
  "Acquisition": "high",
  "Financial Results": "high",
  "Outcome::Financial Results": "high",
  "Buyback": "high",
  "Bonus": "high",
  "Stock Split": "high",
  "Rights Issue": "high",
  "Dividend": "high",
  "Credit Rating": "high",
  "Insider Trading": "high",
  
  // Medium impact
  "Board Meeting": "medium",
  "Outcome::Board Meeting Outcome": "medium",
  "AGM/EGM": "medium",
  "Analyst/Investor Meet": "medium",
  "Change in Directors": "medium",
  
  // Low impact (default)
  "General": "low",
  "Other": "low",
}

// High-impact keywords for text analysis
export const HIGH_IMPACT_KEYWORDS = [
  "acquisition", "merger", "takeover", "buyback", "bonus", "dividend",
  "split", "rights issue", "financial results", "quarterly results",
  "annual results", "profit", "loss", "revenue", "earnings", "guidance",
  "outlook", "forecast", "upgrade", "downgrade", "rating", "default",
  "bankruptcy", "restructuring", "delisting", "ipo", "fpo", "qip",
  "preferential", "warrant", "debenture", "ncds", "fund raise"
]

export const MEDIUM_IMPACT_KEYWORDS = [
  "board meeting", "agm", "egm", "record date", "ex-date", "trading window",
  "insider", "promoter", "shareholding", "pledge", "compliance", "sebi",
  "regulation", "intimation", "disclosure", "announcement"
]

export function deriveImpact(category: string, subCategory: string, headline: string): BSEImpact {
  const catKey = subCategory ? `${category}::${subCategory}` : category
  
  // Check category mapping first
  if (CATEGORY_IMPACT[catKey]) return CATEGORY_IMPACT[catKey]
  if (CATEGORY_IMPACT[category]) return CATEGORY_IMPACT[category]
  
  // Text analysis fallback
  const text = headline.toLowerCase()
  if (HIGH_IMPACT_KEYWORDS.some(kw => text.includes(kw))) return "high"
  if (MEDIUM_IMPACT_KEYWORDS.some(kw => text.includes(kw))) return "medium"
  
  return "low"
}

export function deriveTags(category: string, subCategory: string, headline: string): string[] {
  const tags: string[] = []
  const text = headline.toLowerCase()
  
  // Category-based tags
  if (category) tags.push(category.toLowerCase().replace(/\s+/g, "-"))
  if (subCategory && subCategory !== category) {
    tags.push(subCategory.toLowerCase().replace(/\s+/g, "-"))
  }
  
  // Keyword-based tags
  const allKeywords = [...HIGH_IMPACT_KEYWORDS, ...MEDIUM_IMPACT_KEYWORDS]
  for (const kw of allKeywords) {
    if (text.includes(kw) && !tags.includes(kw.replace(/\s+/g, "-"))) {
      tags.push(kw.replace(/\s+/g, "-"))
    }
  }
  
  return tags.slice(0, 8) // Limit to 8 tags
}

/**
 * Generate BSE stock page URL
 */
function generateBSEUrl(company: string, ticker: string, scripCode: string): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  return `https://www.bseindia.com/stock-share-price/${slug}/${ticker.toLowerCase()}/${scripCode}/`
}

/**
 * Extract ticker from company name or NSURL
 */
function extractTicker(raw: BSERawAnnouncement): string {
  // Try to extract from NSURL first (most reliable)
  if (raw.NSURL) {
    const parts = raw.NSURL.replace(/\/$/, '').split('/')
    if (parts.length >= 2) {
      const ticker = parts[parts.length - 2]
      if (ticker && /^[a-zA-Z0-9]+$/.test(ticker)) {
        return ticker.toUpperCase()
      }
    }
  }
  
  // Fallback to first word of company name
  const firstWord = raw.SLONGNAME?.split(" ")[0]?.toUpperCase()
  if (firstWord && firstWord.length <= 20) {
    return firstWord.replace(/[^A-Z0-9]/g, '')
  }
  
  return raw.SCRIP_CD
}

export function normalizeBSEAnnouncement(raw: BSERawAnnouncement): BSEAnnouncement {
  const category = raw.CATEGORYNAME || "General"
  const subCategory = raw.SUBCATNAME || ""
  const headline = raw.HEADLINE || raw.NEWSSUB || ""
  const ticker = extractTicker(raw)
  const company = raw.SLONGNAME || ""

  /**
   * Parse BSE timestamp to ISO string.
   * BSE provides times in IST (UTC+5:30). We parse and store as UTC ISO.
   * Supported formats:
   *   - DD-MM-YYYY HH:MM:SS (e.g., "29-11-2025 23:01:59")
   *   - DD Mon YYYY HH:MM AM/PM (e.g., "29 Nov 2025 11:01 PM")
   *   - ISO/JS parseable strings
   */
  function parseBSETime(value?: string): string {
    if (!value) return new Date().toISOString()
    
    // Try JS native parse first (handles ISO and many formats)
    const d1 = new Date(value)
    if (!isNaN(d1.getTime())) {
      // If it parsed but looks like a date-only or ambiguous, skip
      // Otherwise return if it seems valid
      return d1.toISOString()
    }
    
    // Format: DD-MM-YYYY HH:MM:SS (BSE DissemDT format, IST)
    const ddmmyyyyMatch = value.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10)
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1 // 0-indexed
      const year = parseInt(ddmmyyyyMatch[3], 10)
      const hour = parseInt(ddmmyyyyMatch[4], 10)
      const minute = parseInt(ddmmyyyyMatch[5], 10)
      const second = parseInt(ddmmyyyyMatch[6] || '0', 10)
      // Time is in IST, convert to UTC by subtracting 5:30
      const istDate = new Date(year, month, day, hour, minute, second)
      const utcMs = istDate.getTime() - (5 * 60 + 30) * 60 * 1000
      return new Date(utcMs).toISOString()
    }
    
    // Format: DD Mon YYYY HH:MM AM/PM (older BSE format)
    const monthNameMatch = value.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
    if (monthNameMatch) {
      const day = parseInt(monthNameMatch[1], 10)
      const monStr = monthNameMatch[2].toLowerCase()
      const year = parseInt(monthNameMatch[3], 10)
      let hour = parseInt(monthNameMatch[4], 10)
      const minute = parseInt(monthNameMatch[5], 10)
      const second = parseInt(monthNameMatch[6] || '0', 10)
      const ampm = (monthNameMatch[7] || '').toUpperCase()
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      const month = months.indexOf(monStr)
      if (month === -1) return new Date().toISOString()
      if (ampm === 'PM' && hour < 12) hour += 12
      if (ampm === 'AM' && hour === 12) hour = 0
      // Time is in IST, convert to UTC
      const istDate = new Date(year, month, day, hour, minute, second)
      const utcMs = istDate.getTime() - (5 * 60 + 30) * 60 * 1000
      return new Date(utcMs).toISOString()
    }
    
    return new Date().toISOString()
  }

  const when = parseBSETime(raw.DissemDT || raw.DT_TM || raw.NEWS_DT)
  
  return {
    id: raw.NEWSID,
    ticker,
    scripCode: raw.SCRIP_CD,
    company,
    headline: raw.HEADLINE || "",
    summary: raw.NEWSSUB || raw.HEADLINE || "",
    category,
    subCategory,
    impact: deriveImpact(category, subCategory, headline),
    time: when,
    pdfUrl: raw.ATTACHMENTNAME
      ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${raw.ATTACHMENTNAME}`
      : null,
    source: "BSE",
    tags: deriveTags(category, subCategory, headline),
    isCritical: raw.CRITICALNEWS === "Y",
    // Enhanced fields
    bseUrl: generateBSEUrl(company, ticker, raw.SCRIP_CD),
    nsUrl: raw.NSURL || undefined,
    announcementType: raw.ANNOUNCEMENT_TYPE,
    pdfSize: raw.Fld_Attachsize,
    disseminationTime: raw.DissemDT,
    submissionTime: raw.News_submission_dt,
  }
}
