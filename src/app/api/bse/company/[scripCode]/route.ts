import { NextResponse } from "next/server"
import { fetchCompanyAnnouncements } from "@/lib/bse/fetcher"
import { generateMockAnnouncements } from "@/lib/bse/mockData"
import { metrics } from "@/lib/infra/metrics"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Known scripCode to symbol mapping (for TradingView)
const SCRIP_TO_SYMBOL: Record<string, { symbol: string; name: string }> = {
  "500325": { symbol: "RELIANCE", name: "Reliance Industries Ltd." },
  "532540": { symbol: "TCS", name: "Tata Consultancy Services Ltd." },
  "500180": { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
  "500209": { symbol: "INFY", name: "Infosys Ltd." },
  "532174": { symbol: "ICICIBANK", name: "ICICI Bank Ltd." },
  "500696": { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd." },
  "500112": { symbol: "SBIN", name: "State Bank of India" },
  "532454": { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd." },
  "500247": { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd." },
  "500875": { symbol: "ITC", name: "ITC Ltd." },
  "500510": { symbol: "LT", name: "Larsen & Toubro Ltd." },
  "532215": { symbol: "AXISBANK", name: "Axis Bank Ltd." },
  "507685": { symbol: "WIPRO", name: "Wipro Ltd." },
  "500034": { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd." },
  "532500": { symbol: "MARUTI", name: "Maruti Suzuki India Ltd." },
  "532281": { symbol: "HCLTECH", name: "HCL Technologies Ltd." },
  "500820": { symbol: "ASIANPAINT", name: "Asian Paints Ltd." },
  "524715": { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd." },
  "500570": { symbol: "TATAMOTORS", name: "Tata Motors Ltd." },
  "500470": { symbol: "TATASTEEL", name: "Tata Steel Ltd." },
  "532898": { symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd." },
  "532555": { symbol: "NTPC", name: "NTPC Ltd." },
  "500312": { symbol: "ONGC", name: "Oil and Natural Gas Corporation Ltd." },
  "532538": { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd." },
  "500114": { symbol: "TITAN", name: "Titan Company Ltd." },
  "532755": { symbol: "TECHM", name: "Tech Mahindra Ltd." },
  "500520": { symbol: "M&M", name: "Mahindra & Mahindra Ltd." },
  "512599": { symbol: "ADANIENT", name: "Adani Enterprises Ltd." },
  "532978": { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd." },
  "500790": { symbol: "NESTLEIND", name: "Nestle India Ltd." },
  "500228": { symbol: "JSWSTEEL", name: "JSW Steel Ltd." },
  "533278": { symbol: "COALINDIA", name: "Coal India Ltd." },
  "500300": { symbol: "GRASIM", name: "Grasim Industries Ltd." },
  "500087": { symbol: "CIPLA", name: "Cipla Ltd." },
  "500124": { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd." },
  "505200": { symbol: "EICHERMOT", name: "Eicher Motors Ltd." },
  "532488": { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd." },
  "500547": { symbol: "BPCL", name: "Bharat Petroleum Corporation Ltd." },
  "500387": { symbol: "SHREECEM", name: "Shree Cement Ltd." },
  "500182": { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd." },
  "526853": { symbol: "BILCARE", name: "Bilcare Ltd." },
  "539336": { symbol: "GUJGAS", name: "Gujarat Gas Ltd." },
  "544599": { symbol: "STUDDS", name: "Studds Accessories Ltd." },
  "532929": { symbol: "BRIGADE", name: "Brigade Enterprises Ltd." },
  "543463": { symbol: "MANYAVAR", name: "Vedant Fashions Ltd." },
  "532977": { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd." },
  "532187": { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd." },
  "500825": { symbol: "BRITANNIA", name: "Britannia Industries Ltd." },
    "508869": { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd." },
    "500440": { symbol: "HINDALCO", name: "Hindalco Industries Ltd." },
    "544322": { symbol: "UNIMECH", name: "Unimech Aerospace and Manufacturing Ltd." },
    "532915": { symbol: "BALUFORGE", name: "Balu Forge Industries Ltd." },
    "543320": { symbol: "ZOMATO", name: "Zomato Ltd." },
    "543232": { symbol: "NYKAA", name: "FSN E-Commerce Ventures Ltd." },
    "543245": { symbol: "ANGELONE", name: "Angel One Ltd." },
  }

// BSE API headers
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com",
}

/**
 * Fetch basic symbol/name via BSE ListofScripData API (most reliable for mapping)
 * Returns scrip_id which is the proper trading symbol for TradingView
 */
async function fetchScripFromList(scripCode: string) {
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?scripcode=${scripCode}&segment=Equity&status=Active`
    const res = await fetch(url, { method: "GET", headers: HEADERS, cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const item = data[0]
    // scrip_id is the BSE trading symbol (e.g., "BALUFORGE", "RELIANCE")
    const symbol = item?.scrip_id as string | undefined
    return {
      symbol: symbol,
      // Validate symbol is alphabetic (TradingView compatible)
      tradingViewSymbol: symbol && /^[A-Z0-9&-]+$/i.test(symbol) ? symbol.toUpperCase() : null,
      companyName: (item?.Scrip_Name as string | undefined) || (item?.Issuer_Name as string | undefined),
      isin: item?.ISIN_NUMBER as string | undefined,
      group: item?.GROUP as string | undefined,
    }
  } catch {
    return null
  }
}

// Fetch company info from BSE
async function fetchCompanyInfo(scripCode: string) {
  try {
    // BSE API for company header info
    const url = `https://api.bseindia.com/BseIndiaAPI/api/ComHeadernew/w?scripcode=${scripCode}`
    
    // console.log(`[Company Info] Fetching info for scripCode: ${scripCode}`)
    
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    
    if (!response.ok) {
      // console.debug(`[Company Info] API error: ${response.status}`)
      return null
    }
    
    // Check content type to avoid parsing HTML as JSON
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      // console.debug(`[Company Info] Non-JSON response (${contentType}), skipping BSE API`)
      return null
    }
    
    // Get text first to check if it's valid JSON
    const text = await response.text()
    if (text.startsWith('<') || text.startsWith('<!')) {
      // console.debug(`[Company Info] Got HTML instead of JSON, BSE may be blocking`)
      return null
    }
    
    let data
    try {
      data = JSON.parse(text)
    } catch {
      // console.debug(`[Company Info] Invalid JSON response`)
      return null
    }
    
    // console.log(`[Company Info] Response:`, JSON.stringify(data).substring(0, 300))
    
    // Parse response - BSE returns different formats
    const header = data?.Header || data
    
    return {
      scripCode,
      symbol: header?.SLONGNAME || header?.ShortN || header?.ScripName || scripCode,
      companyName: header?.SLONGNAME || header?.LongN || header?.CompanyName || "",
      industry: header?.Industry || "",
      sector: header?.Sector || "",
      group: header?.Scrip_grp || header?.Group || "",
      faceValue: header?.FaceValue || null,
      isin: header?.ISIN || "",
      marketCap: header?.Mktcap || null,
      lastPrice: header?.CurrRate || header?.LTP || null,
    }
  } catch (e) {
    console.error(`[Company Info] Error:`, e)
    return null
  }
}

// Alternative: Get symbol from scrip code using lookup
async function lookupSymbol(scripCode: string) {
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/PeerSmartSearch/w?Type=SS&text=${scripCode}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    
    // Extract symbol from HTML
    // Pattern: <strong>SYMBOL</strong>
    const match = html.match(/<strong>([A-Z0-9&-]+)<\/strong>/)
    if (match) {
      return match[1]
    }
    
    return null
  } catch (e) {
    console.error(`[Lookup] Error:`, e)
    return null
  }
}

// Helper to get symbol from Python service
async function getSymbolFromPythonService(scripCode: string): Promise<{symbol: string, name: string} | null> {
  try {
    const BSE_SERVICE_URL = process.env.BSE_SERVICE_URL || 'http://localhost:8080'
    const res = await fetch(`${BSE_SERVICE_URL}/api/quote/${scripCode}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.success || !data.data) return null
    
    // bsedata returns securityID which is the BSE symbol
    const symbol = data.data.securityID || data.data.scripId || data.data.companyName?.split(' ')[0]
    if (symbol && /^[A-Z0-9&-]+$/i.test(symbol)) {
      return {
        symbol: symbol.toUpperCase(),
        name: data.data.companyName || `${symbol} Ltd`
      }
    }
    return null
  } catch {
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scripCode: string }> }
) {
  const { scripCode } = await params
  const { searchParams } = new URL(request.url)
  
    const daysStr = searchParams.get("days")
    const days = daysStr ? parseInt(daysStr, 10) : 365
    const infoOnly = searchParams.get("infoOnly") === "true"

  if (!scripCode) {
    return NextResponse.json({ error: "Missing scripCode" }, { status: 400 })
  }

  try {
    // First check our known mapping (most reliable for TradingView)
    const knownStock = SCRIP_TO_SYMBOL[scripCode]
    
    // Fetch company info from BSE API
    let companyInfo = await fetchCompanyInfo(scripCode)
    let tradingViewSymbol: string | null = null
    
    // Use known mapping if available (overrides BSE API for reliability)
    if (knownStock) {
      console.log(`[Company] Using known mapping for ${scripCode}: ${knownStock.symbol}`)
      tradingViewSymbol = knownStock.symbol // Known symbols are TradingView compatible
      companyInfo = {
        scripCode,
        symbol: knownStock.symbol,
        companyName: knownStock.name,
        industry: companyInfo?.industry || "",
        sector: companyInfo?.sector || "",
        group: companyInfo?.group || "",
        faceValue: companyInfo?.faceValue || null,
        isin: companyInfo?.isin || "",
        marketCap: companyInfo?.marketCap || null,
        lastPrice: companyInfo?.lastPrice || null,
      }
    } else if (!companyInfo || !companyInfo.symbol || companyInfo.symbol === scripCode) {
        // Fallback 1: Resolve via BSE ListofScripData (gives scrip_id and Scrip_Name)
        const listInfo = await fetchScripFromList(scripCode)
        if (listInfo?.symbol) {
          tradingViewSymbol = listInfo.tradingViewSymbol || null
          companyInfo = {
            scripCode,
            symbol: listInfo.symbol,
            companyName: listInfo.companyName || `Company ${scripCode}`,
            industry: companyInfo?.industry || "",
            sector: companyInfo?.sector || "",
            group: listInfo.group || companyInfo?.group || "",
            faceValue: companyInfo?.faceValue || null,
            isin: listInfo.isin || companyInfo?.isin || "",
            marketCap: companyInfo?.marketCap || null,
            lastPrice: companyInfo?.lastPrice || null,
          }
        } else {
          // Fallback 1.5: Try Python Service
          const pythonInfo = await getSymbolFromPythonService(scripCode)
          if (pythonInfo) {
            tradingViewSymbol = pythonInfo.symbol
            companyInfo = {
              scripCode,
              symbol: pythonInfo.symbol,
              companyName: pythonInfo.name,
              industry: companyInfo?.industry || "",
              sector: companyInfo?.sector || "",
              group: companyInfo?.group || "",
              faceValue: companyInfo?.faceValue || null,
              isin: companyInfo?.isin || "",
              marketCap: companyInfo?.marketCap || null,
              lastPrice: companyInfo?.lastPrice || null,
            }
          } else {
            // Fallback 2: HTML lookup as last resort
            const symbol = await lookupSymbol(scripCode)
            // Validate if the looked up symbol is TradingView compatible
            tradingViewSymbol = symbol && /^[A-Z0-9&-]+$/i.test(symbol) ? symbol.toUpperCase() : null
            companyInfo = {
              scripCode,
              symbol: symbol || scripCode,
              companyName: symbol ? `${symbol} Ltd` : `Company ${scripCode}`,
              industry: companyInfo?.industry || "",
              sector: companyInfo?.sector || "",
              group: companyInfo?.group || "",
              faceValue: companyInfo?.faceValue || null,
              isin: companyInfo?.isin || "",
              marketCap: companyInfo?.marketCap || null,
              lastPrice: companyInfo?.lastPrice || null,
            }
          }
        }
    } else {
      // Check if existing symbol is TradingView compatible
      const sym = companyInfo.symbol
      tradingViewSymbol = sym && /^[A-Z0-9&-]+$/i.test(sym) && !/^\d+$/.test(sym) ? sym.toUpperCase() : null
    }
    
    // Ensure companyInfo is not null at this point
    if (!companyInfo) {
      companyInfo = {
        scripCode,
        symbol: scripCode,
        companyName: `Company ${scripCode}`,
        industry: "",
        sector: "",
        group: "",
        faceValue: null,
        isin: "",
        marketCap: null,
        lastPrice: null,
      }
      tradingViewSymbol = null
    }
    
    // Add tradingViewSymbol to companyInfo for response
    const responseInfo = {
      ...companyInfo,
      tradingViewSymbol, // null if not compatible, string if valid
    }
    
    console.log(`[Company] Final info for ${scripCode}: symbol=${companyInfo.symbol}, tvSymbol=${tradingViewSymbol}, name=${companyInfo.companyName}`)

    // If only info requested, return early
    if (infoOnly) {
      return NextResponse.json(responseInfo)
    }

    // Fetch announcements
    let announcements = await fetchCompanyAnnouncements(scripCode, days)

    // Fallback to filtered mock data if no results
    if (announcements.length === 0) {
      const mockData = generateMockAnnouncements()
      announcements = mockData.filter(a => a.scripCode === scripCode).slice(0, 10)
      
      // If no mock data for this specific scripCode, return recent mock data
      if (announcements.length === 0) {
        announcements = mockData.slice(0, 5).map(a => ({
          ...a, 
          scripCode,
          company: companyInfo.companyName,
          ticker: companyInfo.symbol
        }))
      }
    }

    return NextResponse.json({
      ...responseInfo,
      announcements,
      meta: {
        count: announcements.length,
        days,
        fetchedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    metrics().recordError("BSECompanyAPIError")
    console.error("BSE company API error:", e)
    
    // Return mock data on error
    const mockData = generateMockAnnouncements()
    const announcements = mockData.slice(0, 5)

    return NextResponse.json({
      scripCode,
      symbol: scripCode,
      companyName: `Company ${scripCode}`,
      announcements,
      meta: {
        count: announcements.length,
        days,
        fetchedAt: new Date().toISOString(),
        source: "mock",
        error: e?.message,
      },
    })
  }
}
