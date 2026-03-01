import { NextResponse } from "next/server"
import { getBseCorporateActionsFromApi, type BseActionRow } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"

interface CorporateAction {
  id: string
  scripCode: string
  shortName: string
  longName: string
  purpose: string
  purposeType: string
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

const PURPOSE_CODES: Record<string, string> = {
  "P5": "Bonus",
  "P6": "Buyback",
  "P9": "Dividend",
  "P10": "Preference Dividend",
  "P26": "Split",
  "P29": "Delisting",
}

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

function parseDividendAmount(purpose: string): number | undefined {
  if (!purpose.toLowerCase().includes('dividend')) return undefined
  const match = purpose.match(/([\d.]+)\s*$/)
  if (match) return parseFloat(match[1])
  return undefined
}

function parseRatio(purpose: string): string | undefined {
  const bonusMatch = purpose.match(/(\d+):(\d+)/)
  if (bonusMatch) return `${bonusMatch[1]}:${bonusMatch[2]}`
  const splitMatch = purpose.match(/Rs\.?(\d+).*to.*Rs\.?(\d+)/i)
  if (splitMatch) return `${splitMatch[1]}:${splitMatch[2]}`
  return undefined
}

function mapActionsToCorporate(rows: BseActionRow[]): CorporateAction[] {
  return rows.map((item, index) => {
    const purpose = item.purpose || ""
    return {
      id: `ca_${item.scripcode || index}_${item.exdate || Date.now()}`,
      scripCode: String(item.scripcode || ""),
      shortName: "",
      longName: item.companyname || "",
      purpose,
      purposeType: getPurposeType(purpose),
      exDate: item.exdate || "",
      recordDate: item.recorddate,
      bcStartDate: item.bcstartdate,
      bcEndDate: item.bcenddate,
      dividendAmount: parseDividendAmount(purpose),
      ratio: parseRatio(purpose),
    }
  }).filter(ca => ca.scripCode || ca.longName)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scripCode = searchParams.get("scripCode") || ""
  const days = parseInt(searchParams.get("days") || "30")
  const pastDaysStr = searchParams.get("pastDays")
  const pastDays = pastDaysStr !== null && pastDaysStr !== "" ? Math.max(0, parseInt(pastDaysStr, 10) || 0) : (scripCode ? 90 : 0)
  const purposeType = searchParams.get("type") || ""

  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - pastDays)
  const toDate = new Date(today)
  toDate.setDate(toDate.getDate() + days)

  try {
    const rows = await getBseCorporateActionsFromApi({
      fromDate,
      toDate,
      ...(scripCode ? { scripcode: scripCode } : {}),
    })
    let actions = mapActionsToCorporate(rows)
    if (purposeType) {
      actions = actions.filter(a => a.purposeType === purposeType)
    }
    return NextResponse.json({
      actions,
      count: actions.length,
      purposeCodes: PURPOSE_CODES,
      meta: { fetchedAt: new Date().toISOString(), source: "nse-bse-api" },
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[Corporate Actions] Error:", err)
    return NextResponse.json({
      actions: [],
      count: 0,
      error: err.message,
      purposeCodes: PURPOSE_CODES,
      meta: { fetchedAt: new Date().toISOString(), source: "nse-bse-api" },
    })
  }
}
