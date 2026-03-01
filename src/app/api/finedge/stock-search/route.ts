import { NextRequest, NextResponse } from "next/server"
import { stockSearch } from "@/lib/finedge"
import { FinEdgeError } from "@/lib/finedge"

export const dynamic = "force-dynamic"

const VALID_GROUPS = ["sector", "industry", "sub_industry", "macro_sector"] as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const group = searchParams.get("group") as (typeof VALID_GROUPS)[number] | null
    const value = searchParams.get("value") ?? ""
    if (!group || !VALID_GROUPS.includes(group)) {
      return NextResponse.json(
        { error: "group is required and must be sector|industry|sub_industry|macro_sector" },
        { status: 400 }
      )
    }
    if (!value.trim()) {
      return NextResponse.json(
        { error: "value is required" },
        { status: 400 }
      )
    }
    const data = await stockSearch(group, value.trim())
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    })
  } catch (e) {
    if (e instanceof FinEdgeError && e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[FinEdge stock-search]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to search stocks" },
      { status: 500 }
    )
  }
}
