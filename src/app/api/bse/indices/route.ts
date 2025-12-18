import { NextRequest, NextResponse } from "next/server"
import { bseClient } from "@/lib/bse/client"

export const dynamic = 'force-dynamic'
export const revalidate = 120

const VALID_CATEGORIES = [
  'market_cap/broad',
  'sector_and_industry',
  'thematics',
  'strategy',
  'sustainability',
  'volatility',
  'composite',
  'government',
  'corporate',
  'money_market'
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get("category") || "market_cap/broad"

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { 
        error: "Invalid category",
        validCategories: VALID_CATEGORIES 
      },
      { status: 400 }
    )
  }

  try {
    const isHealthy = await bseClient.healthCheck()
    if (!isHealthy) {
      return NextResponse.json(
        { error: "BSE service unavailable" },
        { status: 503 }
      )
    }

    const indices = await bseClient.getIndices(category)

    return NextResponse.json({
      success: true,
      category,
      data: indices,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error(`Indices API error for ${category}:`, error)
    return NextResponse.json(
      { 
        error: "Failed to fetch indices",
        message: error?.message 
      },
      { status: 500 }
    )
  }
}
