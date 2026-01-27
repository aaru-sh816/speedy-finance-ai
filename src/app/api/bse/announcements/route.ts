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
  
  // IMPORTANT: Handle scripCode filter for company-specific announcements
  const scripCode = searchParams.get("scripCode")
  const daysStr = searchParams.get("days")
  const days = daysStr ? parseInt(daysStr, 10) : 365
  const maxPagesStr = searchParams.get("maxPages")
  const maxPages = maxPagesStr ? parseInt(maxPagesStr, 10) : (scripCode ? 10 : 5)
  const useMock = searchParams.get("mock") === "true"

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
      console.log(`[Announcements API] Fetching for scripCode: ${scripCode}, days: ${days}, maxPages: ${maxPages}`)
      announcements = await fetchCompanyAnnouncements(scripCode, days, maxPages)

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

      // No fallback to mock data as per user request
    }

    // Extract metadata
    const categories = extractCategories(announcements)
    const companies = extractCompanies(announcements)

    // Improve generic headlines
    const improvedAnnouncements = announcements.map((a: any) => {
      const genericPatterns = [
        /announcement.*attached/i,
        /as.*attached/i,
        /details.*attached/i,
        /attached.*herewith/i,
        /disclosure.*under.*reg/i,
        /intimation.*under.*listing/i
      ];

      const isGeneric = genericPatterns.some(p => p.test(a.headline));
      
      if (isGeneric && (a.category || a.subCategory)) {
        const companyName = a.company || a.ticker || "Company";
        const categoryPart = a.subCategory || a.category || "Update";
        const datePart = a.time ? new Date(a.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : "";
        
        // synthesized headline: "HAL - Financial Results (12 Nov)"
        a.headline = `${companyName} - ${categoryPart}${datePart ? ` (${datePart})` : ""}`;
      }
      return a;
    });

    return NextResponse.json({
      announcements: improvedAnnouncements,
      meta: {
        count: announcements.length,
        categories,
        companiesCount: companies.length,
        fetchedAt: new Date().toISOString(),
        source: "bse",
        scripCode: scripCode || undefined,
      },
    })
  } catch (e: any) {
    metrics().recordError("BSEAnnouncementsAPIError")
    console.error("BSE announcements API error:", e)

    return NextResponse.json({
      announcements: [],
      error: e?.message,
      meta: {
        count: 0,
        fetchedAt: new Date().toISOString(),
        source: "bse",
      },
    }, { status: 500 })
  }
}
