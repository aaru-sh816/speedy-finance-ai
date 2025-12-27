import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// BSE API for corporate actions
const BSE_ACTIONS_URL = "https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w"

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com",
}

interface CorporateAction {
  id: string
  scripCode: string
  shortName: string
  longName: string
  purpose: string
  purposeType: string // dividend, bonus, split, rights, buyback, delisting
  exDate: string
  recordDate?: string
  bcStartDate?: string
  bcEndDate?: string
  ndStartDate?: string
  ndEndDate?: string
  paymentDate?: string
  dividendAmount?: number
  ratio?: string
}

// Purpose code mapping (from BSE constants)
const PURPOSE_CODES: Record<string, string> = {
  "P5": "Bonus",
  "P6": "Buyback",
  "P9": "Dividend",
  "P10": "Preference Dividend",
  "P26": "Split",
  "P29": "Delisting",
}

// Extract purpose type from purpose string
function getPurposeType(purpose: string): string {
  const p = purpose.toLowerCase()
  if (p.includes('dividend')) return 'dividend'
  if (p.includes('bonus')) return 'bonus'
  if (p.includes('split')) return 'split'
  if (p.includes('right')) return 'rights'
  if (p.includes('buyback')) return 'buyback'
  if (p.includes('delist')) return 'delisting'
  if (p.includes('agm') || p.includes('egm')) return 'meeting'
  return 'other'
}

// Parse dividend amount from purpose string like "Interim Dividend - Rs. - 18.0000"
function parseDividendAmount(purpose: string): number | undefined {
  if (!purpose.toLowerCase().includes('dividend')) return undefined
  const match = purpose.match(/([\d.]+)\s*$/)
  if (match) return parseFloat(match[1])
  return undefined
}

// Parse ratio from purpose string like "Bonus issue 1:1" or "Stock Split From Rs.5/- to Rs.2/-"
function parseRatio(purpose: string): string | undefined {
  // Bonus: "Bonus issue 1:1"
  const bonusMatch = purpose.match(/(\d+):(\d+)/)
  if (bonusMatch) return `${bonusMatch[1]}:${bonusMatch[2]}`
  
  // Split: "Stock Split From Rs.5/- to Rs.2/-"
  const splitMatch = purpose.match(/Rs\.?(\d+).*to.*Rs\.?(\d+)/i)
  if (splitMatch) return `${splitMatch[1]}:${splitMatch[2]}`
  
  return undefined
}

function parseCorporateActions(data: any[]): CorporateAction[] {
  if (!Array.isArray(data)) return []
  
  return data.map((item, index) => {
    const purpose = item.Purpose || ''
    return {
      id: `ca_${item.scrip_code || index}_${item.exdate || Date.now()}`,
      scripCode: String(item.scrip_code || ''),
      shortName: item.short_name || '',
      longName: item.long_name || '',
      purpose: purpose,
      purposeType: getPurposeType(purpose),
      exDate: item.Ex_date || '',
      recordDate: item.RD_Date || undefined,
      bcStartDate: item.BCRD_FROM || undefined,
      bcEndDate: item.BCRD_TO || undefined,
      ndStartDate: item.ND_START_DATE || undefined,
      ndEndDate: item.ND_END_DATE || undefined,
      paymentDate: item.payment_date || undefined,
      dividendAmount: parseDividendAmount(purpose),
      ratio: parseRatio(purpose),
    }
  }).filter(ca => ca.scripCode || ca.shortName)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const scripCode = searchParams.get("scripCode") || ""
  const purposeCode = searchParams.get("purpose") || ""
  const days = parseInt(searchParams.get("days") || "30")
  const segment = searchParams.get("segment") || "0" // 0=equity
  const purposeType = searchParams.get("type") || "" // dividend, bonus, split, etc.
  const allowMock = searchParams.get("allowMock") !== "false"

  try {
    // Calculate date range - from today to N days ahead
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)
    
    const formatDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
    const fromDate = formatDate(today)
    const toDate = formatDate(futureDate)

    const params = new URLSearchParams({
      Atea: "", // Area
      Atea1: "", // Sub-area
      ctession: "",
      Ession: "",
      Ession1: "",
      strSearch: "S", // Search type
      Sessession: "",
      Sesession1: "",
      Security: "",
      Securityt: "",
    })

    if (scripCode) {
      params.set("scripcode", scripCode)
    }
    
    if (purposeCode) {
      params.set("Purposecode", purposeCode)
    }

    const url = `${BSE_ACTIONS_URL}?${params.toString()}`
    // console.debug(`[Corporate Actions] Fetching: ${url}`)

    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // console.debug(`[Corporate Actions] BSE API error: ${response.status}`)
      if (!allowMock) {
        return NextResponse.json({
          actions: [],
          count: 0,
          error: `BSE API returned ${response.status}`,
          purposeCodes: PURPOSE_CODES,
          meta: { fetchedAt: new Date().toISOString(), source: "bse" }
        })
      }
      // Return mock data for UX if allowed
      return NextResponse.json({
        actions: getMockActions(),
        count: 5,
        purposeCodes: PURPOSE_CODES,
        meta: {
          fetchedAt: new Date().toISOString(),
          source: "mock",
        }
      })
    }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        // console.debug(`[Corporate Actions] BSE API returned non-JSON: ${contentType}`)
        if (!allowMock) {
          return NextResponse.json({
            actions: [],
            count: 0,
            error: `BSE API returned non-JSON response`,
            purposeCodes: PURPOSE_CODES,
            meta: { fetchedAt: new Date().toISOString(), source: "bse" }
          })
        }
        return NextResponse.json({
          actions: getMockActions(),
          count: 5,
          purposeCodes: PURPOSE_CODES,
          meta: { fetchedAt: new Date().toISOString(), source: "mock" }
        })
      }
      
      const data = await response.json()
      let actions = parseCorporateActions(data)
    
    // Filter by purpose type if specified
    if (purposeType) {
      actions = actions.filter(a => a.purposeType === purposeType)
    }
    
    // console.debug(`[Corporate Actions] Found ${actions.length} actions`)

    // If no actions from API
    if (actions.length === 0) {
      if (!allowMock) {
        return NextResponse.json({
          actions: [],
          count: 0,
          purposeCodes: PURPOSE_CODES,
          meta: { fetchedAt: new Date().toISOString(), source: "bse" }
        })
      }
      return NextResponse.json({
        actions: getMockActions(),
        count: 5,
        purposeCodes: PURPOSE_CODES,
        meta: {
          fetchedAt: new Date().toISOString(),
          source: "mock",
        }
      })
    }

    return NextResponse.json({
      actions,
      count: actions.length,
      purposeCodes: PURPOSE_CODES,
      meta: {
        fetchedAt: new Date().toISOString(),
        source: "bse",
      }
    })

  } catch (error: any) {
    console.error("[Corporate Actions] Error:", error)
    if (!allowMock) {
      return NextResponse.json({
        actions: [],
        count: 0,
        error: error.message,
        purposeCodes: PURPOSE_CODES,
        meta: { fetchedAt: new Date().toISOString(), source: "bse" }
      })
    }
    // Return mock data on error if allowed
    return NextResponse.json({
      actions: getMockActions(),
      count: 5,
      error: error.message,
      purposeCodes: PURPOSE_CODES,
      meta: {
        fetchedAt: new Date().toISOString(),
        source: "mock",
      }
    })
  }
}

// Mock data for testing when API fails
function getMockActions(): CorporateAction[] {
  const today = new Date()
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  
  return [
    {
      id: 'ca_500209_1',
      scripCode: '500209',
      shortName: 'INFY',
      longName: 'INFOSYS LTD.',
      purpose: 'Interim Dividend - Rs. - 18.0000',
      purposeType: 'dividend',
      exDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
      recordDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
      dividendAmount: 18.0,
    },
    {
      id: 'ca_520066_1',
      scripCode: '520066',
      shortName: 'JAYBARMARU',
      longName: 'JAY BHARAT MARUTI LTD.',
      purpose: 'Stock Split From Rs.5/- to Rs.2/-',
      purposeType: 'split',
      exDate: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
      recordDate: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
      ratio: '5:2',
    },
    {
      id: 'ca_543464_1',
      scripCode: '543464',
      shortName: 'SPITZE',
      longName: 'Maruti Interior Products Ltd',
      purpose: 'Bonus issue 1:1',
      purposeType: 'bonus',
      exDate: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
      recordDate: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
      ratio: '1:1',
    },
    {
      id: 'ca_500325_1',
      scripCode: '500325',
      shortName: 'RELIANCE',
      longName: 'RELIANCE INDUSTRIES LTD.',
      purpose: 'Final Dividend - Rs. - 10.0000',
      purposeType: 'dividend',
      exDate: formatDate(new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)),
      recordDate: formatDate(new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)),
      dividendAmount: 10.0,
    },
    {
      id: 'ca_532540_1',
      scripCode: '532540',
      shortName: 'TCS',
      longName: 'TATA CONSULTANCY SERVICES LTD.',
      purpose: 'Buyback of Equity Shares',
      purposeType: 'buyback',
      exDate: formatDate(new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)),
    },
  ]
}
