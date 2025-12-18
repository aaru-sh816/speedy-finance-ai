import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const bseServiceUrl = process.env.BSE_SERVICE_URL
  const testPdfUrl = "https://www.bseindia.com/xml-data/corpfiling/AttachLive/d15b7797-6b99-4123-a2c6-b65f96e54cc2.pdf"
  
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    bseServiceUrl: bseServiceUrl ? "SET: " + bseServiceUrl : "NOT SET",
    testPdfUrl,
  }
  
  if (!bseServiceUrl) {
    result.error = "BSE_SERVICE_URL not configured"
    return NextResponse.json(result, { status: 500 })
  }
  
  // Test connection to Render
  try {
    const healthResponse = await fetch(`${bseServiceUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    })
    const healthData = await healthResponse.json()
    result.renderHealth = healthData
  } catch (e: any) {
    result.renderHealthError = e.message
  }
  
  // Test PDF extraction
  try {
    const pdfResponse = await fetch(`${bseServiceUrl}/api/pdf/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: testPdfUrl }),
      signal: AbortSignal.timeout(60000),
    })
    
    if (pdfResponse.ok) {
      const pdfData = await pdfResponse.json()
      result.pdfExtraction = {
        success: pdfData.success,
        length: pdfData.length,
        library: pdfData.library,
        textPreview: pdfData.text?.substring(0, 200),
      }
    } else {
      result.pdfExtractionError = `HTTP ${pdfResponse.status}`
    }
  } catch (e: any) {
    result.pdfExtractionError = e.message
  }
  
  return NextResponse.json(result)
}
