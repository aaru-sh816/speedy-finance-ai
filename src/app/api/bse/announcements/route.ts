import { NextResponse } from "next/server"
import { fetchAllBSEAnnouncements, fetchCompanyAnnouncements, extractCategories, extractCompanies } from "@/lib/bse/fetcher"
import { generateMockAnnouncements } from "@/lib/bse/mockData"
import { metrics } from "@/lib/infra/metrics"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const fromDateStr = searchParams.get("fromDate")
  const toDateStr = searchParams.get("toDate")
  const category = searchParams.get("category") || undefined
  const maxPagesStr = searchParams.get("maxPages")
  const maxPages = maxPagesStr ? parseInt(maxPagesStr, 10) : 5
  const useMock = searchParams.get("mock") === "true"
  
  // IMPORTANT: Handle scripCode filter for company-specific announcements
  const scripCode = searchParams.get("scripCode")

  // Parse dates if provided
  const fromDate = fromDateStr ? new Date(fromDateStr) : undefined
  const toDate = toDateStr ? new Date(toDateStr) : undefined

  try {
    let announcements

    if (useMock) {
      // Use mock data for testing
      announcements = generateMockAnnouncements(fromDate, toDate)
      
      // Filter by scripCode if provided
      if (scripCode) {
        announcements = announcements.filter(a => a.scripCode === scripCode)
      }
    } else if (scripCode) {
      // Fetch company-specific announcements
      console.log(`[Announcements API] Fetching for scripCode: ${scripCode}`)
      announcements = await fetchCompanyAnnouncements(scripCode, 30)
      
      // Fall back to mock data if no results
      if (announcements.length === 0) {
        console.log(`[Announcements API] No data for ${scripCode}, using mock`)
        const mockData = generateMockAnnouncements(fromDate, toDate)
        announcements = mockData.filter(a => a.scripCode === scripCode)
        
        // If no matching mock data, use first few items with modified scripCode
        if (announcements.length === 0) {
          announcements = mockData.slice(0, 5).map(a => ({ ...a, scripCode }))
        }
      }
    } else {
      // Fetch all announcements
      announcements = await fetchAllBSEAnnouncements({
        fromDate,
        toDate,
        category,
        maxPages,
      })

      // Fall back to mock data if no results (BSE API might be blocking)
      if (announcements.length === 0) {
        console.log("[Announcements API] BSE API returned no data, using mock")
        announcements = generateMockAnnouncements(fromDate, toDate)
      }
    }

    // Extract metadata
    const categories = extractCategories(announcements)
    const companies = extractCompanies(announcements)

    return NextResponse.json({
      announcements,
      meta: {
        count: announcements.length,
        categories,
        companiesCount: companies.length,
        fetchedAt: new Date().toISOString(),
        source: useMock || announcements[0]?.id?.startsWith("mock") ? "mock" : "bse",
        scripCode: scripCode || undefined,
      },
    })
  } catch (e: any) {
    metrics().recordError("BSEAnnouncementsAPIError")
    console.error("BSE announcements API error:", e)

    // Return mock data on error
    let announcements = generateMockAnnouncements()
    
    // Filter by scripCode if provided
    if (scripCode) {
      const filtered = announcements.filter(a => a.scripCode === scripCode)
      if (filtered.length > 0) {
        announcements = filtered
      } else {
        announcements = announcements.slice(0, 5).map(a => ({ ...a, scripCode }))
      }
    }
    
    const categories = extractCategories(announcements)

    return NextResponse.json({
      announcements,
      meta: {
        count: announcements.length,
        categories,
        companiesCount: 15,
        fetchedAt: new Date().toISOString(),
        source: "mock",
        error: e?.message,
        scripCode: scripCode || undefined,
      },
    })
  }
}
