import { NextResponse } from "next/server"
import { fetchAllBSEAnnouncements, fetchCompanyAnnouncements, extractCategories, extractCompanies } from "@/lib/bse/fetcher"
import { metrics } from "@/lib/infra/metrics"
import type { BSEAnnouncement } from "@/lib/bse/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const fromDateStr = searchParams.get("fromDate")
  const toDateStr = searchParams.get("toDate")
  const category = searchParams.get("category") || undefined

  const scripCode = searchParams.get("scripCode")
  const daysStr = searchParams.get("days")
  const days = daysStr ? parseInt(daysStr, 10) : 365
  const maxPagesStr = searchParams.get("maxPages")
  const maxPages = maxPagesStr ? parseInt(maxPagesStr, 10) : (scripCode ? 10 : 5)

  let fromDate = fromDateStr ? new Date(fromDateStr) : undefined
  let toDate = toDateStr ? new Date(toDateStr) : undefined
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    ;[fromDate, toDate] = [toDate, fromDate]
  }

  try {
    let announcements: BSEAnnouncement[]

    if (scripCode) {
      announcements = await fetchCompanyAnnouncements(scripCode, days, maxPages)
    } else {
      announcements = await fetchAllBSEAnnouncements({
        fromDate,
        toDate,
        category,
        maxPages,
      })
    }

    const categories = extractCategories(announcements)
    const companies = extractCompanies(announcements)

    const improvedAnnouncements = announcements.map((a: BSEAnnouncement) => {
      const genericPatterns = [
        /announcement.*attached/i,
        /as.*attached/i,
        /details.*attached/i,
        /attached.*herewith/i,
        /disclosure.*under.*reg/i,
        /intimation.*under.*listing/i
      ]
      const isGeneric = genericPatterns.some(p => p.test(a.headline))
      if (isGeneric && (a.category || a.subCategory)) {
        const companyName = a.company || a.ticker || "Company"
        const categoryPart = a.subCategory || a.category || "Update"
        const datePart = a.time ? new Date(a.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ""
        a.headline = `${companyName} - ${categoryPart}${datePart ? ` (${datePart})` : ""}`
      }
      return a
    })

    return NextResponse.json({
      announcements: improvedAnnouncements,
      meta: {
        count: announcements.length,
        categories,
        companiesCount: companies.length,
        fetchedAt: new Date().toISOString(),
        source: "nse-bse-api",
        scripCode: scripCode || undefined,
      },
    })
  } catch (e: unknown) {
    metrics().recordError("BSEAnnouncementsAPIError")
    console.error("BSE announcements API error:", e)
    return NextResponse.json(
      {
        announcements: [],
        error: (e as Error)?.message,
        meta: {
          count: 0,
          fetchedAt: new Date().toISOString(),
          source: "nse-bse-api",
        },
      },
      { status: 500 }
    )
  }
}
