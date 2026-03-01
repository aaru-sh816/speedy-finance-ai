import { NextResponse } from "next/server"
import { getIndexMaster, getIndexDailyFeed, getIndexPriceReturns } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [master, dailyFeed, priceReturns] = await Promise.all([
      getIndexMaster(),
      getIndexDailyFeed(),
      getIndexPriceReturns(),
    ])
    return NextResponse.json(
      { master, dailyFeed, priceReturns },
      {
        headers: { "Cache-Control": "public, s-maxage=300" },
      }
    )
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge indices]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch indices" },
      { status: 500 }
    )
  }
}
