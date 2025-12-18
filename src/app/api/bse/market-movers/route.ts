import { NextRequest, NextResponse } from "next/server"
import { bseClient } from "@/lib/bse/client"

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type") || "gainers"

  try {
    const isHealthy = await bseClient.healthCheck()
    if (!isHealthy) {
      return NextResponse.json(
        { error: "BSE service unavailable" },
        { status: 503 }
      )
    }

    let data
    if (type === "gainers") {
      data = await bseClient.getTopGainers()
    } else if (type === "losers") {
      data = await bseClient.getTopLosers()
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'gainers' or 'losers'" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      type,
      data,
      count: data.length,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error(`Market movers API error (${type}):`, error)
    return NextResponse.json(
      { 
        error: "Failed to fetch market movers",
        message: error?.message 
      },
      { status: 500 }
    )
  }
}
