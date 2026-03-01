import { NextResponse } from "next/server"
import { resolveNseSymbol, resolveBseScripCode } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

function isBseScripCode(s: string): boolean {
  return /^\d{5,6}$/.test(String(s).trim())
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ input: string }> }
) {
  try {
    const { input } = await params
    if (!input) {
      return NextResponse.json(
        { error: "input is required" },
        { status: 400 }
      )
    }
    const trimmed = String(input).trim()
    const bseCode = isBseScripCode(trimmed)
      ? trimmed
      : await resolveBseScripCode(trimmed)
    const nseSymbol = !isBseScripCode(trimmed)
      ? trimmed.toUpperCase()
      : await resolveNseSymbol(trimmed)
    return NextResponse.json({
      input: trimmed,
      nseSymbol: nseSymbol ?? trimmed,
      bseCode: bseCode ?? null,
    }, {
      headers: { "Cache-Control": "public, s-maxage=86400" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge lookup]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to lookup symbol" },
      { status: 500 }
    )
  }
}
