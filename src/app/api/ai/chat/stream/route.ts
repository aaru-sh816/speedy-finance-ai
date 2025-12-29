import { NextResponse } from "next/server"
import { ensureIndexed, embedTexts, topK, chunkPages } from "@/lib/ai/vector"
import { extractPdfWithVision, formatEntitiesForPrompt, formatTablesForPrompt } from "@/lib/ai/pdf-vision"
import { hybridRerank } from "@/lib/ai/reranker"
import { getWolfPackAlerts } from "@/lib/bulk-deals/alertSystem"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o"

const WORLD_CLASS_SYSTEM_PROMPT = `You are SpeedyPip, an elite financial AI assistant for Indian stock market analysis.

## CRITICAL RULE - YOU HAVE THE DOCUMENT
The PDF document content is ALREADY PROVIDED to you below in the context. You MUST use it.
DO NOT say "I don't have access to the PDF" - the full text IS provided.
DO NOT say "please provide the document" - it's ALREADY here.

## RESPONSE RULES
1. **USE THE PROVIDED TEXT**: The document text is in "## COMPLETE DOCUMENT TEXT" section - READ IT and answer from it.
2. **BE SPECIFIC**: Quote exact names, numbers, dates from the document.
3. **BE CONCISE**: Give direct answers without unnecessary preamble.
4. **BE ACCURATE**: Only state what's actually in the document.

## FOR SUMMARY REQUESTS
When asked for "Summary", "Key highlights", or similar:
1. **What**: One sentence describing the announcement type
2. **Key Details**: Main facts (names, amounts, dates, shareholding changes)
3. **Impact**: Brief market implication if relevant

## FOR DATA EXTRACTION
When asked for names, numbers, or specific data:
- Search through the COMPLETE DOCUMENT TEXT provided
- Extract and list ALL relevant entries
- Include page references when available

## WHEN TO USE TOOLS
- getHistoricalReaction: ONLY for explicit historical analysis requests
- getStockQuote: ONLY when user asks for current price
- getBulkDeals: ONLY for bulk/block deal queries
- DO NOT use tools for summary/content extraction - just read the document provided

## FORMAT
- Use markdown: headers (##), bullets, **bold** for key data
- Highlight amounts: "₹50 Crore" not just "50 Crore"
- Be concise - every word must add value`

const TOOLS = [
  {
    type: "function",
    function: {
      name: "getHistoricalReaction",
      description: "Get historical price reaction data for similar announcement types. ONLY use this when user EXPLICITLY asks about 'historical reaction', 'past performance', 'how did stock react before', or for major corporate events (Results, Dividends, Buybacks, M&A). DO NOT use for general summary or info extraction questions.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code" },
          ticker: { type: "string", description: "The stock ticker symbol" },
          category: { type: "string", description: "Announcement category (e.g., Result, Dividend, Buyback, Board Meeting)" },
          eventDate: { type: "string", description: "The announcement date in YYYY-MM-DD format (optional)" }
        },
        required: ["scripCode", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getBulkDeals",
      description: "Fetch recent bulk/block deals for a specific stock ticker or scrip code.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code (e.g., 500209)" },
          ticker: { type: "string", description: "The stock ticker symbol (e.g., INFY)" },
          limit: { type: "number", description: "Number of recent deals to fetch (default 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getWhaleTimeline",
      description: "Get the 3-year entry/exit timeline and average cost basis for institutional investors in a stock.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code" },
          ticker: { type: "string", description: "The stock ticker symbol" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getRiskRadar",
      description: "Check for negative clustering signals (resignations, auditor issues, bulk selling) within the last 14-30 days.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code" },
          ticker: { type: "string", description: "The stock ticker symbol" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compareQuarterlyResults",
      description: "Compare financial results across multiple quarters for a company. Use when user asks to compare results, show trends, or analyze quarter-over-quarter performance.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code" },
          ticker: { type: "string", description: "The stock ticker symbol" },
          quarters: { type: "number", description: "Number of quarters to compare (default 4)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getWolfPackAlerts",
      description: "Search for 'Wolf Pack' entry signals - scrips where 3+ high-profile HNIs/Funds entered within 30 days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Lookback period in days (default 30)" },
          scripCode: { type: "string", description: "The BSE Scrip Code to filter by (optional)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getStockQuote",
      description: "Get the latest live stock price (LTP), day high/low, and volume for a specific stock.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code (e.g., 500209)" },
          ticker: { type: "string", description: "The stock ticker symbol (e.g., INFY)" }
        },
        required: ["scripCode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getStockIntelligence",
      description: "Get comprehensive stacked intelligence for a stock including live price, news activity, and whale logic. Use for general stock queries.",
      parameters: {
        type: "object",
        properties: {
          scripCode: { type: "string", description: "The BSE Scrip Code" },
          ticker: { type: "string", description: "The stock ticker symbol" }
        },
        required: ["scripCode", "ticker"]
      }
    }
  }
]

async function executeTool(name: string, args: any): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  
  try {
    switch (name) {
      case "getHistoricalReaction": {
        const annRes = await fetch(`${baseUrl}/api/bse/announcements?scripCode=${args.scripCode}&maxPages=100`)
        const annData = await annRes.json()
        
        const categoryLower = (args.category || "").toLowerCase()
        const similarAnnouncements = (annData.announcements || []).filter((a: any) => {
          const cat = (a.category || "").toLowerCase()
          const headline = (a.headline || "").toLowerCase()
          return cat.includes(categoryLower) || 
                 headline.includes(categoryLower) ||
                 (categoryLower === "result" && /result|quarter|q[1-4]|financial/i.test(headline)) ||
                 (categoryLower === "dividend" && /dividend/i.test(headline)) ||
                 (categoryLower === "buyback" && /buyback/i.test(headline)) ||
                 (categoryLower === "board" && /board|meeting/i.test(headline))
        }).slice(0, 10)

        const histRes = await fetch(`${baseUrl}/api/bse/history?scripCode=${args.scripCode}&days=365`)
        const histData = await histRes.json()
        const priceHistory = histData.data || []

        const reactions: any[] = []
        for (const ann of similarAnnouncements.slice(0, 5)) {
          const annDate = new Date(ann.time)
          const annDateStr = annDate.toISOString().split('T')[0]
          
          const priceAtEvent = priceHistory.find((p: any) => p.date === annDateStr)
          const pricesAfter = priceHistory.filter((p: any) => {
            const pDate = new Date(p.date)
            const diffDays = (pDate.getTime() - annDate.getTime()) / (1000 * 60 * 60 * 24)
            return diffDays >= 0 && diffDays <= 10
          }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          
          const pricesBefore = priceHistory.filter((p: any) => {
            const pDate = new Date(p.date)
            const diffDays = (annDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)
            return diffDays > 0 && diffDays <= 5
          }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

          if (priceAtEvent || pricesAfter.length > 0) {
            const basePrice = priceAtEvent?.close || pricesAfter[0]?.close || 0
            const priceT5 = pricesAfter.find((p: any) => {
              const diff = (new Date(p.date).getTime() - annDate.getTime()) / (1000 * 60 * 60 * 24)
              return diff >= 4 && diff <= 6
            })
            const priceT10 = pricesAfter.find((p: any) => {
              const diff = (new Date(p.date).getTime() - annDate.getTime()) / (1000 * 60 * 60 * 24)
              return diff >= 9 && diff <= 11
            })

            reactions.push({
              date: annDateStr,
              headline: ann.headline.slice(0, 60),
              priceAtEvent: basePrice,
              changeT1: pricesAfter[1] ? ((pricesAfter[1].close - basePrice) / basePrice * 100).toFixed(2) : null,
              changeT5: priceT5 ? ((priceT5.close - basePrice) / basePrice * 100).toFixed(2) : null,
              changeT10: priceT10 ? ((priceT10.close - basePrice) / basePrice * 100).toFixed(2) : null,
              sparklineData: [...pricesBefore, ...(priceAtEvent ? [priceAtEvent] : []), ...pricesAfter].map((p: any) => ({
                date: p.date,
                close: p.close,
                isEvent: p.date === annDateStr
              }))
            })
          }
        }

        const avgT1 = reactions.filter(r => r.changeT1).reduce((sum, r) => sum + parseFloat(r.changeT1), 0) / (reactions.filter(r => r.changeT1).length || 1)
        const avgT5 = reactions.filter(r => r.changeT5).reduce((sum, r) => sum + parseFloat(r.changeT5), 0) / (reactions.filter(r => r.changeT5).length || 1)
        const avgT10 = reactions.filter(r => r.changeT10).reduce((sum, r) => sum + parseFloat(r.changeT10), 0) / (reactions.filter(r => r.changeT10).length || 1)
        const positiveRate = (reactions.filter(r => r.changeT5 && parseFloat(r.changeT5) > 0).length / (reactions.length || 1) * 100).toFixed(0)

        return {
          category: args.category,
          ticker: args.ticker,
          scripCode: args.scripCode,
          totalEvents: similarAnnouncements.length,
          analyzedEvents: reactions.length,
          avgReactionT1: avgT1.toFixed(2) + "%",
          avgReactionT5: avgT5.toFixed(2) + "%",
          avgReactionT10: avgT10.toFixed(2) + "%",
          positiveReactionRate: positiveRate + "%",
          sentiment: avgT5 > 1 ? "Bullish" : avgT5 < -1 ? "Bearish" : "Neutral",
          reactions,
          insight: `Historically, ${args.category} announcements for this stock have a ${positiveRate}% positive reaction rate within 5 trading days, with an average move of ${avgT5.toFixed(2)}%.`
        }
      }

      case "getBulkDeals": {
        const url = new URL(`${baseUrl}/api/bulk-deals/history`)
        if (args.scripCode) url.searchParams.set("scripCode", args.scripCode)
        if (args.ticker) url.searchParams.set("ticker", args.ticker)
        url.searchParams.set("days", "30")
        let res = await fetch(url.toString())
        let data = await res.json()
        
        if (!data.data || data.data.length === 0) {
          url.searchParams.set("days", "365")
          res = await fetch(url.toString())
          data = await res.json()
        }

        return {
          deals: data.data?.slice(0, args.limit || 5) || [],
          summary: data.data?.length > 0 
            ? `Found ${data.data.length} deals in last ${url.searchParams.get("days")} days.` 
            : "No deals found recently.",
          isHistorical: url.searchParams.get("days") === "365"
        }
      }
      
      case "getWhaleTimeline": {
        const url = new URL(`${baseUrl}/api/bulk-deals/history`)
        if (args.scripCode) url.searchParams.set("scripCode", args.scripCode)
        if (args.ticker) url.searchParams.set("ticker", args.ticker)
        url.searchParams.set("days", "1095")
        const res = await fetch(url.toString())
        const data = await res.json()
        const sorted = [...(data.data || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        return {
          timelineVisible: true,
          investors: Array.from(new Set(data.data?.map((d: any) => d.clientName || d.client_name))).slice(0, 3),
          averageCostBasis: sorted.length > 0 ? "Estimated ₹" + sorted[0].price : "Unknown",
          data: data.data || []
        }
      }
      
      case "getRiskRadar": {
        const url = new URL(`${baseUrl}/api/bse/announcements`)
        if (args.scripCode) url.searchParams.set("scripCode", args.scripCode)
        const res = await fetch(url.toString())
        const data = await res.json()
        const negativeEvents = (data.announcements || []).filter((a: any) => 
          /resign|auditor|delay|penalty|investigation|default/i.test(a.headline)
        )
        return {
          events: negativeEvents.slice(0, 5),
          isClustered: negativeEvents.length >= 2,
          clusterWindow: "14 days",
          stockName: args.ticker || args.scripCode
        }
      }
      
      case "getWolfPackAlerts": {
          const alerts = await getWolfPackAlerts(args.days || 30, args.scripCode)
          return {
            activeAlerts: alerts,
            count: alerts.length,
            filteredBy: args.scripCode ? "Current Stock" : "All Market"
          }
        }

        case "compareQuarterlyResults": {
          const url = new URL(`${baseUrl}/api/bse/announcements`)
          if (args.scripCode) url.searchParams.set("scripCode", args.scripCode)
          url.searchParams.set("maxPages", "50")
          const res = await fetch(url.toString())
          const data = await res.json()
          
          const resultAnnouncements = (data.announcements || []).filter((a: any) => 
            /result|financial|quarter|q1|q2|q3|q4|annual|half.?year|interim/i.test(a.headline) ||
            a.category?.toLowerCase().includes('result')
          ).slice(0, args.quarters || 4)
          
          const quarters = resultAnnouncements.map((a: any) => {
            const headline = a.headline || ""
            const quarterMatch = headline.match(/Q([1-4])|([1-4])Q|quarter\s*([1-4])|first|second|third|fourth/i)
            const yearMatch = headline.match(/FY\s*(\d{2,4})|20\d{2}[-–]?\d{0,2}|(\d{4})/i)
            
            let quarter = "Q?"
            if (quarterMatch) {
              const qNum = quarterMatch[1] || quarterMatch[2] || quarterMatch[3]
              if (qNum) quarter = `Q${qNum}`
              else if (/first/i.test(quarterMatch[0])) quarter = "Q1"
              else if (/second/i.test(quarterMatch[0])) quarter = "Q2"
              else if (/third/i.test(quarterMatch[0])) quarter = "Q3"
              else if (/fourth/i.test(quarterMatch[0])) quarter = "Q4"
            }
            if (/annual/i.test(headline)) quarter = "FY"
            if (/half.?year/i.test(headline)) quarter = "H1/H2"
            
            let year = yearMatch ? yearMatch[1] || yearMatch[2] || "" : ""
            
            return {
              id: a.id,
              quarter,
              year,
              headline: a.headline,
              time: a.time,
              pdfUrl: a.pdfUrl,
              summary: a.summary
            }
          })
          
          return {
            compareMode: true,
            quarters,
            stockName: args.ticker || args.scripCode,
            count: quarters.length,
            message: quarters.length > 0 
              ? `Found ${quarters.length} quarterly results to compare` 
              : "No quarterly results found for comparison"
          }
        }

        case "getStockQuote": {
        const res = await fetch(`${baseUrl}/api/bse/enhanced-quote?scripCode=${args.scripCode}`).catch(() => null)
        const quoteData = res?.ok ? await res.json() : null
        
        if (!quoteData || !quoteData.data) {
          return { error: "Could not fetch live quote at this time." }
        }

        const q = quoteData.data
        return {
          stockName: q.stockName || args.ticker,
          ltp: Number(q.currentValue || q.ltp || 0),
          change: Number(q.change || 0),
          pChange: Number(q.pChange || 0),
          dayHigh: Number(q.dayHigh || 0),
          dayLow: Number(q.dayLow || 0),
          volume: Number(q.totalTradedQuantity || 0),
          updatedAt: quoteData.timestamp
        }
      }

      case "getStockIntelligence": {
        const [quote, news, whale] = await Promise.all([
          executeTool("getStockQuote", args),
          executeTool("getRiskRadar", args),
          executeTool("getWhaleTimeline", args)
        ])
        
        return {
          quote,
          news,
          whale,
          ticker: args.ticker,
          scripCode: args.scripCode
        }
      }
      
      default:
        return { error: "Unknown tool" }
    }
  } catch (e) {
    console.error(`Tool execution error [${name}]:`, e)
    return { error: "Failed to execute tool" }
  }
}

interface AnnouncementData {
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

interface ChatRequest {
  message: string
  announcement: AnnouncementData
  history: Array<{ role: "user" | "assistant"; content: string }>
  stream?: boolean
  multiDocMode?: boolean
  selectedAnnouncements?: AnnouncementData[]
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json()
    const { message, announcement, history = [], stream = true, multiDocMode = false, selectedAnnouncements = [] } = body

    if (!message || !announcement) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({
        response: "OpenAI API key is not configured.",
        error: "Missing API key"
      }, { status: 200 })
    }

    let pdfContext = ""
    let extractedEntities: any[] = []
    let extractedTables: any[] = []
    const citationItems: { page: number; snippet: string; openUrl: string; score?: number; docId?: string; headline?: string }[] = []

    // Determine which announcements to process
    const announcementsToProcess: AnnouncementData[] = multiDocMode && selectedAnnouncements.length > 0
      ? selectedAnnouncements
      : [announcement]

    console.log(`[MultiDoc] Processing ${announcementsToProcess.length} documents, multiDocMode=${multiDocMode}`)

    // Process ALL documents in multi-doc mode
    const allHits: { text: string; page: number; score: number; pdfUrl: string; docId: string; headline: string }[] = []
    
    for (const ann of announcementsToProcess) {
      if (!ann.pdfUrl) continue

      try {
        const visionResult = await extractPdfWithVision(ann.pdfUrl, openaiKey)
        
        if (visionResult.allEntities.length > 0) {
          extractedEntities.push(...visionResult.allEntities.map(e => ({ ...e, docId: ann.id })))
        }
        
        if (visionResult.tables.length > 0) {
          extractedTables.push(...visionResult.tables.map(t => ({ ...t, docId: ann.id })))
        }

        if (visionResult.pages.length > 0) {
          const chunks = chunkPages(visionResult.pages.map(p => ({ page: p.page, text: p.text })), 800)
          
          if (chunks.length > 0) {
            await ensureIndexed(ann.pdfUrl, visionResult.pages, openaiKey)
            const [qEmb] = await embedTexts(openaiKey, [message])
            const hits = await topK(ann.pdfUrl, qEmb, multiDocMode ? 8 : 15)
            
            for (const hit of hits) {
              allHits.push({
                ...hit,
                pdfUrl: ann.pdfUrl,
                docId: ann.id,
                headline: ann.headline.slice(0, 60)
              })
            }
          }
        }
      } catch (e) {
        console.error(`PDF extraction failed for ${ann.id}:`, e)
      }
    }

    // Rerank ALL hits together for best cross-document relevance
    if (allHits.length > 0) {
      const reranked = await hybridRerank(
        message,
        allHits.map(h => ({ text: h.text, page: h.page, score: h.score })),
        openaiKey,
        multiDocMode ? 12 : 6
      )

      if (reranked.length > 0) {
        pdfContext += `\n\n## MOST RELEVANT SECTIONS FROM ${announcementsToProcess.length} DOCUMENTS:\n`
        
        for (let i = 0; i < reranked.length; i++) {
          const hit = reranked[i]
          const originalHit = allHits.find(h => h.text === hit.text && h.page === hit.page)
          const docLabel = multiDocMode && originalHit ? `[Doc: ${originalHit.headline}...]` : ""
          
          pdfContext += `\n### ${docLabel} [Page ${hit.page}] (Relevance: ${(hit.relevance_score * 100).toFixed(0)}%)\n${hit.text}\n`
          
          citationItems.push({
            page: hit.page,
            snippet: hit.text.slice(0, 400),
            openUrl: originalHit ? `${originalHit.pdfUrl}#page=${hit.page}` : `#page=${hit.page}`,
            score: hit.relevance_score,
            docId: originalHit?.docId,
            headline: originalHit?.headline
          })
        }
      }
    }

    // ALWAYS include full raw text for summary, info, and general queries
    const needsFullText = /who|name|allott|director|shareholder|investor|person|list.*all|summary|highlight|key|important|what|detail|tell me|explain|about|content|read|extract|number|date|amount|give|show|provide/i.test(message)
    
    console.log(`[Chat] Processing query: "${message.slice(0, 50)}...", needsFullText=${needsFullText}`)
    
    // For summary-type queries, we MUST include the full PDF text
    for (const ann of announcementsToProcess.slice(0, 3)) {
      if (!ann.pdfUrl) {
        console.log(`[Chat] No PDF URL for announcement ${ann.id}`)
        continue
      }
      try {
        console.log(`[Chat] Extracting PDF from: ${ann.pdfUrl.slice(0, 80)}...`)
        const visionResult = await extractPdfWithVision(ann.pdfUrl, openaiKey)
        console.log(`[Chat] PDF extraction result: ${visionResult.rawText?.length || 0} chars, ${visionResult.allEntities?.length || 0} entities`)
        
        if (visionResult.rawText && visionResult.rawText.length > 100) {
          const docLabel = multiDocMode ? `[${ann.headline.slice(0, 40)}...]` : ""
          
          // Always add raw text for short queries or explicit summary requests
          if (needsFullText || message.length < 50) {
            pdfContext += `\n\n## COMPLETE DOCUMENT TEXT ${docLabel}\n${visionResult.rawText.slice(0, 12000)}`
            console.log(`[Chat] Added ${Math.min(visionResult.rawText.length, 12000)} chars of PDF text to context`)
          }
          
          // Add extracted entities if available
          if (visionResult.allEntities.length > 0) {
            pdfContext += `\n\n## EXTRACTED ENTITIES ${docLabel}\n`
            const personEntities = visionResult.allEntities.filter(e => e.type === "person")
            const amountEntities = visionResult.allEntities.filter(e => e.type === "amount")
            const dateEntities = visionResult.allEntities.filter(e => e.type === "date")
            const shareEntities = visionResult.allEntities.filter(e => e.type === "shares")
            
            if (personEntities.length > 0) {
              pdfContext += `\n**Names:** ${personEntities.map(e => e.value).join(", ")}`
            }
            if (amountEntities.length > 0) {
              pdfContext += `\n**Amounts:** ${amountEntities.map(e => e.raw).join(", ")}`
            }
            if (dateEntities.length > 0) {
              pdfContext += `\n**Dates:** ${dateEntities.map(e => e.raw).join(", ")}`
            }
            if (shareEntities.length > 0) {
              pdfContext += `\n**Shares:** ${shareEntities.map(e => e.raw).join(", ")}`
            }
          }
        } else {
          console.log(`[Chat] PDF text too short or empty: ${visionResult.rawText?.length || 0} chars`)
        }
      } catch (e) {
        console.error(`[Chat] Full text extraction failed for ${ann.id}:`, e)
      }
    }
    
    console.log(`[Chat] Final pdfContext length: ${pdfContext.length} chars`)

    // Build context prompt for single or multi-doc mode
    let contextPrompt = ""
    if (multiDocMode && announcementsToProcess.length > 1) {
      contextPrompt = `
## MULTI-DOCUMENT ANALYSIS MODE
Analyzing ${announcementsToProcess.length} documents from **${announcement.company}** (${announcement.ticker})

### Documents in scope:
${announcementsToProcess.map((a, i) => `${i + 1}. [${a.time}] ${a.headline.slice(0, 80)}... (${a.category})`).join("\n")}

${pdfContext}
`
    } else {
      contextPrompt = `
## CURRENT ANNOUNCEMENT
- **Company**: ${announcement.company} (${announcement.ticker})
- **BSE Code**: ${announcement.scripCode}
- **Category**: ${announcement.category}${announcement.subCategory ? ` > ${announcement.subCategory}` : ""}
- **Time**: ${announcement.time}
- **Headline**: ${announcement.headline}
${announcement.summary ? `- **Summary**: ${announcement.summary}` : ""}
${pdfContext}
`
    }

    const messages: any[] = [
      { role: "system", content: WORLD_CLASS_SYSTEM_PROMPT + "\n\n" + contextPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ]

    const widgets: any[] = []

    if (stream) {
      const encoder = new TextEncoder()
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            const firstResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                tools: TOOLS,
                tool_choice: "auto",
                stream: false
              }),
            })

            const firstData = await firstResponse.json()
            let aiMsg = firstData.choices?.[0]?.message

            if (aiMsg?.tool_calls) {
              messages.push(aiMsg)
              
              for (const toolCall of aiMsg.tool_calls) {
                const name = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)
                
                const result = await executeTool(name, args)
                widgets.push({ type: name, data: result, args })

                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: name,
                  content: JSON.stringify(result)
                })
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "widgets", widgets })}\n\n`))
            }

            const streamingResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                stream: true
              }),
            })

            const reader = streamingResponse.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ""

            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split("\n")

                for (const line of lines) {
                  if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    try {
                      const data = JSON.parse(line.slice(6))
                      const content = data.choices?.[0]?.delta?.content
                      if (content) {
                        fullContent += content
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", content })}\n\n`))
                      }
                    } catch {}
                  }
                }
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: "done", 
              citations: citationItems,
              entities: extractedEntities,
              tables: extractedTables
            })}\n\n`))

            controller.close()
          } catch (e) {
            console.error("Stream error:", e)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream failed" })}\n\n`))
            controller.close()
          }
        }
      })

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    })

    let data = await response.json()
    let aiMsg = data.choices?.[0]?.message

    if (aiMsg?.tool_calls) {
      messages.push(aiMsg)
      
      for (const toolCall of aiMsg.tool_calls) {
        const name = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)
        
        const result = await executeTool(name, args)
        widgets.push({ type: name, data: result, args })

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify(result)
        })
      }

      const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
        }),
      })
      data = await secondResponse.json()
      aiMsg = data.choices?.[0]?.message
    }

    return NextResponse.json({
      response: aiMsg?.content?.trim() || "Could not generate response.",
      usage: data.usage,
      pdfUrl: announcement.pdfUrl || null,
      citations: citationItems,
      widgets: widgets.length > 0 ? widgets : undefined,
      entities: extractedEntities,
      tables: extractedTables
    })

  } catch (error: any) {
    console.error("Chat API error:", error)
    return NextResponse.json({
      response: "An error occurred. Please try again.",
      error: error.message
    }, { status: 500 })
  }
}
