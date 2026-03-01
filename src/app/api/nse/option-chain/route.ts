import { NextRequest, NextResponse } from "next/server";
import {
  getNseExpiryDatesV3,
  getNseOptionChainV3FromApi,
  getNseCompiledOptionChainFromApi,
  getNseMaxPainFromApi,
} from "@/lib/nse-bse/unified-market";

export const dynamic = "force-dynamic";

const VALID_SYMBOL = /^[A-Z0-9&.-]{1,30}$/;

/**
 * GET /api/nse/option-chain?symbol=NIFTY
 * GET /api/nse/option-chain?symbol=NIFTY&expiry=2025-02-27
 * GET /api/nse/option-chain?symbol=NIFTY&expiry=2025-02-27&compiled=1
 * GET /api/nse/option-chain?symbol=NIFTY&expiry=2025-02-27&maxpain=1
 *
 * NSE option chain V3 (expiries, raw chain, compiled analytics, max pain) via nse-bse-api.
 * Same data source as nse-bse-mcp tools: nse_get_expiry_dates, nse_option_chain, nse_compile_option_chain, nse_calculate_max_pain.
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim()?.toUpperCase();
  const expiry = request.nextUrl.searchParams.get("expiry")?.trim();
  const compiled = request.nextUrl.searchParams.get("compiled") === "1" || request.nextUrl.searchParams.get("compiled") === "true";
  const maxpainOnly = request.nextUrl.searchParams.get("maxpain") === "1" || request.nextUrl.searchParams.get("maxpain") === "true";

  if (!symbol) {
    return NextResponse.json(
      {
        error: "Missing symbol",
        example: "?symbol=NIFTY or ?symbol=NIFTY&expiry=2025-02-27&compiled=1",
      },
      { status: 400 }
    );
  }
  if (!VALID_SYMBOL.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format" }, { status: 400 });
  }

  try {
    if (maxpainOnly && expiry) {
      const maxPain = await getNseMaxPainFromApi(symbol, expiry);
      return NextResponse.json({
        success: true,
        symbol,
        expiry,
        maxPain: maxPain ?? undefined,
        source: "nse-bse-api",
        fetchedAt: new Date().toISOString(),
      });
    }

    if (compiled && expiry) {
      const data = await getNseCompiledOptionChainFromApi(symbol, expiry);
      return NextResponse.json({
        success: true,
        symbol,
        expiry,
        compiled: data ?? undefined,
        source: "nse-bse-api",
        fetchedAt: new Date().toISOString(),
      });
    }

    if (expiry) {
      const chain = await getNseOptionChainV3FromApi({ symbol, expiry });
      const expiries = await getNseExpiryDatesV3(symbol);
      return NextResponse.json({
        success: true,
        symbol,
        expiry,
        optionChain: chain ?? undefined,
        expiries,
        source: "nse-bse-api",
        fetchedAt: new Date().toISOString(),
      });
    }

    const expiries = await getNseExpiryDatesV3(symbol);
    return NextResponse.json({
      success: true,
      symbol,
      expiries,
      hint: "Add &expiry=YYYY-MM-DD for option chain; &compiled=1 for ATM/max pain/PCR/OI",
      source: "nse-bse-api",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[NSE option-chain] Error:", e);
    return NextResponse.json(
      { error: "Failed to fetch option chain", details: String(e) },
      { status: 500 }
    );
  }
}
