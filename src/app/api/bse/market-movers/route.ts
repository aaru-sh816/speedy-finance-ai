import { NextRequest, NextResponse } from "next/server"
import { bseClient, type BSEGainerLoser } from "@/lib/bse/client"
import {
  getBseGainersFromApi,
  getBseLosersFromApi,
  getNseGainersFromApi,
  getNseLosersFromApi,
} from "@/lib/nse-bse/unified-market"

export const dynamic = 'force-dynamic'
export const revalidate = 60

/** Normalize BSE/nse-bse-api gainer/loser row (scripcode, companyname, ltp, change, pchange) to BSEGainerLoser */
function normalizeBseMover(row: Record<string, unknown>): BSEGainerLoser {
  const scripCode = String(row.scripcode ?? row.scripCode ?? row.ScripCode ?? "")
  const securityID = String(row.companyname ?? row.securityID ?? row.SecurityID ?? row.securityId ?? row.ScriptCode ?? scripCode)
  const ltp = row.LTP ?? row.ltp ?? row.lastPrice ?? row.LastPrice
  const change = row.change ?? row.Change ?? row.changeAmount
  const pChange = row.pChange ?? row.PChange ?? row.pchange ?? row.pctChange ?? row.changePercent
  return {
    securityID,
    scripCode,
    LTP: ltp != null ? String(ltp) : "",
    change: change != null ? String(change) : "",
    pChange: pChange != null ? String(pChange) : "",
  }
}

/** Normalize NSE index row (symbol, lastPrice, pChange, etc.) to BSEGainerLoser for UI consistency */
function normalizeNseMover(row: Record<string, unknown>): BSEGainerLoser {
  const symbol = String(row.symbol ?? row.Symbol ?? row.identifier ?? "")
  const securityID = String(row.symbol ?? row.companyName ?? row.securityName ?? symbol)
  const ltp = row.lastPrice ?? row.last ?? row.ltp ?? row.LTP
  const change = row.change ?? row.netPrice ?? row.Change
  const pChange = row.pChange ?? row.pchange ?? row.changePercent
  return {
    securityID,
    scripCode: symbol,
    LTP: ltp != null ? String(ltp) : "",
    change: change != null ? String(change) : "",
    pChange: pChange != null ? String(pChange) : "",
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type") || "gainers"

  if (type !== "gainers" && type !== "losers") {
    return NextResponse.json(
      { error: "Invalid type. Use 'gainers' or 'losers'" },
      { status: 400 }
    )
  }

  try {
    let data: BSEGainerLoser[] = []

    // 1) nse-bse-api first (BSE gainers/losers)
    try {
      const raw = type === "gainers" ? await getBseGainersFromApi() : await getBseLosersFromApi()
      data = Array.isArray(raw) ? raw.map((r: Record<string, unknown>) => normalizeBseMover(r)) : []
    } catch (apiErr) {
      console.warn("Market movers nse-bse-api (BSE) failed:", (apiErr as Error)?.message)
    }

    // 2) Python fallback when nse-bse-api returned nothing
    if (data.length === 0) {
      const useBackend = await bseClient.healthCheck()
      if (useBackend) {
        try {
          data = type === "gainers" ? await bseClient.getTopGainers() : await bseClient.getTopLosers()
        } catch (backendErr) {
          console.warn("Market movers Python failed:", (backendErr as Error)?.message)
        }
      }
    }

    // 3) NSE index fallback when both BSE sources returned nothing
    if (data.length === 0) {
      try {
        const nseRaw = type === "gainers" ? await getNseGainersFromApi("NIFTY 50", 20) : await getNseLosersFromApi("NIFTY 50", 20)
        data = Array.isArray(nseRaw) ? nseRaw.map((r) => normalizeNseMover(r as Record<string, unknown>)) : []
      } catch (nseErr) {
        console.warn("Market movers NSE fallback failed:", (nseErr as Error)?.message)
      }
    }

    return NextResponse.json({
      success: true,
      type,
      data,
      count: data.length,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error(`Market movers API error (${type}):`, err)
    return NextResponse.json(
      { error: "Failed to fetch market movers", message: err?.message },
      { status: 500 }
    )
  }
}
