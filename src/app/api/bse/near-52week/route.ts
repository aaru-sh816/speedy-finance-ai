import { NextRequest, NextResponse } from "next/server";
import { getBseNear52WeekFromApi } from "@/lib/nse-bse/unified-market";

export const dynamic = "force-dynamic";

/**
 * GET /api/bse/near-52week
 * GET /api/bse/near-52week?by=group&name=A
 * GET /api/bse/near-52week?by=index&name=S&P BSE SENSEX
 *
 * BSE stocks near 52-week high/low via nse-bse-api.
 * Same as nse-bse-mcp tool bse_near_52week.
 */
export async function GET(request: NextRequest) {
  const by = request.nextUrl.searchParams.get("by")?.trim();
  const name = request.nextUrl.searchParams.get("name")?.trim();

  const options: { by?: "group" | "index"; name?: string } = {};
  if (by === "group" || by === "index") options.by = by;
  if (name) options.name = name;
  // Default: Group A when no params (same as nse-bse-mcp)
  if (!options.by && !options.name) options.by = "group";
  if (options.by === "group" && !options.name) options.name = "A";

  try {
    const data = await getBseNear52WeekFromApi(options);
    return NextResponse.json({
      success: true,
      highs: data.highs ?? [],
      lows: data.lows ?? [],
      data,
      source: "nse-bse-api",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[BSE near-52week] Error:", e);
    return NextResponse.json(
      { error: "Failed to fetch near 52-week data", details: String(e) },
      { status: 500 }
    );
  }
}
