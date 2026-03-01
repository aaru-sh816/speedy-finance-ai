import { NextResponse } from "next/server"
import { getBseResultCalendarFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"

/** Response item shape for the result calendar API (from nse-bse-api). */
interface ResultCalendarItem {
  id: string
  scripCode: string
  company: string
  symbol: string
  resultDate: string
  resultType?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scripCode = searchParams.get("scripCode") || ""
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")

  if (fromDate && toDate) {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { results: [], count: 0, error: "fromDate must be before or equal to toDate" },
        { status: 400 }
      )
    }
  }

  try {
    const rows = await getBseResultCalendarFromApi({
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      scripcode: scripCode || undefined,
    })

    const results: ResultCalendarItem[] = rows.map((row, index) => ({
      id: `result_${row.scripcode}_${row.resultdate || index}_${Date.now()}`,
      scripCode: row.scripcode,
      company: row.companyname ?? "",
      symbol: row.companyname ?? "",
      resultDate: row.resultdate ?? "",
      resultType: row.resulttype ?? undefined,
    }))

    console.log(`[Result Calendar] nse-bse-api: ${results.length} results`)

    return NextResponse.json(
      {
        results,
        count: results.length,
        meta: {
          fetchedAt: new Date().toISOString(),
          source: "nse-bse-api",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch result calendar"
    console.error("[Result Calendar] Error:", error)
    return NextResponse.json(
      { results: [], count: 0, error: message },
      { status: 500 }
    )
  }
}
