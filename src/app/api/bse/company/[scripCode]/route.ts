import { NextResponse } from "next/server"
import { fetchCompanyAnnouncements } from "@/lib/bse/fetcher"
import { fetchBseCompanyHeader } from "@/lib/bse/company-header"
import { buildLogoUrls } from "@/lib/logo-utils"
import { SCRIP_TO_NSE_SYMBOL } from "@/lib/scrip-symbol-map"
import { getBseAnnouncementsFromApi, getBseLookupFromApi, getBseListSecuritiesFromApi } from "@/lib/nse-bse/unified-market"
import { normalizeBSEAnnouncement } from "@/lib/bse/types"
import type { BSERawAnnouncement } from "@/lib/bse/types"
import type { BSEAnnouncement } from "@/lib/bse/types"
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

/** Resolve scrip via nse-bse-api listSecurities (no direct BSE URL). */
async function fetchScripFromList(scripCode: string) {
  const rows = await getBseListSecuritiesFromApi({ scripcode: scripCode, segment: "Equity", status: "Active" })
  const first = rows[0]
  if (!first) return null
  const symbol = first.symbol || first.scripcode
  return {
    symbol,
    tradingViewSymbol: symbol && /^[A-Z0-9&-]+$/i.test(symbol) ? symbol.toUpperCase() : null,
    companyName: first.companyname || "",
    isin: first.isin || "",
    group: first.group,
  }
}

/** Resolve symbol via nse-bse-api lookup (no direct BSE URL). */
async function lookupSymbol(scripCode: string): Promise<string | null> {
  const row = await getBseLookupFromApi(scripCode)
  const sym = row?.symbol ? String(row.symbol).toUpperCase() : null
  return sym && /^[A-Z0-9&-]+$/i.test(sym) ? sym : null
}

// Helper to get symbol from Python service
async function getSymbolFromPythonService(scripCode: string): Promise<{ symbol: string; name: string; restricted?: boolean } | null> {
  try {
    const BSE_SERVICE_URL = process.env.BSE_SERVICE_URL || 'http://localhost:5000'
    const res = await fetch(`${BSE_SERVICE_URL}/api/quote/${scripCode}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.success || !data.data) return null
    
    // bsedata returns securityID which is the BSE symbol
    const symbol = data.data.securityID || data.data.scripId || data.data.scrip_code || data.data.companyName?.split(' ')[0]
    if (symbol) {
      return {
        symbol: symbol.toString().toUpperCase(),
        name: data.data.companyName || `${symbol} Ltd`,
        restricted: Boolean(data.restricted ?? data.data.restricted)
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
    // Company header: only direct BSE call (ComHeadernew), via company-header.ts
    let companyInfo = await fetchBseCompanyHeader(scripCode)

    // First check our known mapping (most reliable for TradingView)
    let knownStock = SCRIP_TO_SYMBOL[scripCode]
    if (!knownStock && SCRIP_TO_NSE_SYMBOL[scripCode]) {
      knownStock = {
        symbol: SCRIP_TO_NSE_SYMBOL[scripCode],
        name: companyInfo?.companyName || `Company ${scripCode}`,
      }
    }
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
    
    // Add tradingViewSymbol and logo URLs to companyInfo for response
    const { logoUrl, logoUrlFallback } = buildLogoUrls(
      companyInfo.symbol || scripCode,
      companyInfo.isin
    )
    const responseInfo = {
      ...companyInfo,
      tradingViewSymbol, // null if not compatible, string if valid
      logoUrl,
      logoUrlFallback,
    }
    
    console.log(`[Company] Final info for ${scripCode}: symbol=${companyInfo.symbol}, tvSymbol=${tradingViewSymbol}, name=${companyInfo.companyName}`)

    // If only info requested, return early
    if (infoOnly) {
      return NextResponse.json(responseInfo)
    }

    // Fetch announcements (real data only)
    let announcements = await fetchCompanyAnnouncements(scripCode, days)

    if (announcements.length === 0) {
      const raw = await getBseAnnouncementsFromApi({
        fromDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        toDate: new Date(),
        pageNo: 1,
        scripcode: scripCode,
      })
      const table = raw && typeof raw === "object" && "Table" in raw && Array.isArray((raw as { Table?: unknown[] }).Table) ? (raw as { Table: BSERawAnnouncement[] }).Table : null
      if (table?.length) {
        const fromApi = table.map((row) => normalizeBSEAnnouncement(row)) as BSEAnnouncement[]
        announcements = fromApi.filter((a) => a.scripCode === scripCode)
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

    try {
      const raw = await getBseAnnouncementsFromApi({
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        toDate: new Date(),
        pageNo: 1,
        scripcode: scripCode,
      })
      const table = raw && typeof raw === "object" && "Table" in raw && Array.isArray((raw as { Table?: unknown[] }).Table) ? (raw as { Table: BSERawAnnouncement[] }).Table : null
      if (table?.length) {
        const fromApi = table.map((row) => normalizeBSEAnnouncement(row)) as BSEAnnouncement[]
        const announcements = fromApi.filter((a) => a.scripCode === scripCode)
        const companyInfo = SCRIP_TO_SYMBOL[scripCode] ?? { symbol: scripCode, name: `Scrip ${scripCode}` }
        return NextResponse.json({
          scripCode,
          symbol: companyInfo.symbol,
          companyName: companyInfo.name,
          announcements,
          meta: {
            count: announcements.length,
            days,
            fetchedAt: new Date().toISOString(),
            source: "nse-bse-api",
            error: e?.message,
          },
        })
      }
    } catch (_) {
      // ignore
    }

    return NextResponse.json({
      scripCode,
      symbol: scripCode,
      companyName: `Company ${scripCode}`,
      announcements: [],
      meta: {
        count: 0,
        days,
        fetchedAt: new Date().toISOString(),
        source: "bse",
        error: e?.message,
      },
    }, { status: 500 })
  }
}
