import { getOrCreateCache } from "@/lib/infra/cache"
import { getOrCreateBucket } from "@/lib/infra/rateLimiter"
import { metrics } from "@/lib/infra/metrics"
import { getBseAnnouncementsFromApi } from "@/lib/nse-bse/unified-market"
import {
  type BSERawAnnouncement,
  type BSEAnnouncement,
  normalizeBSEAnnouncement,
} from "./types"
import { isBlacklisted, cleanSubject } from "./blacklist"

// Cache: 60 seconds for announcements list, 5 minutes for company-specific
const announcementsCache = getOrCreateCache<string, BSEAnnouncement[]>("bse-announcements", 100, 60_000)
const companyCache = getOrCreateCache<string, BSEAnnouncement[]>("bse-company", 500, 300_000)

// Rate limiter: 10 requests per second to BSE (nse-bse-api)
const bseBucket = getOrCreateBucket("bse-api", 10, 10)

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
  const cacheKey = `page:${pageNo}:from:${fromStr}:to:${toStr}:cat:${category}:sub:${subcategory}:scrip:${scripCode}`

  const cached = announcementsCache.get(cacheKey)
  if (cached) {
    metrics().recordCacheHit()
    return { announcements: cached, totalCount: cached.length }
  }
  metrics().recordCacheMiss()

  try {
    await bseBucket.consume(1)
    const start = performance.now?.() ?? Date.now()
    const raw = await getBseAnnouncementsFromApi({
      pageNo,
      fromDate,
      toDate,
      category,
      subcategory,
      scripcode: scripCode,
    })
    const end = performance.now?.() ?? Date.now()
    metrics().recordRequestSuccess(end - start)

    const table = raw && typeof raw === "object" && "Table" in raw && Array.isArray((raw as { Table?: unknown[] }).Table)
      ? (raw as { Table: BSERawAnnouncement[]; Table1?: Array<{ ROWCNT: number }> }).Table
      : []
    const totalCount = raw && typeof raw === "object" && "Table1" in raw && Array.isArray((raw as { Table1?: unknown[] }).Table1)
      ? (raw as { Table1: Array<{ ROWCNT: number }> }).Table1?.[0]?.ROWCNT ?? table.length
      : table.length

    const announcements = table
      .map(normalizeBSEAnnouncement)
      .filter(ann => !isBlacklisted(ann.headline))
      .map(ann => ({ ...ann, headline: cleanSubject(ann.headline) }))

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
  days = 365,
  maxPages = 10
): Promise<BSEAnnouncement[]> {
  const cacheKey = `company:${scripCode}:days:${days}:pages:${maxPages}`
  
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

  const all: BSEAnnouncement[] = []
  let pageNo = 1
  let totalCount = Infinity

  while (all.length < totalCount && pageNo <= maxPages) {
    const { announcements, totalCount: count } = await fetchBSEAnnouncements({
      scripCode,
      fromDate,
      toDate,
      pageNo,
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

  companyCache.set(cacheKey, all)
  return all
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
