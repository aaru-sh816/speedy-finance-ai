import { NextResponse } from "next/server"
import { ensureIndexed, embedTexts, topK } from "@/lib/ai/vector"

export const dynamic = "force-dynamic"

// Use a vision-capable model for native PDF understanding
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

// Cache for uploaded PDF file IDs (pdfUrl -> { fileId, timestamp })
const pdfFileCache = new Map<string, { fileId: string; timestamp: number }>()
const PDF_FILE_TTL = 30 * 60 * 1000 // 30 minutes

// Upload PDF to OpenAI Files API for native PDF understanding
async function uploadPdfToOpenAI(pdfUrl: string, openaiKey: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = pdfFileCache.get(pdfUrl)
    if (cached && Date.now() - cached.timestamp < PDF_FILE_TTL) {
      return cached.fileId
    }

    // Fetch the PDF
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/pdf",
      },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`)
    
    const arrayBuf = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    
    // Extract filename from URL
    const urlParts = pdfUrl.split("/")
    const filename = urlParts[urlParts.length - 1] || "document.pdf"
    
    // Create a Blob/File for upload
    const blob = new Blob([buffer], { type: "application/pdf" })
    const formData = new FormData()
    formData.append("file", blob, filename)
    formData.append("purpose", "user_data")
    
    // Upload to OpenAI Files API
    const uploadResponse = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: formData,
    })
    
    if (!uploadResponse.ok) {
      const err = await uploadResponse.text()
      console.error("OpenAI file upload failed:", err)
      return null
    }
    
    const uploadResult = await uploadResponse.json()
    const fileId = uploadResult.id
    
    // Cache the file ID
    pdfFileCache.set(pdfUrl, { fileId, timestamp: Date.now() })
    console.log("PDF uploaded to OpenAI:", fileId)
    
    return fileId
  } catch (e) {
    console.error("uploadPdfToOpenAI failed:", e)
    return null
  }
}

interface ChatRequest {
  message: string
  announcement: {
    id: string
    company: string
    ticker: string
    scripCode: string
    headline: string
    summary?: string
    category: string
    subCategory?: string
    time: string
    impact?: string
    pdfUrl?: string
  }
  history: Array<{ role: "user" | "assistant"; content: string }>
  includePdfAnalysis?: boolean
  includeRelatedAnnouncements?: boolean
}

async function extractPdfPages(pdfUrl: string): Promise<{ page: number; text: string }[]> {
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/pdf",
      },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`)
    const arrayBuf = await response.arrayBuffer()
    
    // Use pdf2json for Node.js PDF text extraction
    const PDFParser = (await import("pdf2json")).default
    
    const pdfParser = new PDFParser()
    
    const textPromise = new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          // Extract text from all pages
          const pages = pdfData?.Pages || []
          const textParts: string[] = []
          
          for (const page of pages) {
            const texts = page.Texts || []
            for (const textItem of texts) {
              const runs = textItem.R || []
              for (const run of runs) {
                if (run.T) {
                  textParts.push(decodeURIComponent(run.T))
                }
              }
            }
          }
          
          resolve(textParts.join(" "))
        } catch (e) {
          reject(e)
        }
      })
      
      pdfParser.on("pdfParser_dataError", (err: any) => {
        reject(err)
      })
    })
    
    // pdf2json expects Buffer
    pdfParser.parseBuffer(Buffer.from(arrayBuf))
    const fullText = await textPromise
    const cleanText = fullText.replace(/\s+/g, " ").trim()
    
    if (!cleanText) {
      console.log("extractPdfPages: No text found in PDF")
      return []
    }
    
    // Return as single page
    const pages = [{ page: 1, text: cleanText }]
    
    console.log("extractPdfPages: success,", cleanText.length, "chars")
    return pages
  } catch (e) {
    console.error("extractPdfPages failed:", e)
    return []
  }
}

// Types for deterministic field extraction
type BuybackFacts = {
  recordDate?: { value: string; page: number }
  buybackPrice?: { value: string; page: number }
}

type CapacityFacts = {
  currentGroupCapacityMw?: { value: string; page: number }
  increasedGroupCapacityMw?: { value: string; page: number }
}

// Extract buyback-related fields from PDF text
function extractBuybackFacts(pages: { page: number; text: string }[]): BuybackFacts {
  const facts: BuybackFacts = {}

  for (const p of pages) {
    const text = p.text
    if (!facts.recordDate) {
      const m = text.match(/Record Date\s*[:\-]?\s*([A-Za-z0-9,\-\/ ]{3,40})/i)
      if (m) {
        facts.recordDate = { value: m[1].trim(), page: p.page }
      }
    }
    if (!facts.buybackPrice) {
      const m = text.match(/Buy[\-\s]?back Price\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i)
      if (m) {
        facts.buybackPrice = { value: m[1].trim(), page: p.page }
      }
    }

    if (facts.recordDate && facts.buybackPrice) break
  }

  return facts
}

// Extract capacity-related fields from PDF text (for power/energy companies like NTPC, NGEL)
function extractCapacityFacts(pages: { page: number; text: string }[]): CapacityFacts {
  const facts: CapacityFacts = {}

  for (const p of pages) {
    const text = p.text

    // Match: "current commercial capacity of ... stands at X MW"
    if (!facts.currentGroupCapacityMw) {
      const m = text.match(/current\s+(?:commercial\s+)?capacity\s+of\s+[A-Za-z\s]+(?:Group|Limited)?\s+stands\s+at\s+([\d,]+(?:\.\d+)?)\s*MW/i)
      if (m) {
        facts.currentGroupCapacityMw = { value: m[1].trim(), page: p.page }
      }
    }

    // Match: "total installed capacity of the ... Group will increase to X MW"
    if (!facts.increasedGroupCapacityMw) {
      const m2 = text.match(/total\s+installed\s+capacity\s+of\s+(?:the\s+)?[A-Za-z\s]+Group\s+will\s+increase\s+to\s+([\d,]+(?:\.\d+)?)\s*MW/i)
      if (m2) {
        facts.increasedGroupCapacityMw = { value: m2[1].trim(), page: p.page }
      }
    }

    // Fallback: try simpler patterns if the above don't match
    if (!facts.increasedGroupCapacityMw) {
      const m3 = text.match(/increase\s+to\s+([\d,]+(?:\.\d+)?)\s*MW/i)
      if (m3) {
        facts.increasedGroupCapacityMw = { value: m3[1].trim(), page: p.page }
      }
    }

    if (!facts.currentGroupCapacityMw) {
      const m4 = text.match(/stands\s+at\s+([\d,]+(?:\.\d+)?)\s*MW/i)
      if (m4) {
        facts.currentGroupCapacityMw = { value: m4[1].trim(), page: p.page }
      }
    }

    if (facts.currentGroupCapacityMw && facts.increasedGroupCapacityMw) break
  }

  return facts
}

// Types for financial results extraction
type ResultsFacts = {
  revenue?: { value: string; page: number }
  pat?: { value: string; page: number }
  eps?: { value: string; page: number }
  period?: { value: string; page: number }
}

// Extract financial results fields from PDF text
function extractResultsFacts(pages: { page: number; text: string }[]): ResultsFacts {
  const facts: ResultsFacts = {}

  for (const p of pages) {
    const text = p.text

    // Match revenue/turnover patterns
    if (!facts.revenue) {
      const m = text.match(/(?:Total\s+)?(?:Revenue|Turnover|Income)\s+(?:from\s+Operations\s+)?[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|Lakh|Mn|Million)?/i)
      if (m) {
        facts.revenue = { value: m[1].trim(), page: p.page }
      }
    }

    // Match PAT/Net Profit patterns
    if (!facts.pat) {
      const m = text.match(/(?:Profit\s+After\s+Tax|PAT|Net\s+Profit)\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|Lakh|Mn|Million)?/i)
      if (m) {
        facts.pat = { value: m[1].trim(), page: p.page }
      }
    }

    // Match EPS patterns
    if (!facts.eps) {
      const m = text.match(/(?:EPS|Earnings\s+Per\s+Share)\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i)
      if (m) {
        facts.eps = { value: m[1].trim(), page: p.page }
      }
    }

    // Match quarter/period patterns
    if (!facts.period) {
      const m = text.match(/(Q[1-4]\s*FY\s*\d{2,4}|Quarter\s+ended\s+[A-Za-z]+\s+\d{4}|(?:First|Second|Third|Fourth)\s+Quarter)/i)
      if (m) {
        facts.period = { value: m[1].trim(), page: p.page }
      }
    }

    if (facts.revenue && facts.pat && facts.eps && facts.period) break
  }

  return facts
}

// Helper to fetch related announcements
async function fetchRelatedAnnouncements(scripCode: string, currentId: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/bse/announcements?scripCode=${scripCode}&maxPages=1`)
    if (!res.ok) return ""
    
    const data = await res.json()
    const related = (data.announcements || [])
      .filter((a: any) => a.id !== currentId)
      .slice(0, 3)
    
    if (related.length === 0) return ""
    
    return `\n\nRECENT ANNOUNCEMENTS FROM SAME COMPANY:\n${related.map((a: any, i: number) => 
      `${i + 1}. [${a.time}] ${a.headline} (${a.category})`
    ).join("\n")}`
  } catch (e) {
    console.error("Failed to fetch related announcements:", e)
    return ""
  }
}

// Helper to extract key info from PDF URL context
function getPdfContext(pdfUrl?: string): string {
  if (!pdfUrl) return ""
  
  return `\n\nPDF DOCUMENT AVAILABLE:
- Document URL: ${pdfUrl}
- Note: User can view the full document for detailed information
- Consider: The announcement may contain tables, financial data, or legal disclosures in the PDF`
}

const SYSTEM_PROMPT = `You are Speedy AI, a strictly data-driven assistant for Indian stock market announcements.

Your role:
- Work ONLY with the structured announcement fields and the text of the provided PDF and related announcements.
- Do not use external market knowledge, opinions, or assumptions.

Your capabilities:
1. Extract and summarize key facts, numbers, dates, and entities that are explicitly present in the announcement/PDF.
2. Highlight important clauses, conditions, and disclosures quoted or clearly paraphrased from the document.
3. Compare or connect multiple provided announcements only when the relationship is explicitly visible in the data.

Strict data-only guidelines:
- Every statement you make MUST be directly supported by the provided data (announcement fields, PDF text, or related announcement text).
- Do NOT infer or guess stock price impact, sentiment (positive/negative), or market reaction unless those words appear explicitly in the provided text.
- Do NOT provide any investment advice, trading recommendations, or suggestions on what the user should do.
- Do NOT add general market/industry context or background that is not explicitly present in the data.
- You must NOT introduce any number, date, name, or location that does not appear in either the structured announcement fields or the provided PDF citation snippets.
- If the user asks about something that is not stated in the provided data, answer: "This is not specified in the provided announcement/PDF data." Do not speculate.
- You may format the answer in clear bullet points and sections, but content must remain fully grounded in the data.
- When PDF citations are provided, treat them as the PRIMARY factual source.

Formatting:
- Be concise but complete with respect to the data.
- Use bullet points for clarity.
- Highlight key numbers, dates, and names.
- Format responses clearly with proper spacing and structure.`

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json()
    const { message, announcement, history = [] } = body

    if (!message || !announcement) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json(
        { 
          response: "⚠️ OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file to enable AI chat functionality.",
          error: "Missing API key" 
        },
        { status: 200 }
      )
    }

    let buybackFacts: BuybackFacts | null = null
    let capacityFacts: CapacityFacts | null = null
    let resultsFacts: ResultsFacts | null = null

    const lowerMsg = message.toLowerCase()

    // Build context about the announcement
    const pdfContext = getPdfContext(announcement.pdfUrl)
    const wantsPdfOnly =
      lowerMsg.includes("in this pdf") ||
      lowerMsg.includes("from this pdf") ||
      lowerMsg.includes("in this document") ||
      lowerMsg.includes("from this document")

    const relatedContext = body.includeRelatedAnnouncements !== false && !wantsPdfOnly
      ? await fetchRelatedAnnouncements(announcement.scripCode, announcement.id)
      : ""
    
    let announcementContext = `
CURRENT ANNOUNCEMENT CONTEXT:
- Company: ${announcement.company} (${announcement.ticker})
- BSE Scrip Code: ${announcement.scripCode}
- Category: ${announcement.category}${announcement.subCategory ? ` > ${announcement.subCategory}` : ""}
- Time: ${announcement.time}
- Impact Level: ${announcement.impact || "Unknown"}
- Headline: ${announcement.headline}
${announcement.summary ? `- Summary: ${announcement.summary}` : ""}${pdfContext}${relatedContext}
`

    // RAG: If PDF available, index and retrieve top chunks as citations
    let ragCitations = ""
    const citationItems: { page: number; snippet: string; openUrl: string; score?: number }[] = []
    if (openaiKey && announcement.pdfUrl) {
      try {
        const pages = await extractPdfPages(announcement.pdfUrl)
        if (pages.length > 0) {
          // Extract deterministic facts (buyback, capacity, results) from raw PDF text
          buybackFacts = extractBuybackFacts(pages)
          capacityFacts = extractCapacityFacts(pages)
          resultsFacts = extractResultsFacts(pages)

          await ensureIndexed(announcement.pdfUrl, pages, openaiKey)
          const [qEmb] = await embedTexts(openaiKey, [message])
          const hits = await topK(announcement.pdfUrl, qEmb, 3)
          if (hits.length > 0) {
            ragCitations = `\n\nCITATIONS FROM PDF (relevant snippets):\n${hits.map((h, i) => `${i+1}. [p.${h.page}] ${h.text.slice(0, 220)}... (open: ${announcement.pdfUrl}#page=${h.page})`).join("\n")}`
            for (const h of hits) {
              citationItems.push({
                page: h.page,
                snippet: h.text.slice(0, 220),
                openUrl: `${announcement.pdfUrl}#page=${h.page}`,
                score: h.score,
              })
            }
          }
        }
      } catch (e) {
        console.error("RAG pipeline failed:", e)
      }
    }
    if (ragCitations) announcementContext += ragCitations

    // If we have neither useful announcement text nor any PDF citations, do not call OpenAI
    const hasAnnouncementText = Boolean(announcement.headline || announcement.summary)
    const hasPdfCitations = citationItems.length > 0
    if (!hasAnnouncementText && !hasPdfCitations) {
      return NextResponse.json({
        response: "I could not extract any readable text from this announcement/PDF for your question. This is not specified in the provided announcement/PDF data.",
        pdfUrl: announcement.pdfUrl || null,
        citations: [],
      })
    }

    // Short-circuit for specific deterministic questions using parsed buyback facts
    if (buybackFacts?.recordDate && lowerMsg.includes("record date")) {
      const page = buybackFacts.recordDate.page
      const value = buybackFacts.recordDate.value
      const directCitations = announcement.pdfUrl
        ? [{
            page,
            snippet: `Record Date: ${value}`,
            openUrl: `${announcement.pdfUrl}#page=${page}`,
          }]
        : []

      return NextResponse.json({
        response: `Record Date (from the PDF): ${value}`,
        pdfUrl: announcement.pdfUrl || null,
        citations: directCitations,
      })
    }

    if (buybackFacts?.buybackPrice && (lowerMsg.includes("buyback price") || lowerMsg.includes("buy-back price"))) {
      const page = buybackFacts.buybackPrice.page
      const value = buybackFacts.buybackPrice.value
      const directCitations = announcement.pdfUrl
        ? [{
            page,
            snippet: `Buyback Price: ${value}`,
            openUrl: `${announcement.pdfUrl}#page=${page}`,
          }]
        : []

      return NextResponse.json({
        response: `Buyback Price (from the PDF): ₹${value}`,
        pdfUrl: announcement.pdfUrl || null,
        citations: directCitations,
      })
    }

    // Short-circuit for deterministic capacity questions where values are clearly present in the PDF
    if (capacityFacts) {
      const asksTotalInstalledCapacity =
        lowerMsg.includes("total installed capacity") ||
        lowerMsg.includes("group's total installed capacity") ||
        lowerMsg.includes("groups total installed capacity") ||
        lowerMsg.includes("increase to") ||
        lowerMsg.includes("will increase")

      const asksCurrentCapacity =
        lowerMsg.includes("current capacity") ||
        lowerMsg.includes("current commercial capacity") ||
        lowerMsg.includes("stands at")

      if (capacityFacts.increasedGroupCapacityMw && asksTotalInstalledCapacity) {
        const page = capacityFacts.increasedGroupCapacityMw.page
        const value = capacityFacts.increasedGroupCapacityMw.value
        const directCitations = announcement.pdfUrl
          ? [{
              page,
              snippet: `Total installed capacity of the NGEL Group will increase to ${value} MW`,
              openUrl: `${announcement.pdfUrl}#page=${page}`,
            }]
          : []

        return NextResponse.json({
          response: `According to the PDF, the total installed capacity of the NGEL Group will increase to ${value} MW.`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }

      if (capacityFacts.currentGroupCapacityMw && asksCurrentCapacity) {
        const page = capacityFacts.currentGroupCapacityMw.page
        const value = capacityFacts.currentGroupCapacityMw.value
        const directCitations = announcement.pdfUrl
          ? [{
              page,
              snippet: `The current commercial capacity of the NGEL Group stands at ${value} MW`,
              openUrl: `${announcement.pdfUrl}#page=${page}`,
            }]
          : []

        return NextResponse.json({
          response: `According to the PDF, the current commercial capacity of the NGEL Group stands at ${value} MW.`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }
    }

    // Short-circuit for deterministic financial results questions
    if (resultsFacts) {
      const asksRevenue = lowerMsg.includes("revenue") || lowerMsg.includes("turnover") || lowerMsg.includes("income from operations")
      const asksPat = lowerMsg.includes("pat") || lowerMsg.includes("profit after tax") || lowerMsg.includes("net profit")
      const asksEps = lowerMsg.includes("eps") || lowerMsg.includes("earnings per share")

      const wantsChart =
        lowerMsg.includes("bar chart") ||
        lowerMsg.includes("bar-chart") ||
        (lowerMsg.includes("chart") &&
          (lowerMsg.includes("result") ||
            lowerMsg.includes("financial") ||
            lowerMsg.includes("revenue") ||
            lowerMsg.includes("pat") ||
            lowerMsg.includes("eps")))

      const hasAnyMetric = resultsFacts.revenue || resultsFacts.pat || resultsFacts.eps

      // If user explicitly asks for a bar chart of results, return a markdown table built only from PDF values
      if (wantsChart && hasAnyMetric) {
        const metrics: { label: string; key: keyof ResultsFacts; prefix?: string }[] = [
          { label: "Revenue", key: "revenue", prefix: "₹" },
          { label: "PAT", key: "pat", prefix: "₹" },
          { label: "EPS", key: "eps", prefix: "₹" },
        ]

        let maxNumeric = 0
        const numericValues: Record<string, number> = {}

        for (const m of metrics) {
          const fact = resultsFacts[m.key]
          if (!fact) continue
          const num = parseFloat(fact.value.replace(/,/g, ""))
          if (!isNaN(num)) {
            numericValues[m.label] = num
            if (num > maxNumeric) maxNumeric = num
          }
        }

        let table = "Metric | Value" + (resultsFacts.period?.value ? ` (${resultsFacts.period.value})` : "") + " | Bar\n"
        table += "------ | ----- | ---\n"

        const directCitations: { page: number; snippet: string; openUrl: string }[] = []

        for (const m of metrics) {
          const fact = resultsFacts[m.key]
          if (!fact) continue
          const label = m.label
          const value = fact.value
          const numeric = numericValues[label]
          const barUnits = maxNumeric > 0 && !isNaN(numeric) ? Math.max(1, Math.round((numeric / maxNumeric) * 10)) : 1
          const bar = "█".repeat(barUnits)
          table += `${label} | ${m.prefix || ""}${value}${resultsFacts.period?.value ? ` (${resultsFacts.period.value})` : ""} | ${bar}\n`

          if (announcement.pdfUrl) {
            directCitations.push({
              page: fact.page,
              snippet: `${label}: ${m.prefix || ""}${value}${resultsFacts.period?.value ? ` (${resultsFacts.period.value})` : ""}`,
              openUrl: `${announcement.pdfUrl}#page=${fact.page}`,
            })
          }
        }

        return NextResponse.json({
          response: `According to the PDF, here is a bar-style comparison of the reported financial results:\n\n${table}`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }

      if (resultsFacts.revenue && asksRevenue) {
        const page = resultsFacts.revenue.page
        const value = resultsFacts.revenue.value
        const period = resultsFacts.period?.value || ""
        const directCitations = announcement.pdfUrl
          ? [{
              page,
              snippet: `Revenue: ₹${value}${period ? ` (${period})` : ""}`,
              openUrl: `${announcement.pdfUrl}#page=${page}`,
            }]
          : []

        return NextResponse.json({
          response: `According to the PDF, the Revenue is ₹${value}${period ? ` for ${period}` : ""}.`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }

      if (resultsFacts.pat && asksPat) {
        const page = resultsFacts.pat.page
        const value = resultsFacts.pat.value
        const period = resultsFacts.period?.value || ""
        const directCitations = announcement.pdfUrl
          ? [{
              page,
              snippet: `Profit After Tax (PAT): ₹${value}${period ? ` (${period})` : ""}`,
              openUrl: `${announcement.pdfUrl}#page=${page}`,
            }]
          : []

        return NextResponse.json({
          response: `According to the PDF, the Profit After Tax (PAT) is ₹${value}${period ? ` for ${period}` : ""}.`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }

      if (resultsFacts.eps && asksEps) {
        const page = resultsFacts.eps.page
        const value = resultsFacts.eps.value
        const period = resultsFacts.period?.value || ""
        const directCitations = announcement.pdfUrl
          ? [{
              page,
              snippet: `EPS: ₹${value}${period ? ` (${period})` : ""}`,
              openUrl: `${announcement.pdfUrl}#page=${page}`,
            }]
          : []

        return NextResponse.json({
          response: `According to the PDF, the Earnings Per Share (EPS) is ₹${value}${period ? ` for ${period}` : ""}.`,
          pdfUrl: announcement.pdfUrl || null,
          citations: directCitations,
        })
      }
    }

    // Try to upload PDF to OpenAI for native PDF understanding
    let pdfFileId: string | null = null
    if (announcement.pdfUrl && openaiKey) {
      pdfFileId = await uploadPdfToOpenAI(announcement.pdfUrl, openaiKey)
    }

    // Build messages array with native PDF file input if available
    const userContent: any[] = []
    
    // Add PDF file reference if uploaded successfully
    if (pdfFileId) {
      userContent.push({
        type: "file",
        file: {
          file_id: pdfFileId
        }
      })
    }
    
    // Add the user's text message
    userContent.push({
      type: "text",
      text: message
    })

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + announcementContext },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { 
        role: "user", 
        content: pdfFileId ? userContent : message 
      }
    ]

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 1000,
        temperature: 0,
        presence_penalty: 0,
        frequency_penalty: 0,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API error:", errorData)
      
      if (response.status === 401) {
        return NextResponse.json({
          response: "⚠️ Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env.local file.",
          error: "Invalid API key"
        })
      }
      
      if (response.status === 429) {
        return NextResponse.json({
          response: "⚠️ OpenAI rate limit reached. Please try again in a few moments.",
          error: "Rate limited"
        })
      }

      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content?.trim()

    if (!aiResponse) {
      return NextResponse.json({
        response: "I apologize, but I couldn't generate a response. Please try again.",
        error: "Empty response"
      })
    }

    return NextResponse.json({
      response: aiResponse,
      usage: data.usage,
      pdfUrl: announcement.pdfUrl || null,
      citations: citationItems,
    })

  } catch (error: any) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { 
        response: "❌ An error occurred while processing your request. Please try again.",
        error: error.message 
      },
      { status: 500 }
    )
  }
}
