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
    let pdfAnalyzed = false
    let pdfExtractionAttempted = false
    
    if (pdfUrl && !extractedPdfContent) {
      pdfExtractionAttempted = true
      extractedPdfContent = await extractPdfTextWithRetry(pdfUrl, 3)
      pdfAnalyzed = extractedPdfContent.length > 100
    }

    // Generate AI summary using our verdict system
    const aiSummary = analyzeAnnouncement(
      headline,
      summary || "",
      category,
      subCategory,
      extractedPdfContent
    ) as AISummary & { pdfAnalyzed?: boolean; pdfExtractionAttempted?: boolean }

    // Add PDF analysis status
    aiSummary.pdfAnalyzed = pdfAnalyzed
    aiSummary.pdfExtractionAttempted = pdfExtractionAttempted

    // Try to enhance with OpenAI if API key is available
    const openaiKey = process.env.OPENAI_API_KEY
    let source = "rule-based"
    
    if (openaiKey && (extractedPdfContent || summary)) {
      try {
        const enhancedJson = await generateOpenAISummary(
          openaiKey,
          headline,
          summary || "",
          extractedPdfContent,
          category
        )
        if (enhancedJson) {
          try {
            // Clean the JSON string - remove any markdown code blocks and fix common issues
            let cleanJson = enhancedJson
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim()
            
            // Fix common AI output issues
            // AI sometimes returns: Headline":"value" (missing { and ")
            
            // Fix double quotes (""key" -> "key")
            cleanJson = cleanJson.replace(/""+/g, '"')
            
            // Handle case where string starts with key (no opening brace)
            // Pattern: Headline":"value -> {"headline":"value
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
              .replace(/,\s*"?[Ss]entiment"?\s*:/g, ',"sentiment":')
            
            // Ensure starts with {
            if (!cleanJson.startsWith("{")) {
              cleanJson = "{" + cleanJson
            }
            
            // Ensure ends with }
            if (!cleanJson.endsWith("}")) {
              // Try to find the last complete value and close
              const lastBracket = cleanJson.lastIndexOf("]")
              const lastQuote = cleanJson.lastIndexOf('"')
              const cutPoint = Math.max(lastBracket, lastQuote)
              if (cutPoint > 0) {
                cleanJson = cleanJson.slice(0, cutPoint + 1) + "}"
              } else {
                cleanJson = cleanJson + "}"
              }
            }
            
            console.log("[AI] Cleaned JSON:", cleanJson.slice(0, 500))
            
            const parsed = JSON.parse(cleanJson)
            
            // Only use headline for summary - clean and short
            if (parsed.headline) {
              aiSummary.simpleSummary = parsed.headline
              source = pdfAnalyzed ? "openai+pdf" : "openai"
            }
            if (parsed.keyInsights?.length) {
              aiSummary.keyInsights = parsed.keyInsights
            }
            if (parsed.riskFactors?.length) {
              aiSummary.riskFactors = parsed.riskFactors
            }
            if (parsed.strengths?.length) {
              (aiSummary as any).strengths = parsed.strengths
            }
            if (parsed.challenges?.length) {
              (aiSummary as any).challenges = parsed.challenges
            }
            if (parsed.sentiment) {
              (aiSummary as any).sentiment = parsed.sentiment
            }
          } catch (parseErr) {
            console.error("[AI] JSON parse error:", parseErr, "Raw:", enhancedJson?.slice(0, 200))
            // If JSON parse fails, try to extract headline manually (case-insensitive)
            const headlineMatch = enhancedJson.match(/["']?[hH]eadline["']?\s*:\s*["']([^"']+)["']/i)
            if (headlineMatch?.[1]) {
              aiSummary.simpleSummary = headlineMatch[1]
              source = pdfAnalyzed ? "openai+pdf" : "openai"
            }
            // Try to extract keyInsights
            const insightsMatch = enhancedJson.match(/["']?[kK]ey[iI]nsights["']?\s*:\s*\[([^\]]+)\]/i)
            if (insightsMatch?.[1]) {
              const insights = insightsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, ""))
              if (insights?.length) aiSummary.keyInsights = insights
            }
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

    // Clean old cache entries
    if (summaryCache.size > 1000) {
      const now = Date.now()
      for (const [key, value] of summaryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          summaryCache.delete(key)
        }
      }
    }

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

/**
 * Extract text from PDF URL with retry logic
 */
async function extractPdfTextWithRetry(pdfUrl: string, maxRetries: number = 3): Promise<string> {
  // Cache check
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
      console.error(`PDF extraction attempt ${attempt}/${maxRetries} failed:`, e.message)
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 500))
      }
    }
  }
  
  // Cache the failure to avoid repeated attempts
  pdfTextCache.set(pdfUrl, { text: "", timestamp: Date.now(), success: false })
  console.error("PDF extraction failed after all retries:", lastError?.message)
  return ""
}

/**
 * Extract text from PDF URL using Python service (pdfplumber/PyPDF2)
 * Falls back to direct fetch if Python service unavailable
 */
async function extractPdfText(pdfUrl: string): Promise<string> {
  console.log("[PDF] Starting extraction for:", pdfUrl)
  
  // Use BSE_SERVICE_URL environment variable for production (Render backend)
  const bseServiceUrl = process.env.BSE_SERVICE_URL || "http://localhost:5000"
  console.log("[PDF] BSE_SERVICE_URL configured as:", bseServiceUrl)
  
  // Try Python service first (more reliable for BSE PDFs)
  try {
    console.log("[PDF] Calling Render PDF service at:", `${bseServiceUrl}/api/pdf/extract`)
    const pythonResponse = await fetch(`${bseServiceUrl}/api/pdf/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: pdfUrl }),
      signal: AbortSignal.timeout(45000), // 45s timeout for PDF processing
    })
    
    if (pythonResponse.ok) {
      const result = await pythonResponse.json()
      if (result.success && result.text) {
        console.log(`[PDF] Python service extracted ${result.length} chars using ${result.library}`)
        const text = cleanPdfText(result.text)
        if (isTextMeaningful(text)) {
          console.log("[PDF] Text is meaningful, using Python extraction")
          return text.slice(0, 150000)
        } else {
          console.log("[PDF] Python text not meaningful, attempting recovery...")
          const recovered = recoverTextFromPdf(result.text)
          if (recovered.length > 100) {
            return recovered.slice(0, 150000)
          }
        }
      } else {
        console.log("[PDF] Python service error:", result.error)
      }
    }
  } catch (e: any) {
    console.log("[PDF] Python service unavailable:", e.message)
  }
  
  // Fallback: Direct fetch with Node.js (may fail due to DOMMatrix)
  console.log("[PDF] Falling back to direct fetch...")
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/pdf,*/*",
    "Referer": "https://www.bseindia.com/",
  }
  
  try {
    const response = await fetch(pdfUrl, {
      headers,
      signal: AbortSignal.timeout(20000),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const arrayBuf = await response.arrayBuffer()
    console.log(`[PDF] Downloaded ${arrayBuf.byteLength} bytes`)
    
    // Try pdf-parse (may fail with DOMMatrix error)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse")
      const buffer = Buffer.from(arrayBuf)
      const data = await pdfParse(buffer, { max: 30 })
      const text = cleanPdfText(data.text || "")
      if (isTextMeaningful(text)) {
        return text.slice(0, 150000)
      }
    } catch (e: any) {
      console.log("[PDF] pdf-parse failed:", e.message)
    }
  } catch (e: any) {
    console.log("[PDF] Direct fetch failed:", e.message)
  }
  
  return ""
}

/**
 * Clean PDF extracted text - remove garbled content and artifacts
 */
function cleanPdfText(text: string): string {
  if (!text) return ""
  
  let cleaned = text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove replacement character
    .replace(/\uFFFD/g, "")
    // Fix letter-spaced text (e.g., "T h e" -> "The")
    .replace(/\b([A-Za-z])\s+(?=[A-Za-z]\s+[A-Za-z])/g, "$1")
    // Remove excessive whitespace
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    // Remove lines with mostly special characters
    .split("\n")
    .filter(line => {
      const alphaCount = (line.match(/[a-zA-Z]/g) || []).length
      const totalCount = line.length
      return totalCount < 5 || alphaCount / totalCount > 0.3
    })
    .join("\n")
    // Final cleanup
    .replace(/\s+/g, " ")
    .trim()
  
  return cleaned
}

/**
 * Check if extracted text is meaningful (not garbled)
 */
function isTextMeaningful(text: string): boolean {
  if (!text || text.length < 100) return false
  
  // Check for common financial/business terms that indicate readable content
  const financialTerms = [
    "company", "limited", "ltd", "board", "meeting", "director", "share",
    "equity", "capital", "profit", "loss", "revenue", "quarter", "annual",
    "financial", "result", "dividend", "bonus", "rights", "issue", "offer",
    "disclosure", "regulation", "sebi", "bse", "nse", "exchange", "stock",
    "pursuant", "intimation", "announcement", "outcome", "resolution",
    "crore", "lakh", "rupees", "percent", "growth", "increase", "decrease",
    "rating", "credit", "audit", "report", "compliance", "notice", "agm",
    "preferential", "allotment", "buyback", "merger", "acquisition", "demerger"
  ]
  
  const textLower = text.toLowerCase()
  let termMatches = 0
  for (const term of financialTerms) {
    if (textLower.includes(term)) termMatches++
  }
  
  // Calculate word quality
  const words = text.split(/\s+/)
  const validWords = words.filter(w => /^[a-zA-Z]{2,}$/.test(w))
  const wordQuality = validWords.length / Math.max(words.length, 1)
  
  // Text is meaningful if it has 3+ financial terms OR >40% valid words
  return termMatches >= 3 || wordQuality > 0.4
}

/**
 * Attempt to recover meaningful text from garbled PDF content
 */
function recoverTextFromPdf(text: string): string {
  if (!text) return ""
  
  // Extract sentences that look meaningful
  const sentences = text.split(/[.!?\n]+/)
  const meaningfulSentences = sentences.filter(s => {
    const trimmed = s.trim()
    if (trimmed.length < 10) return false
    
    // Check if sentence has reasonable word structure
    const words = trimmed.split(/\s+/)
    const validWords = words.filter(w => /^[a-zA-Z]{2,}$/.test(w))
    return validWords.length >= 3 && validWords.length / words.length > 0.5
  })
  
  if (meaningfulSentences.length > 0) {
    return meaningfulSentences.join(". ").trim()
  }
  
  // If still no good text, extract any recognizable patterns
  const patterns = [
    /(?:company|limited|ltd)[:\s]+([A-Za-z\s]+)/gi,
    /(?:date|dated)[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
    /(?:amount|value|consideration)[:\s]*(₹?[\d,]+(?:\.\d+)?(?:\s*(?:cr|crore|lakh|lac))?)/gi,
    /(?:pursuant to|under|regulation)[:\s]*([^\n]+)/gi,
  ]
  
  const extracted: string[] = []
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[0]) extracted.push(match[0].trim())
    }
  }
  
  return extracted.length > 0 ? extracted.join(" | ") : text.slice(0, 500)
}

/**
 * DEEP-DIVE CORPORATE ANNOUNCEMENTS FRAMEWORK
 * Model-Training Grade | India | Microcap-First
 * Dynamic context-specific prompts per announcement type
 */
function getCategoryPrompt(category: string, headline: string): string {
  const h = headline.toLowerCase()
  
  // PREFERENTIAL ALLOTMENT - Promoter intent revelation
  if (h.includes("preferential") || h.includes("allotment") || h.includes("issue of shares")) {
    return `PREFERENTIAL ALLOTMENT ANALYST. In microcaps, PA = promoter intent revelation. NEVER neutral.

EXTRACT & ANALYZE:
1. ALLOTMENT PRICE vs market/VWAP: Premium=Very Bullish, ≤5% discount=Bullish, 10-25%=Caution, >25%=DISTRESS
2. ALLOTTEE IDENTITY: Promoter/Group=highest signal, PE/Strategic=bullish, Unknown HNI/LLP=RED FLAG
3. DILUTION %: New shares / old equity - minority impact
4. FUND USE: Capex=positive, Working capital=neutral, Debt repay=negative, Promoter loan repay=RED FLAG

RED FLAGS TO CALL OUT:
❌ Serial PAs every 12-24 months ❌ PA after price crash ❌ Lock-in near promoter exit

CRITICAL: Extract EXACT price (₹5.48 not ₹48), exact %, exact allottee names.

OUTPUT JSON: {"headline":"2-3 sentences: State the *exact price*, *premium/discount %*, who is getting shares (promoter/PE/unknown), and what this signals about company confidence","sentiment":"positive|negative|neutral","keyInsights":["Pricing signal","Allottee quality signal"],"riskFactors":["Specific red flag if any"],"strengths":["If promoter/PE participation"],"challenges":["Dilution concern if >10%"]}`
  }
  
  // M&A / DEMERGER - Most microcap M&A is value transfer
  if (h.includes("merger") || h.includes("demerger") || h.includes("amalgamation") || h.includes("acquisition") || h.includes("takeover")) {
    return `M&A/DEMERGER ANALYST. Most microcap M&A = value TRANSFER, not creation.

EXTRACT & ANALYZE:
1. RELATED PARTY: Promoter involvement? If yes, check swap ratio fairness CRITICALLY
2. SWAP RATIO: Compare ROCE, margins, growth of BOTH entities. Weaker gets favorable = MINORITY EXPROPRIATION
3. VALUATION METHOD: DCF/NAV/Market - obscure merchant banker = RED FLAG
4. DEMERGER MOTIVE: Unlock high-ROCE unit=Positive, Segregate bad assets=Negative, Reduce scrutiny=RED FLAG

RED FLAGS:
❌ Complex multi-layer structure ❌ No independent director approval ❌ Assets at book not market value

CRITICAL: Extract EXACT swap ratio, EXACT valuations, entity names.

OUTPUT JSON: {"headline":"2-3 sentences: Explain the deal structure, *swap ratio*, whether related party, and impact on minority shareholders","sentiment":"positive|negative|neutral","keyInsights":["Swap ratio fairness","Value creation/transfer"],"riskFactors":["Minority impact if unfair"],"strengths":["If unlocking value"],"challenges":["Integration/execution risk"]}`
  }
  
  // BUYBACK - Confidence or price-support theater
  if (h.includes("buyback") || h.includes("buy back") || h.includes("buy-back")) {
    return `BUYBACK ANALYST. In microcaps, buybacks = confidence OR price-support theater.

EXTRACT & ANALYZE:
1. BUYBACK PRICE vs CMP: Premium=Strong confidence, At market=Neutral
2. % OF EQUITY: >10%=Material, <5%=Token
3. METHOD: Tender (check if promoters tender) vs Open market
4. FUNDING: FCF funded=Strong Bullish, Debt funded=RED FLAG

SIGNAL GRID:
• Premium + FCF funded = STRONG BULLISH
• Open market small % = Neutral/Suspicious
• During earnings decline = Price support theater

RED FLAGS:
❌ Debt-funded buyback ❌ Coincides with pledge increase ❌ No dividend history

CRITICAL: Extract EXACT buyback price, EXACT %, funding source.

OUTPUT JSON: {"headline":"2-3 sentences: State *buyback price*, *% of equity*, funding source (cash/debt), and what this signals about management confidence","sentiment":"positive|negative|neutral","keyInsights":["Price signal","Funding quality"],"riskFactors":["If debt-funded or suspicious timing"],"strengths":["If premium + cash funded"],"challenges":["Acceptance ratio uncertainty"]}`
  }
  
  // PLEDGE - Financial stress meter
  if (h.includes("pledge") || h.includes("encumbrance") || h.includes("invocation")) {
    return `PLEDGE ANALYST. Pledge = FINANCIAL STRESS METER. Changes matter > absolute.

EXTRACT & ANALYZE:
1. % SHARES PLEDGED: Current level - >50% = HIGH RISK
2. CHANGE DIRECTION: Reduction=Strong Positive, Fresh pledge=Very Negative, Stable high=Ongoing risk
3. LENDER TYPE: PSU Bank < NBFC < Private < Unnamed (worst)
4. TRIGGER: Why now? Post-results pledge increase = RED FLAG

SIGNAL GRID:
• Pledge REDUCTION = Strong Positive (stress reducing)
• FRESH pledge = Very Negative (new stress)
• Near-control level (>50%) = Liquidation risk

RED FLAGS:
❌ Pledge increase after good results ❌ Repeated top-ups ❌ Unnamed lender

CRITICAL: Extract EXACT % pledged, EXACT change (from X% to Y%), lender name if available.

OUTPUT JSON: {"headline":"2-3 sentences: State *current pledge %*, *change direction and amount*, and what this means for promoter financial health","sentiment":"positive|negative|neutral","keyInsights":["Stress direction","Risk level"],"riskFactors":["If >40% or increasing"],"strengths":["If reducing significantly"],"challenges":["Margin call risk if high"]}`
  }
  
  // ORDERS / CONTRACTS - Only matter if they convert to cash
  if (h.includes("order") || h.includes("contract") || h.includes("award") || h.includes("wins") || h.includes("bagged") || h.includes("received order")) {
    return `ORDER/CONTRACT ANALYST. Orders only matter if they CONVERT TO CASH.

EXTRACT & ANALYZE:
1. ORDER VALUE vs ANNUAL REVENUE: >30%=Material, >50%=Transformative, <10%=Noise
2. CLIENT QUALITY: Govt/PSU=Good visibility, MNC=Quality, Related party=RED FLAG
3. EXECUTION TIMELINE: Years to complete? Advance payment %?
4. MARGIN DISCLOSURE: If not disclosed = assume low margin

RED FLAGS:
❌ MoU without value ❌ No execution timeline ❌ Related party orders ❌ Repeat announcements of same order

SIGNAL CHECK:
• Fixed price + govt client + advance = Strong
• Variable price + private + no advance = Weak

CRITICAL: Extract EXACT order value (₹X Cr), client name, timeline.

OUTPUT JSON: {"headline":"2-3 sentences: State *order value*, *client name/type*, execution timeline, and how material this is vs annual revenue","sentiment":"positive|negative|neutral","keyInsights":["Materiality vs revenue","Client quality"],"riskFactors":["Execution/margin risk"],"strengths":["If material + quality client"],"challenges":["Working capital needs"]}`
  }
  
  // CAPEX / EXPANSION - Value only if ROCE improves
  if (h.includes("capex") || h.includes("expansion") || h.includes("capacity") || h.includes("plant") || h.includes("investment in") || h.includes("setting up")) {
    return `CAPEX/EXPANSION ANALYST. Capex creates value ONLY if ROCE improves.

EXTRACT & ANALYZE:
1. CAPEX SIZE vs current asset base: >50%=Aggressive, 20-50%=Growth, <20%=Maintenance
2. FUNDING MIX: Internal accruals=Best, Equity=Neutral, Debt=Risky
3. PAYBACK/ROCE GUIDANCE: If not given = RED FLAG
4. EXECUTION HISTORY: Past delays? Cost overruns?

FUNDING HIERARCHY:
• Internal accruals = Best (cash generating)
• Equity = Neutral (dilutive)
• Debt = Risky (leverage)

RED FLAGS:
❌ Capex during weak cash flows ❌ No ROCE guidance ❌ Debt-funded aggressive expansion

CRITICAL: Extract EXACT capex amount (₹X Cr), funding source, timeline, capacity addition.

OUTPUT JSON: {"headline":"2-3 sentences: State *capex amount*, *purpose*, *funding source* (internal/debt/equity), and expected capacity/ROCE impact","sentiment":"positive|negative|neutral","keyInsights":["Funding quality","ROCE potential"],"riskFactors":["Execution/leverage risk"],"strengths":["If internal accruals + clear ROI"],"challenges":["Gestation period"]}`
  }
  
  // OPEN OFFER
  if (h.includes("open offer") || h.includes("acquisition offer") || h.includes("takeover offer")) {
    return `OPEN OFFER ANALYST. Check offer price premium and acquirer intent.

EXTRACT & ANALYZE:
1. OFFER PRICE vs CMP: ≥15-25% premium=Serious, At market=Compliance only
2. OFFER SIZE: >26%=Bullish intent, 40-75%=Possible delisting
3. ACQUIRER IDENTITY: Known promoter/PE=Good, Shell/LLP=RED FLAG
4. POST-OFFER INTENTIONS: Delisting? Capital injection? Business change?

CRITICAL: Extract EXACT offer price, EXACT % sought, acquirer name.

OUTPUT JSON: {"headline":"2-3 sentences: State *offer price*, *premium to CMP*, *% stake sought*, and acquirer identity/intent","sentiment":"positive|negative|neutral","keyInsights":["Premium signal","Acquirer intent"],"riskFactors":["If low premium or unknown acquirer"],"strengths":["If significant premium"],"challenges":["Minority squeeze risk"]}`
  }
  
  // RESULTS / FINANCIALS
  if (h.includes("result") || h.includes("financial") || h.includes("quarterly") || h.includes("annual") || h.includes("profit") || h.includes("revenue")) {
    return `RESULTS ANALYST. Focus on quality of earnings.

EXTRACT & ANALYZE:
1. REVENUE GROWTH: YoY and QoQ trend
2. MARGIN MOVEMENT: Expansion=Strong, Contraction=Weak
3. ONE-TIME ITEMS: Exclude for true picture
4. CASH FLOW vs PROFIT: Divergence = RED FLAG

SIGNAL:
• Revenue growth + margin expansion = Strong
• Profit growth without revenue = Efficiency/one-time
• Revenue growth + margin contraction = Competition pressure

CRITICAL: Extract EXACT revenue, profit, margin numbers with YoY change.

OUTPUT JSON: {"headline":"2-3 sentences: State *revenue*, *profit*, *margin %* with YoY changes and quality of earnings commentary","sentiment":"positive|negative|neutral","keyInsights":["Growth quality","Margin trend"],"riskFactors":["If one-time or cash divergence"],"strengths":["Sustainable growth drivers"],"challenges":["Margin pressure if any"]}`
  }
  
  // DEFAULT - General corporate update
  return `MICROCAP ANALYST. Weight PROMOTER CASH BEHAVIOR higher than narrative.

EXTRACT key numbers EXACTLY as written. Identify:
1. Financial impact (₹ amount, %)
2. Governance signal (promoter action)
3. Business implication

CRITICAL: Copy numbers EXACTLY (₹5.48 not ₹48, 15.5% not 15%).

OUTPUT JSON: {"headline":"2-3 sentences explaining the key impact with *exact numbers* and investor implications","sentiment":"positive|negative|neutral","keyInsights":["Primary actionable insight","Secondary insight"],"riskFactors":["Specific risk if any"],"strengths":["Positive signal"],"challenges":["Challenge if any"]}`
}

/**
 * Generate enhanced summary using OpenAI with category-specific analysis
 */
async function generateOpenAISummary(
  apiKey: string,
  headline: string,
  summary: string,
  pdfContent?: string,
  category?: string
): Promise<string> {
  const textToSummarize = preprocessTextForSummary(
    `${headline}\n\n${summary}\n\n${pdfContent || ""}`
  )

  if (textToSummarize.length < 50) {
    return "" // Not enough content
  }

  // Get structured prompt
  const categoryPrompt = getCategoryPrompt(category || "", headline)

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
        { role: "user", content: `Analyze and return JSON:\n\nHeadline: ${headline}\n\nContent:\n${textToSummarize.slice(0, 6000)}` }
      ],
      max_tokens: 600,
      temperature: 0.2,
      response_format: { type: "json_object" }
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const generatedSummary = data.choices?.[0]?.message?.content?.trim()

  return postProcessSummary(generatedSummary || "")
}
