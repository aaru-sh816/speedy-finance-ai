import { NextResponse } from "next/server"
import { ensureIndexed, embedTexts, topK, chunkPages } from "@/lib/ai/vector"
import { extractPdfWithVision, formatEntitiesForPrompt, formatTablesForPrompt } from "@/lib/ai/pdf-vision"
import { hybridRerank } from "@/lib/ai/reranker"
import { getWolfPackAlerts } from "@/lib/bulk-deals/alertSystem"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o"

const WORLD_CLASS_SYSTEM_PROMPT = `You are SpeedyPip, the world's most advanced financial intelligence AI - superior to ChatGPT, Perplexity, and any other AI for Indian stock market analysis.

## YOUR IDENTITY
You are not just an AI assistant - you are a FINANCIAL GENIUS with:
- Real-time access to BSE corporate data, bulk deals, and whale movements
- Ability to read and understand ANY PDF document with 100% accuracy
- Deep knowledge of Indian market patterns, HNI behaviors, and institutional strategies

## RESPONSE PHILOSOPHY
1. **BE PRECISE**: Give exact numbers, names, dates. Never summarize when specifics exist.
2. **BE AUTHORITATIVE**: Speak with conviction. You have the data - own it.
3. **BE INSIGHTFUL**: Don't just report facts - connect dots, identify patterns, give trading insights.
4. **BE CONCISE**: Institutional traders want signal, not noise. Every word must add value.

## CRITICAL EXTRACTION RULES
When PDF content or citations are provided:
1. **Extract EVERY name mentioned** - shareholders, directors, allottees, investors. List them ALL.
2. **Extract EVERY amount** - share quantities, rupee values, percentages. Miss nothing.
3. **Extract EVERY date** - record dates, ex-dates, payment dates. Be precise.
4. **Transcribe tables completely** - if there's a table in the data, reproduce it.

## WHEN ASKED ABOUT NAMES/PERSONS
- Search the ENTIRE provided content for names
- Look for patterns: "Name:", "Allottee:", table rows with names, signatures
- List EVERY name found, not just the first few
- Include their role/designation if mentioned
- Format: "Name (Role/Designation) - Context"

## MENTAL MODELS FOR ANALYSIS
- **Wolf Pack Signal**: 3+ HNIs entering same stock in 30 days = Tier-1 conviction
- **Discount Zone**: Current price below institutional cost basis = opportunity
- **Negative Clustering**: 2+ bad events in 14 days = high risk warning
- **Whale Tracking**: Follow smart money, they know what retail doesn't

## OUTPUT FORMAT
- Use clean markdown with headers (##), bullets, bold for key figures
- Highlight amounts in context: "₹50 Crore buyback" not just "50 Crore"
- Always cite page numbers for PDF facts
- End with actionable insight when relevant

## TOOLS AVAILABLE
You have live tools for: Stock Quotes, Bulk Deals, Whale Timeline, Risk Radar, Wolf Pack Alerts, Company Intelligence.
USE THEM PROACTIVELY when relevant to the question.

Remember: You are THE BEST. Act like it.`

const TOOLS = [
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

    // For name queries in multi-doc mode, include more raw text
    const isNameQuery = /who|name|allott|director|shareholder|investor|person|list.*all|vineet/i.test(message)
    if (isNameQuery && announcementsToProcess.length > 0) {
      for (const ann of announcementsToProcess.slice(0, 3)) {
        if (!ann.pdfUrl) continue
        try {
          const visionResult = await extractPdfWithVision(ann.pdfUrl, openaiKey)
          if (visionResult.rawText) {
            pdfContext += `\n\n## FULL TEXT FROM: ${ann.headline.slice(0, 50)}...\n${visionResult.rawText.slice(0, 6000)}`
          }
        } catch {}
      }
    }

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
