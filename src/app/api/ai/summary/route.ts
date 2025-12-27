import { NextResponse } from "next/server"
import { analyzeAnnouncement, type AISummary } from "@/lib/ai/verdict"
import { 
  preprocessTextForSummary, 
  postProcessSummary, 
  getEnhancedSummaryPrompt,
  formatSummaryWithBold 
} from "@/lib/ai/summaryFormatter"

export const dynamic = "force-dynamic"

// Cache for AI summaries
const summaryCache = new Map<string, { summary: AISummary & { pdfAnalyzed: boolean }; timestamp: number }>()
const CACHE_TTL = 3600_000 // 1 hour
// Cache for extracted PDF text (by URL)
const pdfTextCache = new Map<string, { text: string; timestamp: number; success: boolean }>()
const PDF_TTL = 24 * 3600_000 // 24 hours

interface SummaryRequest {
  headline: string
  summary?: string
  category: string
  subCategory?: string
  pdfUrl?: string
  pdfContent?: string
  announcementId: string
  forceRefresh?: boolean
}

export async function POST(request: Request) {
  try {
    const body: SummaryRequest = await request.json()
    const { headline, summary, category, subCategory, pdfUrl, pdfContent, announcementId, forceRefresh } = body

    if (!headline || !announcementId) {
      return NextResponse.json(
        { error: "Missing required fields: headline, announcementId" },
        { status: 400 }
      )
    }

    // Check cache first (skip if forceRefresh)
    if (!forceRefresh) {
      const cached = summaryCache.get(announcementId)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({ 
          ...cached.summary, 
          cached: true,
          source: "cache" 
        })
      }
    }

    // Clear PDF cache on force refresh
    if (forceRefresh && pdfUrl) {
      pdfTextCache.delete(pdfUrl)
    }

    // Try to get PDF content with retry logic
    let extractedPdfContent = pdfContent
    let pdfAnalyzed = !!pdfContent && pdfContent.length > 100
    let pdfExtractionAttempted = false
    
    if (pdfUrl && !extractedPdfContent) {
      pdfExtractionAttempted = true
      extractedPdfContent = await extractPdfTextWithRetry(pdfUrl, 3)
      pdfAnalyzed = !!extractedPdfContent && extractedPdfContent.length > 100
    }

    // Initialize with rule-based analysis as fallback
    let aiSummary: AISummary = analyzeAnnouncement(headline, summary || "", category, subCategory || "")
    let source = "rule-based"
    
    // Try to enhance with OpenAI if API key is available
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (openaiKey) {
      try {
        const enhancedJson = await generateOpenAISummary(
          openaiKey,
          headline,
          summary || "",
          extractedPdfContent || "",
          category,
          pdfAnalyzed
        )

        if (enhancedJson) {
          try {
            // Clean the JSON string - remove any markdown code blocks and fix common issues
            let cleanJson = enhancedJson
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim()
            
            // Fix double quotes (""key" -> "key")
            cleanJson = cleanJson.replace(/""+/g, '"')
            
            // Handle case where string starts with key (no opening brace)
            if (/^[Hh]eadline"?\s*:/.test(cleanJson)) {
              cleanJson = cleanJson.replace(/^[Hh]eadline"?\s*:/, '{"headline":')
            }
            
            // Normalize remaining key names
            cleanJson = cleanJson
              .replace(/,\s*"?[Hh]eadline"?\s*:/g, ',"headline":')
              .replace(/,\s*"?[Kk]ey[Ii]nsights"?\s*:/g, ',"keyInsights":')
              .replace(/,\s*"?[Rr]isk[Ff]actors"?\s*:/g, ',"riskFactors":')
              .replace(/,\s*"?[Ss]trengths"?\s*:/g, ',"strengths":')
              .replace(/,\s*"?[Cc]hallenges"?\s*:/g, ',"challenges":')
              .replace(/,\s*"?[Oo]pportunities"?\s*:/g, ',"opportunities":')
              .replace(/,\s*"?[Ss]entiment"?\s*:/g, ',"sentiment":')
              .replace(/,\s*"?[Vv]erdict"?\s*:/g, ',"verdict":')
              .replace(/,\s*"?[Cc]onfidence"?\s*:/g, ',"confidence":')
              .replace(/,\s*"?[Rr]easoning"?\s*:/g, ',"reasoning":')
            
            if (!cleanJson.startsWith("{")) cleanJson = "{" + cleanJson
            if (!cleanJson.endsWith("}")) {
              const lastBracket = cleanJson.lastIndexOf("]")
              const lastQuote = cleanJson.lastIndexOf('"')
              const cutPoint = Math.max(lastBracket, lastQuote)
              if (cutPoint > 0) {
                cleanJson = cleanJson.slice(0, cutPoint + 1) + "}"
              } else {
                cleanJson = cleanJson + "}"
              }
            }
            
            const parsed = JSON.parse(cleanJson)
            
            // Map parsed fields to AISummary
            if (parsed.headline) {
              aiSummary.simpleSummary = parsed.headline
              source = pdfAnalyzed ? "openai+pdf" : "openai"
            }
            
            if (parsed.keyInsights?.length) {
              aiSummary.keyInsights = parsed.keyInsights
            }
            
            if (parsed.riskFactors?.length) {
              aiSummary.riskFactors = parsed.riskFactors
            } else if (parsed.challenges?.length) {
              aiSummary.riskFactors = parsed.challenges
            }
            
            if (parsed.opportunities?.length) {
              aiSummary.opportunities = parsed.opportunities
            } else if (parsed.strengths?.length) {
              aiSummary.opportunities = parsed.strengths
            }
            
            if (parsed.verdict) {
              if (typeof parsed.verdict === 'string') {
                const v = parsed.verdict.toLowerCase().replace(" ", "_")
                if (["strong_positive", "positive", "neutral", "mixed", "negative", "strong_negative"].includes(v)) {
                  aiSummary.verdict.type = v as any
                }
              } else if (typeof parsed.verdict === 'object') {
                if (parsed.verdict.type) aiSummary.verdict.type = parsed.verdict.type
                if (parsed.verdict.confidence) aiSummary.verdict.confidence = parsed.verdict.confidence
                if (parsed.verdict.reasoning) aiSummary.verdict.reasoning = parsed.verdict.reasoning
              }
            }
            
            if (parsed.sentiment && !parsed.verdict) {
              const s = parsed.sentiment.toLowerCase()
              if (s.includes("strong") && s.includes("pos")) aiSummary.verdict.type = "strong_positive"
              else if (s.includes("pos")) aiSummary.verdict.type = "positive"
              else if (s.includes("strong") && s.includes("neg")) aiSummary.verdict.type = "strong_negative"
              else if (s.includes("neg")) aiSummary.verdict.type = "negative"
              else if (s.includes("mix")) aiSummary.verdict.type = "mixed"
            }

          } catch (parseErr) {
            console.error("[AI] JSON parse error:", parseErr)
          }
        }
      } catch (e) {
        console.error("OpenAI enhancement failed:", e)
      }
    }

    // Format the summary with bold markers
    aiSummary.simpleSummary = formatSummaryWithBold(aiSummary.simpleSummary)

    // Cache the result
    summaryCache.set(announcementId, { 
      summary: { ...aiSummary, pdfAnalyzed }, 
      timestamp: Date.now() 
    })

    return NextResponse.json({
      ...aiSummary,
      cached: false,
      source,
      pdfAnalyzed,
      pdfExtractionAttempted,
    })
  } catch (e: any) {
    console.error("AI Summary API error:", e)
    return NextResponse.json(
      { error: "Failed to generate AI summary", message: e?.message },
      { status: 500 }
    )
  }
}

async function extractPdfTextWithRetry(pdfUrl: string, maxRetries: number = 3): Promise<string> {
  const cached = pdfTextCache.get(pdfUrl)
  if (cached && Date.now() - cached.timestamp < PDF_TTL) {
    return cached.text
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const text = await extractPdfText(pdfUrl)
      if (text && text.length > 50) {
        pdfTextCache.set(pdfUrl, { text, timestamp: Date.now(), success: true })
        return text
      }
    } catch (e: any) {
      lastError = e
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 500))
      }
    }
  }
  
  pdfTextCache.set(pdfUrl, { text: "", timestamp: Date.now(), success: false })
  return ""
}

async function extractPdfText(pdfUrl: string): Promise<string> {
  // Clean URL if it has double quotes
  const cleanUrl = pdfUrl.replace(/["']/g, "").trim()
  
  const bseServiceUrl = process.env.BSE_SERVICE_URL
  if (!bseServiceUrl) return ""
  
  try {
    const extractUrl = `${bseServiceUrl}/api/pdf/extract`
    const pythonResponse = await fetch(extractUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl }),
      signal: AbortSignal.timeout(60000),
    })
    
    if (pythonResponse.ok) {
      const result = await pythonResponse.json()
      // Support both 'text' and 'combined_text' or 'pages'
      const pdfText = result.text || result.combined_text || (result.pages ? result.pages.map((p: any) => p.text).join("\n\n") : "")
      
      if (result.success && pdfText) {
        const text = cleanPdfText(pdfText)
        if (isTextMeaningful(text)) {
          return text.slice(0, 150000)
        }
      } else {
        console.log("[PDF] Python service returned success:false or empty text:", result.error)
      }
    }
  } catch (e: any) {
    console.log("[PDF] Python service unavailable:", e.message)
  }
  
  return ""
}

function cleanPdfText(text: string): string {
  if (!text) return ""
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isTextMeaningful(text: string): boolean {
  if (!text || text.length < 100) return false
  const financialTerms = ["company", "limited", "ltd", "board", "meeting", "regulation", "sebi", "bse", "nse", "stock"]
  const textLower = text.toLowerCase()
  let matches = 0
  for (const term of financialTerms) {
    if (textLower.includes(term)) matches++
  }
  return matches >= 2
}

function getCategoryPrompt(category: string, headline: string, pdfAnalyzed: boolean = false): string {
  const pdfInstruction = pdfAnalyzed 
    ? "\n\nCRITICAL: Full PDF text provided. You MUST extract and include:\n- EXACT numbers, amounts, percentages\n- ALL names of people, companies, allottees mentioned\n- Specific dates and deadlines\n- Key table data (share quantities, prices, etc.)\nDo NOT give generic summaries. Be SPECIFIC to this document."
    : ""
  
  return `You are an elite Indian stock analyst. Analyze this BSE filing and respond in JSON.
${pdfInstruction}

CRITICAL OUTPUT RULES (7C Communication):
- CLEAR: No jargon. Plain English.
- CONCISE: Max 15 words per insight. No filler.
- CONCRETE: Include ₹ amounts, %, dates, NAMES when available.
- CORRECT: Only facts from the document. Extract SPECIFIC data.
- COHERENT: Each point must be self-contained.
- COMPLETE: Cover what happened + investor impact. List KEY NAMES if present.
- COURTEOUS: Neutral, professional tone.

IMPORTANT: If the document contains a list of names/allottees/shareholders, mention the KEY ones or total count.

JSON SCHEMA:
{
  "headline": "1-2 sentences. What happened + impact. Include key numbers/names.",
  "keyInsights": ["Max 3-4 points. Each under 15 words. Include specific data."],
  "riskFactors": ["Max 2-3 specific risks. Short."],
  "opportunities": ["Max 2-3 growth drivers. Short."],
  "verdict": {
    "type": "strong_positive|positive|neutral|mixed|negative|strong_negative",
    "confidence": 0-100,
    "reasoning": "1 sentence why"
  }
}

BAD Example: "The company has announced that it will be holding a board meeting to consider various matters including financial results."
GOOD Example: "Board meeting on Jan 15 to approve Q3 results. Stock may see volatility."

BAD Example: "Corporate action related to allotment of shares"
GOOD Example: "Allotted 1.75 Cr shares to 19 investors including Vineet Arora (20L shares), NAV Capital (81.9L). Significant dilution."`
}

async function generateOpenAISummary(
  apiKey: string,
  headline: string,
  summary: string,
  pdfContent: string,
  category: string,
  pdfAnalyzed: boolean
): Promise<string> {
  const textToSummarize = preprocessTextForSummary(
    `${headline}\n\n${summary}\n\n${pdfContent || ""}`
  )

  const categoryPrompt = getCategoryPrompt(category || "", headline, pdfAnalyzed)

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: categoryPrompt },
        { role: "user", content: `Analyze this announcement and extract SPECIFIC details:\n\nHeadline: ${headline}\n\nFull Document Content:\n${textToSummarize.slice(0, 25000)}` }
      ],
      max_tokens: 1000,
      temperature: 0.15,
      response_format: { type: "json_object" }
    }),
  })

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ""
}
