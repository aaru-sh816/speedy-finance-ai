import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface NSEDeal {
  date: string
  symbol: string
  name: string
  clientName: string | null
  buySell: string | null
  qty: string
  watp: string | null
  remarks: string | null
}

interface BSEDeal {
  deal_date?: string
  date?: string
  scrip_code?: string
  scripCode?: string
  security_name?: string
  securityName?: string
  client_name?: string
  clientName?: string
  deal_type?: string
  type?: string
  quantity?: number
  trade_price?: number
  price?: number
  exchange?: string
}

// Fetch from local Python BSE service database (when running locally)
async function fetchBSEDatabaseDeals(startDate?: string, endDate?: string): Promise<BSEDeal[]> {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"
  try {
    // Try the database endpoint first (has 2 years of historical data)
    let url = `${bseServiceUrl}/api/bulk-deals/database`
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`
    }
    
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    
    if (!res.ok) {
      console.log(`[BulkDeals] BSE database returned ${res.status}`)
      return []
    }
    
    const data = await res.json()
    const raw: any[] = data.data || []
    const onlyBse = raw.filter((d: any) => String(d.exchange || "").toUpperCase() === "BSE")
    console.log(`[BulkDeals] Got ${onlyBse.length} deals from BSE database`)
    return onlyBse as any
  } catch (error) {
    // BSE service not running - this is expected in production
    console.log("[BulkDeals] BSE database not available")
    return []
  }
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Fetch from local Python BSE service (when running locally)
async function fetchBSEBulkDeals(date?: string): Promise<BSEDeal[]> {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"
  try {
    const url = date 
      ? `${bseServiceUrl}/api/bulk-deals?date=${date}&exchange=bse`
      : `${bseServiceUrl}/api/bulk-deals?exchange=bse`
    
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    
    if (!res.ok) {
      console.log(`[BulkDeals] BSE service returned ${res.status}`)
      return []
    }
    
    const data = await res.json()
    return data.data || []
  } catch (error) {
    // BSE service not running - this is expected in production
    console.log("[BulkDeals] BSE service not available, using NSE only")
    return []
  }
}

function parseBSEDeals(deals: BSEDeal[]): any[] {
  return deals.map(deal => {
    const rawType = (deal.deal_type || deal.type || "").toString().toUpperCase()
    const side = rawType === "BUY" || rawType === "B" || rawType === "P" ? "BUY" : "SELL"
    
    return {
      date: deal.deal_date || deal.date || "",
      scripCode: deal.scrip_code || deal.scripCode || "",
      securityName: deal.security_name || deal.securityName || "",
      clientName: deal.client_name || deal.clientName || "",
      side,
      quantity: deal.quantity != null ? Number(deal.quantity) : null,
      price: deal.trade_price != null ? Number(deal.trade_price) : (deal.price != null ? Number(deal.price) : null),
      type: "bulk",
      exchange: "BSE",
    }
  })
}

async function fetchNSEBulkDeals(): Promise<{ bulkDeals: NSEDeal[], blockDeals: NSEDeal[] }> {
  try {
    // First get cookies by visiting the main page
    const mainRes = await fetch("https://www.nseindia.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    })
    
    const cookies = mainRes.headers.get("set-cookie") || ""
    
    // Now fetch the bulk deals API
    const res = await fetch("https://www.nseindia.com/api/snapshot-capital-market-largedeal", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/market-data/bulk-deal",
        "Cookie": cookies,
      },
      cache: "no-store",
    })
    
    if (!res.ok) {
      console.error(`NSE API error: ${res.status}`)
      return { bulkDeals: [], blockDeals: [] }
    }
    
    const data = await res.json()
    return {
      bulkDeals: data.BULK_DEALS_DATA || [],
      blockDeals: data.BLOCK_DEALS_DATA || [],
    }
  } catch (error) {
    console.error("Failed to fetch NSE bulk deals:", error)
    return { bulkDeals: [], blockDeals: [] }
  }
}

function parseNSEDeals(deals: NSEDeal[], type: string): any[] {
  return deals.map(deal => {
    const side = (deal.buySell || "").toUpperCase()
    return {
      date: deal.date || "",
      scripCode: deal.symbol || "",
      securityName: deal.name || "",
      clientName: deal.clientName || "",
      side: side === "BUY" || side === "B" ? "BUY" : side === "SELL" || side === "S" ? "SELL" : side,
      quantity: deal.qty ? Number(String(deal.qty).replace(/[,\s]/g, "")) : null,
      price: deal.watp ? Number(String(deal.watp).replace(/[,\s]/g, "")) : null,
      type,
      exchange: "NSE",
      remarks: deal.remarks || "",
    }
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") || undefined
  const live = searchParams.get("live") === "1"
  const intraday = (searchParams.get("intraday") || "all").toLowerCase() as "all" | "only" | "exclude"
  const groupBy = (searchParams.get("groupBy") || "").toLowerCase() as "" | "person" | "company"

  try {
    const day = date || formatDate(new Date())
    const [nseData, bseDatabaseDeals] = await Promise.all([
      fetchNSEBulkDeals(),
      fetchBSEDatabaseDeals(day, day),
    ])
    
    const { bulkDeals, blockDeals } = nseData

    // Parse and combine all deals from all sources
    const parsedNSEBulk = parseNSEDeals(bulkDeals, "bulk")
    const parsedNSEBlock = parseNSEDeals(blockDeals, "block")
    const parsedBSEDatabase = parseBSEDeals(bseDatabaseDeals)

    // Optional: only when explicitly requested, fetch live BSE data
    const parsedBSELive = live ? parseBSEDeals(await fetchBSEBulkDeals(date)) : []
    
    // Merge all deals, deduplicating by unique key (NSE + BSE database + optional BSE live)
    const dealsMap = new Map<string, any>()
    // Add database deals first (historical)
    for (const d of parsedBSEDatabase) {
      const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}|${d.exchange}`
      dealsMap.set(key, d)
    }
    // Add live deals (overwrites duplicates with fresher data)
    for (const d of [...parsedNSEBulk, ...parsedNSEBlock, ...parsedBSELive]) {
      const key = `${d.date}|${d.scripCode}|${d.clientName}|${d.side}|${d.exchange}`
      dealsMap.set(key, d)
    }
    const results = Array.from(dealsMap.values())

    // Mark intraday: same date+scrip+client with both BUY and SELL
    const sideMap = new Map<string, Set<string>>()
    for (const r of results) {
      const key = `${String(r.date).slice(0,10)}|${r.scripCode}|${(r.clientName||'').toUpperCase()}`
      if (!sideMap.has(key)) sideMap.set(key, new Set())
      sideMap.get(key)!.add((r.side||'').toUpperCase())
    }
    const isIntraday = (r: any) => {
      const key = `${String(r.date).slice(0,10)}|${r.scripCode}|${(r.clientName||'').toUpperCase()}`
      const s = sideMap.get(key)
      return !!(s && s.has('BUY') && s.has('SELL'))
    }

    let filtered = results
    if (intraday === 'only') filtered = results.filter(isIntraday)
    if (intraday === 'exclude') filtered = results.filter(r => !isIntraday(r))

    // Sort by date desc
    filtered.sort((a, b) => {
      const dateA = new Date(a.date.split('-').reverse().join('-')).getTime()
      const dateB = new Date(b.date.split('-').reverse().join('-')).getTime()
      return dateB - dateA
    })

    let groups: any[] | undefined = undefined
    if (groupBy) {
      const map = new Map<string, any>()
      for (const r of filtered) {
        const key = groupBy === 'person'
          ? `${(r.clientName||'').toUpperCase()}|${r.scripCode}`
          : `${(r.securityName||'').toUpperCase()}|${r.scripCode}`
        const val = (r.quantity ?? 0) * (r.price ?? 0)
        const qtySigned = ((r.side||'').toUpperCase() === 'SELL' ? -1 : 1) * (r.quantity ?? 0)
        if (!map.has(key)) {
          map.set(key, {
            scripCode: r.scripCode,
            securityName: r.securityName,
            clientName: r.clientName,
            totalQuantity: 0,
            totalValue: 0,
            netQuantity: 0,
            firstDate: r.date,
            lastDate: r.date,
            tradesCount: 0,
          })
        }
        const g = map.get(key)!
        g.totalQuantity += (r.quantity ?? 0)
        g.totalValue += isFinite(val) ? val : 0
        g.netQuantity += qtySigned
        g.firstDate = String(g.firstDate) < String(r.date) ? g.firstDate : r.date
        g.lastDate = String(g.lastDate) > String(r.date) ? g.lastDate : r.date
        g.tradesCount += 1
      }
      groups = Array.from(map.values()).map(g => ({
        ...g,
        side: g.netQuantity >= 0 ? 'BUY' : 'SELL',
      }))
      groups.sort((a, b) => Number(b.totalValue) - Number(a.totalValue))
    }

    // Count deals by exchange
    const nseCount = filtered.filter(d => d.exchange === "NSE").length
    const bseCount = filtered.filter(d => d.exchange === "BSE").length
    
    return NextResponse.json({
      deals: filtered,
      groups: groups || null,
      count: filtered.length,
      meta: { 
        fetchedAt: new Date().toISOString(), 
        sources: {
          nse: nseCount,
          bse: bseCount,
        },
        intraday, 
        groupBy,
        bseServiceAvailable: bseCount > 0,
      }
    })
  } catch (e: any) {
    console.error("[BulkDeals] Error:", e)
    return NextResponse.json({ deals: [], count: 0, error: e?.message, meta: { fetchedAt: new Date().toISOString(), source: "error" } })
  }
}
