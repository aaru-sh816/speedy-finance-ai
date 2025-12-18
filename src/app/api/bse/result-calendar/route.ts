import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// BSE API for result calendar
const BSE_API_URL = "https://api.bseindia.com/BseIndiaAPI/api/Corpforthresults/w"

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com",
}

interface ResultCalendarItem {
  id: string
  scripCode: string
  company: string
  symbol: string
  resultDate: string
  resultType?: string
}

function parseResultCalendar(data: any[]): ResultCalendarItem[] {
  if (!Array.isArray(data)) return []
  
  return data.map((item, index) => ({
    id: `result_${item.scrip_Code || index}_${item.meeting_date || Date.now()}`,
    scripCode: item.scrip_Code || "",
    company: item.long_name || item.short_name || "",
    symbol: item.short_name || "",
    resultDate: item.meeting_date || "",
    resultType: item.Result_Type || undefined,
  })).filter(r => r.scripCode || r.company)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const scripCode = searchParams.get("scripCode") || ""
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")

  try {
    const params = new URLSearchParams()

    if (scripCode) {
      params.set("scripcode", scripCode)
    }
    
    if (fromDate && toDate) {
      // Format: YYYYMMDD
      params.set("fromdate", fromDate.replace(/-/g, ""))
      params.set("todate", toDate.replace(/-/g, ""))
    }

    const url = `${BSE_API_URL}?${params.toString()}`
    console.log(`[Result Calendar] Fetching: ${url}`)

    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
    })

    if (!response.ok) {
      console.error(`[Result Calendar] BSE API error: ${response.status}`)
      return NextResponse.json({ 
        results: [], 
        error: `BSE API returned ${response.status}` 
      })
    }

    const data = await response.json()
    const results = parseResultCalendar(data)
    
    console.log(`[Result Calendar] Found ${results.length} results`)

    return NextResponse.json({
      results,
      count: results.length,
      meta: {
        fetchedAt: new Date().toISOString(),
        source: "bse",
      }
    })

  } catch (error: any) {
    console.error("[Result Calendar] Error:", error)
    return NextResponse.json({ 
      results: [], 
      error: error.message || "Failed to fetch result calendar"
    })
  }
}
