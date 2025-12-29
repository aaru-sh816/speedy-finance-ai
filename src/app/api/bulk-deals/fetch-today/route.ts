import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:8080"
  
  try {
    const response = await fetch(`${bseServiceUrl}/api/bulk-deals/database/fetch-today`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000), // 60 second timeout for scraping
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error("[FetchToday] Python service error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch today's BSE deals" },
        { status: 500 }
      )
    }
    
    const data = await response.json()
    console.log("[FetchToday] Result:", data)
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[FetchToday] Error:", error.message)
    return NextResponse.json(
      { success: false, error: error.message || "Service unavailable" },
      { status: 500 }
    )
  }
}
