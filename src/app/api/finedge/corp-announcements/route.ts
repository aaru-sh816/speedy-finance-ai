import { NextRequest, NextResponse } from "next/server"
import { getCorpAnnouncements } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol") ?? undefined
    const from_date = searchParams.get("from_date") ?? undefined
    const to_date = searchParams.get("to_date") ?? undefined
    const data = await getCorpAnnouncements({
      symbol,
      from_date,
      to_date,
    })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge corp-announcements]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch corp announcements" },
      { status: 500 }
    )
  }
}
