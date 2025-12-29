import { NextRequest, NextResponse } from "next/server"
import { bseClient } from "@/lib/bse/client"

export const dynamic = 'force-dynamic'
export const revalidate = 30

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const scripCode = searchParams.get("scripCode")

  if (!scripCode) {
    return NextResponse.json(
      { error: "scripCode parameter is required" },
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

    const quote = await bseClient.getQuote(scripCode)

    return NextResponse.json({
      success: true,
      data: quote,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      // Reduced noise: log as info instead of warn for common timeouts
      console.info(`Enhanced quote API timeout for ${scripCode}`)
      return NextResponse.json({ error: "Request timeout" }, { status: 504 })
    }
    // Log as warning instead of error for individual quote failures
    console.warn(`Enhanced quote API error for ${scripCode}:`, error.message || error)
    return NextResponse.json(
      { 
        error: "Failed to fetch enhanced quote",
        message: error?.message 
      },
      { status: 500 }
    )
  }
}
