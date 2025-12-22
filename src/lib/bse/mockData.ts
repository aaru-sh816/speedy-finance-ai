import type { BSEAnnouncement } from "./types"

// Mock data for development when BSE API is unavailable
export function generateMockAnnouncements(fromDate?: Date, toDate?: Date): BSEAnnouncement[] {
  const now = Date.now()
  const startDay = fromDate ? fromDate.getTime() : now - (12 * 60 * 60 * 1000)
  const endDay = toDate ? toDate.getTime() : now
  
  const mockCompanies = [
    { ticker: "RELIANCE", scripCode: "500325", company: "Reliance Industries Ltd" },
    { ticker: "TCS", scripCode: "532540", company: "Tata Consultancy Services Ltd" },
    { ticker: "HDFCBANK", scripCode: "500180", company: "HDFC Bank Ltd" },
    { ticker: "INFY", scripCode: "500209", company: "Infosys Ltd" },
    { ticker: "ICICIBANK", scripCode: "532174", company: "ICICI Bank Ltd" },
    { ticker: "HINDUNILVR", scripCode: "500696", company: "Hindustan Unilever Ltd" },
    { ticker: "SBIN", scripCode: "500112", company: "State Bank of India" },
    { ticker: "BHARTIARTL", scripCode: "532454", company: "Bharti Airtel Ltd" },
    { ticker: "BAJFINANCE", scripCode: "500034", company: "Bajaj Finance Ltd" },
    { ticker: "WIPRO", scripCode: "507685", company: "Wipro Ltd" },
    { ticker: "STUDDS", scripCode: "534033", company: "Studds Accessories Ltd" },
    { ticker: "TATAMOTORS", scripCode: "500570", company: "Tata Motors Ltd" },
    { ticker: "ADANIENT", scripCode: "512599", company: "Adani Enterprises Ltd" },
    { ticker: "MARUTI", scripCode: "532500", company: "Maruti Suzuki India Ltd" },
    { ticker: "SUNPHARMA", scripCode: "524715", company: "Sun Pharmaceutical Industries Ltd" },
  ]

  const categories = [
    { name: "General", sub: "Acquisition", impact: "high" as const },
    { name: "Outcome", sub: "Financial Results", impact: "high" as const },
    { name: "Board Meeting", sub: "", impact: "medium" as const },
    { name: "General", sub: "Analyst/Investor Meet", impact: "low" as const },
    { name: "Outcome", sub: "Board Meeting Outcome", impact: "medium" as const },
    { name: "AGM/EGM", sub: "", impact: "medium" as const },
    { name: "General", sub: "Credit Rating", impact: "medium" as const },
    { name: "General", sub: "General", impact: "low" as const },
  ]

  const headlines = [
    "Announcement under Regulation 30 (LODR) - Acquisition",
    "Outcome :: Financial Results - Quarterly Results",
    "Board Meeting Intimation under Regulation 29",
    "Announcement under Regulation 30 - Analyst / Investor Meet",
    "Outcome :: Board Meeting - Appointment of Director",
    "Notice of Annual General Meeting",
    "Credit Rating Update - CRISIL Reaffirms Rating",
    "Intimation under Regulation 30 - General Updates",
    "Announcement under Regulation 30 - Strategic Investment",
    "Board Meeting Outcome - Dividend Declaration",
    "Trading Window Closure Intimation",
    "Shareholding Pattern for Quarter Ended",
    "Outcome :: Allotment of Securities",
    "Intimation of Change in Key Managerial Personnel",
    "Compliance Certificate under SEBI Regulations",
  ]

  const announcements: BSEAnnouncement[] = []
  const count = fromDate && toDate ? 45 : 32 // Vary count slightly to show it's working

  for (let i = 0; i < count; i++) {
    const company = mockCompanies[i % mockCompanies.length]
    const catInfo = categories[i % categories.length]
    const headline = headlines[i % headlines.length]
    
    // Distribute across the range
    const timestamp = startDay + (Math.random() * (endDay - startDay))

    announcements.push({
      id: `mock-${1000 + i}`,
      ticker: company.ticker,
      scripCode: company.scripCode,
      company: company.company,
      headline: headline,
      summary: `${company.company} has submitted ${headline.toLowerCase()}. This filing is in compliance with SEBI (LODR) Regulations, 2015.`,
      category: catInfo.name,
      subCategory: catInfo.sub,
      impact: catInfo.impact,
      time: new Date(timestamp).toISOString(),
      pdfUrl: i % 3 === 0 ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/mock-${i}.pdf` : null,
      source: "BSE",
      tags: Array.from(new Set([catInfo.name.toLowerCase().replace(/\s+/g, "-"), catInfo.sub?.toLowerCase().replace(/\s+/g, "-") || "general"].filter(Boolean))),
      isCritical: i % 10 === 0,
    })
  }

  // Sort by time descending
  return announcements.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}
