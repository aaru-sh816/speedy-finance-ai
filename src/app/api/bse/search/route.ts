import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// BSE API for equity list (JSON format) - WORKING!
// segment=Equity returns ~1.6MB, segment=Equity%20T%2B1 returns ~4.3MB
const BSE_EQUITY_LIST = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?segment=Equity&status=Active"

// BSE API endpoint
const BSE_BASE_URL = "https://www.bseindia.com"

const BSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "*/*",
  "Referer": "https://www.bseindia.com/corporates/List_Scrips.html",
}

// In-memory cache for BSE scrip list
let bseScripCache: ParsedStock[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface ParsedStock {
  symbol: string
  name: string
  isin: string
  scripCode: string
  exchange: "BSE" | "NSE" | "Both"
  type: "stock" | "etf" | "mf"
  instrumentToken?: number
  exchangeToken?: number
  lastPrice?: number
}

// Comprehensive database of popular Indian stocks for fallback
const STOCK_DATABASE: ParsedStock[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", isin: "INE002A01018", scripCode: "500325", exchange: "Both", type: "stock" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", isin: "INE467B01029", scripCode: "532540", exchange: "Both", type: "stock" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", isin: "INE040A01034", scripCode: "500180", exchange: "Both", type: "stock" },
  { symbol: "INFY", name: "Infosys Ltd.", isin: "INE009A01021", scripCode: "500209", exchange: "Both", type: "stock" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", isin: "INE090A01021", scripCode: "532174", exchange: "Both", type: "stock" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", isin: "INE030A01027", scripCode: "500696", exchange: "Both", type: "stock" },
  { symbol: "SBIN", name: "State Bank of India", isin: "INE062A01020", scripCode: "500112", exchange: "Both", type: "stock" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", isin: "INE397D01024", scripCode: "532454", exchange: "Both", type: "stock" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd.", isin: "INE237A01028", scripCode: "500247", exchange: "Both", type: "stock" },
  { symbol: "ITC", name: "ITC Ltd.", isin: "INE154A01025", scripCode: "500875", exchange: "Both", type: "stock" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", isin: "INE018A01030", scripCode: "500510", exchange: "Both", type: "stock" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd.", isin: "INE238A01034", scripCode: "532215", exchange: "Both", type: "stock" },
  { symbol: "WIPRO", name: "Wipro Ltd.", isin: "INE075A01022", scripCode: "507685", exchange: "Both", type: "stock" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", isin: "INE296A01024", scripCode: "500034", exchange: "Both", type: "stock" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd.", isin: "INE585B01010", scripCode: "532500", exchange: "Both", type: "stock" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd.", isin: "INE860A01027", scripCode: "532281", exchange: "Both", type: "stock" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd.", isin: "INE021A01026", scripCode: "500820", exchange: "Both", type: "stock" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd.", isin: "INE044A01036", scripCode: "524715", exchange: "Both", type: "stock" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", isin: "INE155A01022", scripCode: "500570", exchange: "Both", type: "stock" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", isin: "INE081A01012", scripCode: "500470", exchange: "Both", type: "stock" },
  { symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd.", isin: "INE752E01010", scripCode: "532898", exchange: "Both", type: "stock" },
  { symbol: "NTPC", name: "NTPC Ltd.", isin: "INE733E01010", scripCode: "532555", exchange: "Both", type: "stock" },
  { symbol: "ONGC", name: "Oil and Natural Gas Corporation Ltd.", isin: "INE213A01029", scripCode: "500312", exchange: "Both", type: "stock" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd.", isin: "INE481G01011", scripCode: "532538", exchange: "Both", type: "stock" },
  { symbol: "TITAN", name: "Titan Company Ltd.", isin: "INE280A01028", scripCode: "500114", exchange: "Both", type: "stock" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd.", isin: "INE669C01036", scripCode: "532755", exchange: "Both", type: "stock" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd.", isin: "INE101A01026", scripCode: "500520", exchange: "Both", type: "stock" },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", isin: "INE423A01024", scripCode: "512599", exchange: "Both", type: "stock" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd.", isin: "INE918I01018", scripCode: "532978", exchange: "Both", type: "stock" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd.", isin: "INE239A01016", scripCode: "500790", exchange: "Both", type: "stock" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd.", isin: "INE019A01038", scripCode: "500228", exchange: "Both", type: "stock" },
  { symbol: "COALINDIA", name: "Coal India Ltd.", isin: "INE522F01014", scripCode: "533278", exchange: "Both", type: "stock" },
  { symbol: "GRASIM", name: "Grasim Industries Ltd.", isin: "INE047A01021", scripCode: "500300", exchange: "Both", type: "stock" },
  { symbol: "CIPLA", name: "Cipla Ltd.", isin: "INE059A01026", scripCode: "500087", exchange: "Both", type: "stock" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd.", isin: "INE089A01023", scripCode: "500124", exchange: "Both", type: "stock" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd.", isin: "INE066A01021", scripCode: "505200", exchange: "Both", type: "stock" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd.", isin: "INE361B01024", scripCode: "532488", exchange: "Both", type: "stock" },
  { symbol: "BPCL", name: "Bharat Petroleum Corporation Ltd.", isin: "INE029A01011", scripCode: "500547", exchange: "Both", type: "stock" },
  { symbol: "SHREECEM", name: "Shree Cement Ltd.", isin: "INE070A01015", scripCode: "500387", exchange: "Both", type: "stock" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd.", isin: "INE158A01026", scripCode: "500182", exchange: "Both", type: "stock" },
  { symbol: "BILCARE", name: "Bilcare Ltd.", isin: "INE986A01012", scripCode: "526853", exchange: "BSE", type: "stock" },
  { symbol: "GUJGAS", name: "Gujarat Gas Ltd.", isin: "INE844O01030", scripCode: "539336", exchange: "Both", type: "stock" },
  { symbol: "STUDDS", name: "Studds Accessories Ltd.", isin: "INE270S01017", scripCode: "544599", exchange: "Both", type: "stock" },
  { symbol: "BRIGADE", name: "Brigade Enterprises Ltd.", isin: "INE791I01019", scripCode: "532929", exchange: "Both", type: "stock" },
  { symbol: "MANYAVAR", name: "Vedant Fashions Ltd.", isin: "INE825V01034", scripCode: "543463", exchange: "Both", type: "stock" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd.", isin: "INE917I01010", scripCode: "532977", exchange: "Both", type: "stock" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd.", isin: "INE095A01012", scripCode: "532187", exchange: "Both", type: "stock" },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd.", isin: "INE216A01022", scripCode: "500825", exchange: "Both", type: "stock" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd.", isin: "INE437A01024", scripCode: "508869", exchange: "Both", type: "stock" },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd.", isin: "INE038A01020", scripCode: "500440", exchange: "Both", type: "stock" },
  // SAL stocks
  { symbol: "SALZER", name: "Salzer Electronics Ltd.", isin: "INE457F01014", scripCode: "531164", exchange: "Both", type: "stock" },
  { symbol: "SALONA", name: "Salona Cotspin Ltd.", isin: "INE754D01011", scripCode: "532776", exchange: "Both", type: "stock" },
  { symbol: "SALMDIA", name: "Salem Microwave Equipments Ltd.", isin: "INE123B01017", scripCode: "500368", exchange: "BSE", type: "stock" },
  { symbol: "SALSTEEL", name: "S.A.L. Steel Ltd.", isin: "INE735C01029", scripCode: "500380", exchange: "BSE", type: "stock" },
  // More popular stocks
  { symbol: "ADANIPORTS", name: "Adani Ports and SEZ Ltd.", isin: "INE742F01042", scripCode: "532921", exchange: "Both", type: "stock" },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", isin: "INE423A01024", scripCode: "512599", exchange: "Both", type: "stock" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy Ltd.", isin: "INE364U01010", scripCode: "541450", exchange: "Both", type: "stock" },
  { symbol: "TATAPOWER", name: "Tata Power Company Ltd.", isin: "INE245A01021", scripCode: "500400", exchange: "Both", type: "stock" },
  { symbol: "ZOMATO", name: "Zomato Ltd.", isin: "INE758T01015", scripCode: "543320", exchange: "Both", type: "stock" },
  { symbol: "PAYTM", name: "One97 Communications Ltd.", isin: "INE982J01020", scripCode: "543396", exchange: "Both", type: "stock" },
  { symbol: "NYKAA", name: "FSN E-Commerce Ventures Ltd.", isin: "INE388Y01029", scripCode: "543384", exchange: "Both", type: "stock" },
  { symbol: "DELHIVERY", name: "Delhivery Ltd.", isin: "INE148O01028", scripCode: "543529", exchange: "Both", type: "stock" },
  { symbol: "POLICYBZR", name: "PB Fintech Ltd.", isin: "INE417T01026", scripCode: "543390", exchange: "Both", type: "stock" },
  { symbol: "LIC", name: "Life Insurance Corporation of India", isin: "INE0J1Y01017", scripCode: "543526", exchange: "Both", type: "stock" },
];

/**
 * Fetch all BSE scrips from official API
 * Returns list of all active equity stocks
 */
async function fetchBSEScripList(): Promise<ParsedStock[]> {
  // Return cached data if still valid
  if (bseScripCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log(`[BSE] Using cached scrip list (${bseScripCache.length} stocks)`)
    return bseScripCache
  }

  try {
    console.log("[BSE] Fetching full scrip list from BSE API...")
    
    const response = await fetch(BSE_EQUITY_LIST, {
      method: "GET",
      headers: BSE_HEADERS,
      cache: "no-store",
    })

    if (!response.ok) {
      console.error(`[BSE] Scrip list API error: ${response.status}`)
      return STOCK_DATABASE
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error("[BSE] Unexpected response format")
      return STOCK_DATABASE
    }

    // Parse the BSE response - Format from API:
    // { SCRIP_CD, Scrip_Name, Status, GROUP, FACE_VALUE, ISIN_NUMBER, INDUSTRY, scrip_id, Segment, NSURL, Issuer_Name }
    const stocks: ParsedStock[] = data.map((item: any) => ({
      symbol: item.scrip_id || item.SCRIP_CD || "",
      name: item.Scrip_Name || item.Issuer_Name || "",
      isin: item.ISIN_NUMBER || "",
      scripCode: String(item.SCRIP_CD || ""),
      exchange: "BSE" as const,
      type: "stock" as const,
    })).filter((s: ParsedStock) => s.name && s.scripCode)

    console.log(`[BSE] Loaded ${stocks.length} scrips from BSE API`)
    
    // Update cache
    bseScripCache = stocks
    cacheTimestamp = Date.now()
    
    return stocks
  } catch (error: any) {
    console.error("[BSE] Failed to fetch scrip list:", error.message)
    return STOCK_DATABASE
  }
}

/**
 * Search BSE scrips by name or code (prefix match like BSE website)
 */
function searchBSEScrips(query: string, scrips: ParsedStock[]): ParsedStock[] {
  const q = query.toUpperCase().trim()
  if (!q) return []
  
  const results: ParsedStock[] = []
  
  // First: exact prefix match on symbol (like BSE website)
  for (const s of scrips) {
    if (s.symbol.toUpperCase().startsWith(q)) {
      results.push(s)
      if (results.length >= 30) break
    }
  }
  
  // If not enough, also match by name prefix
  if (results.length < 30) {
    for (const s of scrips) {
      if (!results.find(r => r.scripCode === s.scripCode)) {
        if (s.name.toUpperCase().startsWith(q)) {
          results.push(s)
          if (results.length >= 30) break
        }
      }
    }
  }
  
  // If still not enough, match anywhere in name
  if (results.length < 30) {
    for (const s of scrips) {
      if (!results.find(r => r.scripCode === s.scripCode)) {
        if (s.name.toUpperCase().includes(q) || s.symbol.toUpperCase().includes(q)) {
          results.push(s)
          if (results.length >= 30) break
        }
      }
    }
  }
  
  return results
}

/**
 * Search local database
 */
function searchLocalDatabase(query: string): ParsedStock[] {
  const q = query.toLowerCase()
  return STOCK_DATABASE.filter(stock => 
    stock.symbol.toLowerCase().includes(q) ||
    stock.name.toLowerCase().includes(q) ||
    stock.scripCode.includes(q) ||
    stock.isin.toLowerCase().includes(q)
  ).slice(0, 20)
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()
  
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [], error: "Query too short" })
  }
  
  console.log(`[Search] Searching for: "${query}"`)
  
  try {
    // Fetch BSE Full Scrip List (cached for 24 hours)
    const bseScrips = await fetchBSEScripList()
    
    if (bseScrips.length === 0) {
      console.error("[Search] BSE scrip list is empty, using fallback")
      const localResults = searchLocalDatabase(query)
      return NextResponse.json({ 
        results: localResults,
        count: localResults.length,
        query,
        source: "local-fallback",
        warning: "BSE API unavailable, using local database"
      })
    }
    
    // Search using prefix matching (like BSE website)
    const results = searchBSEScrips(query, bseScrips)
    
    console.log(`[Search] ✅ Found ${results.length} results from ${bseScrips.length} total scrips`)
    
    return NextResponse.json({ 
      results,
      count: results.length,
      query,
      source: "bse-list",
      totalScrips: bseScrips.length,
      cached: Date.now() - cacheTimestamp < 60000 // true if cached in last minute
    })
    
  } catch (error: any) {
    console.error("[Search] Error:", error.message)
    
    // Emergency fallback to local database
    const localResults = searchLocalDatabase(query)
    return NextResponse.json({ 
      results: localResults,
      count: localResults.length,
      query,
      source: "local-error",
      error: error.message
    })
  }
}
