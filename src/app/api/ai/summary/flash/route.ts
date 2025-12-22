import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { pdfUrl, headline } = await request.json()
    
    if (!pdfUrl) {
      return NextResponse.json({ error: "No PDF URL provided" }, { status: 400 })
    }

    // Call the existing summary API which handles PDF extraction and AI processing
    const summaryRes = await fetch(`${new URL(request.url).origin}/api/ai/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline,
        announcementId: `flash_${Date.now()}`,
        pdfUrl,
        category: "Result"
      })
    })

    const summaryData = await summaryRes.json()

    // Extract KPIs from key insights or summary if available
    const kpis: any = {
      revenue: null,
      pat: null,
      margin: null
    }

    if (summaryData.keyInsights) {
      summaryData.keyInsights.forEach((insight: string) => {
        const lower = insight.toLowerCase()
        if (lower.includes('revenue') || lower.includes('income')) {
          const match = insight.match(/₹?[\d,.]+\s*(Cr|Lakh|Million|Billion)/i)
          if (match) kpis.revenue = match[0]
        }
        if (lower.includes('pat') || lower.includes('profit')) {
          const match = insight.match(/₹?[\d,.]+\s*(Cr|Lakh|Million|Billion)/i)
          if (match) kpis.pat = match[0]
        }
        if (lower.includes('margin')) {
          const match = insight.match(/[\d,.]+\s*%/i)
          if (match) kpis.margin = match[0]
        }
      })
    }

    return NextResponse.json({
      success: true,
      kpis,
      summary: summaryData.simpleSummary,
      sentiment: summaryData.sentiment
    })

  } catch (e: any) {
    console.error("Flash summary error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
