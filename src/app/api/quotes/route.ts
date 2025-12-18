import { NextResponse } from "next/server"
import { batcher } from "@/lib/quotes/batcher"
import { metrics } from "@/lib/infra/metrics"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 })
  }
  try {
    const q = await batcher().enqueue(symbol, 50)
    return NextResponse.json(q)
  } catch (e: any) {
    metrics().recordError(e?.name || "QuoteGETError")
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const symbols: string[] = Array.isArray(body?.symbols) ? body.symbols : []
    const uniq = Array.from(new Set(symbols.map((s) => (s || "").trim().toUpperCase()).filter(Boolean)))
    if (uniq.length === 0) return NextResponse.json([])

    const results = await Promise.all(
      uniq.map((s) => batcher().enqueue(s, 50))
    )
    // Map back to requested order
    const bySym = new Map<string, any>()
    uniq.forEach((s, i) => bySym.set(s, results[i]))
    const ordered = symbols.map((s) => bySym.get((s || "").trim().toUpperCase()) ?? null)
    return NextResponse.json(ordered)
  } catch (e: any) {
    metrics().recordError(e?.name || "QuotePOSTError")
    return NextResponse.json({ error: "Failed to fetch batch quotes" }, { status: 500 })
  }
}
