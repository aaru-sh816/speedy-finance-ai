import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

// Cache the database in memory after first load
let cachedDatabase: { deals: any[]; metadata: any } | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 3600_000 // 1 hour

function normalizeDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return normalizeDate(d)
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

async function loadDatabase() {
  const now = Date.now()
  
  // Return cached if still valid
  if (cachedDatabase && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedDatabase
  }
  
  const projectRoot = process.cwd()
  const dbPath = path.join(projectRoot, "python-services", "data", "bulk-deals", "bulk_deals_database.json")
  const metaPath = path.join(projectRoot, "python-services", "data", "bulk-deals", "database_metadata.json")
  
  try {
    const [dbFile, metaFile] = await Promise.all([
      fs.readFile(dbPath, "utf-8"),
      fs.readFile(metaPath, "utf-8").catch(() => "{}"),
    ])
    
    const database = JSON.parse(dbFile)
    const metadata = JSON.parse(metaFile)
    
    cachedDatabase = { deals: database.deals || [], metadata }
    cacheTimestamp = now
    
    console.log(`[BulkDealsHistory] Loaded ${cachedDatabase.deals.length.toLocaleString()} deals from database`)
    return cachedDatabase
  } catch (err: any) {
    console.error("[BulkDealsHistory] Failed to load database:", err.message)
    return { deals: [], metadata: {} }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startParam = searchParams.get("start")
    const endParam = searchParams.get("end")
    const daysParam = searchParams.get("days")
    const exchangeParam = (searchParams.get("exchange") || "both").toLowerCase()

    const today = normalizeDate(new Date())

    let endDate = parseDateParam(endParam) || today
    let startDate = parseDateParam(startParam)

    // Allow up to 13 years of data (since 2012)
    const maxWindowDays = 365 * 13

    if (!startDate) {
      const days = Math.min(
        Math.max(parseInt(daysParam || "7", 10) || 7, 1),
        maxWindowDays,
      )
      startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    }

    if (startDate > endDate) {
      const tmp = startDate
      startDate = endDate
      endDate = tmp
    }

    // Load database (cached)
    const { deals, metadata } = await loadDatabase()
    
    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)
    
    // Filter deals by date range and exchange
    const filteredDeals = deals.filter((deal: any) => {
      const dealDate = deal.date || deal.deal_date || ""
      if (dealDate < startStr || dealDate > endStr) return false
      
      if (exchangeParam !== "both") {
        const ex = (deal.exchange || "bse").toLowerCase()
        if (ex !== exchangeParam) return false
      }
      
      return true
    })

    // Sort most recent deals first
    filteredDeals.sort((a: any, b: any) => {
      const aDate = a.date || a.deal_date || ""
      const bDate = b.date || b.deal_date || ""
      return bDate.localeCompare(aDate)
    })

    return NextResponse.json({
      success: true,
      start: startStr,
      end: endStr,
      count: filteredDeals.length,
      totalInDatabase: deals.length,
      data: filteredDeals,
      metadata: {
        dateRange: metadata.date_range,
        totalDeals: metadata.total_deals,
        lastUpdated: metadata.last_updated,
      },
    })
  } catch (error: any) {
    console.error("Bulk deals history API error", error)
    return NextResponse.json(
      {
        error: "Failed to load bulk deals history",
        message: error?.message,
      },
      { status: 500 },
    )
  }
}
