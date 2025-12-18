import { getOrCreateCache } from "@/lib/infra/cache"
import { getOrCreateBucket } from "@/lib/infra/rateLimiter"
import { metrics } from "@/lib/infra/metrics"
import {
  type BSERawAnnouncement,
  type BSEAnnouncement,
  normalizeBSEAnnouncement,
} from "./types"
import { isBlacklisted, cleanSubject } from "./blacklist"

// BSE API endpoints (from BseIndiaApi library)
const BSE_API_URL = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
const BSE_BASE_URL = "https://www.bseindia.com/"

// Cache: 60 seconds for announcements list, 5 minutes for company-specific
const announcementsCache = getOrCreateCache<string, BSEAnnouncement[]>("bse-announcements", 100, 60_000)
const companyCache = getOrCreateCache<string, BSEAnnouncement[]>("bse-company", 500, 300_000)

// Rate limiter: 10 requests per second to BSE
const bseBucket = getOrCreateBucket("bse-api", 10, 10)

function jitter(ms: number) {
  return ms + Math.random() * ms * 0.2
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0
  let wait = 500

  while (true) {
    await bseBucket.consume(1)
    try {
      const start = performance.now?.() ?? Date.now()
      const res = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://www.bseindia.com/",
          ...options.headers,
        },
      })
      const end = performance.now?.() ?? Date.now()
      metrics().recordRequestSuccess(end - start)

      if (!res.ok && res.status >= 500 && attempt < retries) {
        attempt++
        await new Promise((r) => setTimeout(r, jitter(wait)))
        wait *= 2
        continue
      }
      if (!res.ok) {
        metrics().recordRequestFailure()
      }
      return res
    } catch (e) {
      metrics().recordError((e as Error).name || "BSEFetchError")
      if (attempt >= retries) throw e
      attempt++
      await new Promise((r) => setTimeout(r, jitter(wait)))
      wait *= 2
    }
  }
}

export type BSEAnnouncementsResponse = {
  Table: BSERawAnnouncement[]
  Table1?: Array<{ ROWCNT: number }>
}

// Format date as YYYYMMDD for BSE API
function formatDateForBSE(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

export async function fetchBSEAnnouncements(options?: {
  pageNo?: number
  fromDate?: Date
  toDate?: Date
  category?: string
  subcategory?: string
  scripCode?: string
}): Promise<{ announcements: BSEAnnouncement[]; totalCount: number }> {
  const {
    pageNo = 1,
    fromDate = new Date(),
    toDate = new Date(),
    category = "-1",
    subcategory = "-1",
    scripCode = "",
  } = options || {}

  const fromStr = formatDateForBSE(fromDate)
  const toStr = formatDateForBSE(toDate)

  // Build cache key
  const cacheKey = `page:${pageNo}:from:${fromStr}:to:${toStr}:cat:${category}:sub:${subcategory}:scrip:${scripCode}`
  
  const cached = announcementsCache.get(cacheKey)
  if (cached) {
    metrics().recordCacheHit()
    return { announcements: cached, totalCount: cached.length }
  }
  metrics().recordCacheMiss()

  // Build URL with query params (matching BseIndiaApi library format)
  const params = new URLSearchParams({
    pageno: pageNo.toString(),
    strCat: category,
    subcategory: subcategory,
    strPrevDate: fromStr,
    strToDate: toStr,
    strSearch: "P",
    strscrip: scripCode,
    strType: "C", // C = Equity
  })

  const url = `${BSE_API_URL}?${params.toString()}`

  try {
    const res = await fetchWithRetry(url, { method: "GET", cache: "no-store" })
    
    if (!res.ok) {
      metrics().recordError(`BSE_HTTP_${res.status}`)
      return { announcements: [], totalCount: 0 }
    }

    const data: BSEAnnouncementsResponse = await res.json()
    const rawAnnouncements = data.Table || []
    const totalCount = data.Table1?.[0]?.ROWCNT || rawAnnouncements.length

    // Normalize and filter blacklisted announcements
    const announcements = rawAnnouncements
      .map(normalizeBSEAnnouncement)
      .filter(ann => {
        // Apply blacklist filter (like news.py)
        if (isBlacklisted(ann.headline)) {
          console.log(`[BSE] Filtered blacklisted: ${ann.headline.substring(0, 50)}`)
          return false
        }
        return true
      })
      .map(ann => ({
        ...ann,
        // Clean subject like news.py
        headline: cleanSubject(ann.headline)
      }))
    
    // Cache the result
    announcementsCache.set(cacheKey, announcements)
    
    return { announcements, totalCount }
  } catch (e) {
    metrics().recordError("BSEFetchException")
    console.error("BSE fetch error:", e)
    return { announcements: [], totalCount: 0 }
  }
}

export async function fetchAllBSEAnnouncements(options?: {
  fromDate?: Date
  toDate?: Date
  category?: string
  maxPages?: number
}): Promise<BSEAnnouncement[]> {
  const { fromDate = new Date(), toDate = new Date(), category, maxPages = 50 } = options || {}
  
  const fromStr = formatDateForBSE(fromDate)
  const toStr = formatDateForBSE(toDate)
  const allCacheKey = `all:from:${fromStr}:to:${toStr}:cat:${category || "all"}`
  const cached = announcementsCache.get(allCacheKey)
  if (cached) {
    metrics().recordCacheHit()
    return cached
  }
  metrics().recordCacheMiss()

  const all: BSEAnnouncement[] = []
  let pageNo = 1
  let totalCount = Infinity

  while (all.length < totalCount && pageNo <= maxPages) {
    const { announcements, totalCount: count } = await fetchBSEAnnouncements({
      pageNo,
      fromDate,
      toDate,
      category,
    })

    if (pageNo === 1) {
      totalCount = count
    }

    if (announcements.length === 0) break

    all.push(...announcements)
    pageNo++

    // Small delay between pages
    await new Promise((r) => setTimeout(r, 100))
  }

  // Cache the full result
  announcementsCache.set(allCacheKey, all)
  metrics().recordBatch(all.length)

  return all
}

export async function fetchCompanyAnnouncements(
  scripCode: string,
  days = 30
): Promise<BSEAnnouncement[]> {
  const cacheKey = `company:${scripCode}:days:${days}`
  
  const cached = companyCache.get(cacheKey)
  if (cached) {
    metrics().recordCacheHit()
    return cached
  }
  metrics().recordCacheMiss()

  // Calculate date range
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const { announcements } = await fetchBSEAnnouncements({
    scripCode,
    fromDate,
    toDate,
  })

  companyCache.set(cacheKey, announcements)
  return announcements
}

// Get unique categories from announcements
export function extractCategories(announcements: BSEAnnouncement[]): string[] {
  return Array.from(new Set(announcements.map((a) => a.category))).sort()
}

// Get unique companies from announcements
export function extractCompanies(announcements: BSEAnnouncement[]): Array<{ ticker: string; company: string; scripCode: string }> {
  const map = new Map<string, { ticker: string; company: string; scripCode: string }>()
  for (const a of announcements) {
    if (!map.has(a.scripCode)) {
      map.set(a.scripCode, { ticker: a.ticker, company: a.company, scripCode: a.scripCode })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.company.localeCompare(b.company))
}
