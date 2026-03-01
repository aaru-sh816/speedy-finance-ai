import { NextResponse } from "next/server"
import { getNseMarketStatusFromApi } from "@/lib/nse-bse/unified-market"

export const dynamic = "force-dynamic"
export const revalidate = 60

/**
 * GET /api/market/status
 * Returns NSE market status (open/closed, etc.) via nse-bse-api.
 * On failure returns 200 with empty data so the UI can degrade gracefully (no badge).
 */
export async function GET() {
  try {
    const data = await getNseMarketStatusFromApi()
    return NextResponse.json(
      {
        success: true,
        data: data ?? [],
        source: "nse-bse-api",
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    )
  } catch (e) {
    console.error("[Market status] Error:", e)
    return NextResponse.json(
      { success: false, error: "Failed to fetch market status", data: [] },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=30" },
      }
    )
  }
}
