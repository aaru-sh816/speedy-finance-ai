import { NextResponse } from "next/server"
import { metrics } from "@/lib/infra/metrics"
import { getQuoteCacheStats } from "@/lib/quotes/provider"

export async function GET() {
  try {
    const m = metrics().snapshot()
    const cache = getQuoteCacheStats()
    return NextResponse.json({ metrics: m, quoteCache: cache })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to read metrics" }, { status: 500 })
  }
}
