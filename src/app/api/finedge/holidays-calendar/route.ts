import { NextResponse } from "next/server"
import { getHolidaysCalendar } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getHolidaysCalendar()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=86400" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge holidays-calendar]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch holidays calendar" },
      { status: 500 }
    )
  }
}
