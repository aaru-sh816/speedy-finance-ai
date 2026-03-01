import { NextResponse } from "next/server"
import { getBseAdvanceDeclineFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"
export const revalidate = 60

/**
 * GET /api/bse/advance-decline
 * BSE advance/decline data via nse-bse-api.
 */
export async function GET() {
  try {
    const data = await getBseAdvanceDeclineFromApi()
    return NextResponse.json({
      success: true,
      data,
      source: "nse-bse-api",
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error("[BSE advance-decline] Error:", e)
    return NextResponse.json(
      { success: false, data: [], error: (e as Error).message },
      { status: 500 }
    )
  }
}
