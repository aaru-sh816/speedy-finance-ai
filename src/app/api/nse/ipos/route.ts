import { NextResponse } from "next/server"
import { getNseIpoListCurrentFromApi, getNseIpoListUpcomingFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"
export const revalidate = 300

/**
 * GET /api/nse/ipos
 * NSE current and upcoming IPOs via nse-bse-api.
 */
export async function GET() {
  try {
    const [current, upcoming] = await Promise.all([
      getNseIpoListCurrentFromApi(),
      getNseIpoListUpcomingFromApi(),
    ])
    return NextResponse.json({
      success: true,
      current,
      upcoming,
      source: "nse-bse-api",
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error("[NSE IPOs] Error:", e)
    return NextResponse.json(
      { success: false, current: [], upcoming: [], error: (e as Error).message },
      { status: 500 }
    )
  }
}
