/**
 * AI Verdict System - World-class sentiment analysis for BSE announcements
 * Ported from speedywhatsapp.py with enhanced TypeScript implementation
 */

export type VerdictType = 
  | "strong_positive" 
  | "positive" 
  | "neutral" 
  | "mixed" 
  | "negative" 
  | "strong_negative"

export interface AIVerdict {
  type: VerdictType
  confidence: number // 0-100
  reasoning: string
}

export interface AISummary {
  verdict: AIVerdict
  simpleSummary: string // What This Means for Investors
  keyInsights: string[] // Main Takeaways at a Glance
  analystCommentary: string // Expert View and Context
  riskFactors?: string[]
  opportunities?: string[]
}

// Keywords for sentiment analysis (from speedywhatsapp.py)
const STRONG_POSITIVE_KEYWORDS = [
  "record profit", "highest ever", "exceptional growth", "beat estimates",
  "bonus shares", "special dividend", "acquisition completed", "expansion",
  "breakthrough", "partnership with", "major contract", "regulatory approval",
  "debt-free", "strong guidance", "upgraded", "outperform", "record revenue",
  "all-time high", "exceeded expectations", "stellar performance", "landmark deal",
  "transformational", "game-changing", "strategic acquisition", "market leader",
]

const POSITIVE_KEYWORDS = [
  "profit", "growth", "increase", "improved", "dividend", "buyback",
  "new order", "contract", "revenue growth", "margin expansion",
  "positive outlook", "recommend", "investor meet", "expansion plan",
  "new product", "market share", "cost reduction", "order", "award",
  "tender", "agreement", "partnership", "collaboration", "launch",
  "approval", "subsidiary", "investment", "funding", "capacity",
  "commercial", "development", "franchise", "strategic",
]

const NEGATIVE_KEYWORDS = [
  "loss", "decline", "decrease", "lower", "concern", "warning",
  "downgrade", "miss", "delay", "postpone", "regulatory issue",
  "show cause", "penalty", "fine", "investigation", "audit concern",
  "resignation", "liquidity", "debt concern", "impairment", "write-off",
  "default", "downward revision", "weak demand", "challenging",
]

const STRONG_NEGATIVE_KEYWORDS = [
  "fraud", "scam", "default", "bankruptcy", "delisting", "suspension",
  "significant loss", "massive decline", "cease operations", "winding up",
  "criminal", "arrest", "seizure", "material weakness", "going concern",
  "forensic audit", "serious irregularities", "embezzlement", "insolvency",
]

const NEUTRAL_KEYWORDS = [
  "routine", "compliance", "intimation", "regulation", "certificate",
  "disclosure", "shareholder", "record date", "book closure",
  "transfer agent", "registrar", "procedural", "annual report",
  "agm", "egm", "board meeting intimation",
]

// Exclude words from speedywhatsapp.py - filter noise
export const EXCLUDE_WORDS = [
  "analyst meet", "annual secretarial compliance", "call transcript", "change in directorate",
  "clarification sought", "investor meet", "name of registrar", "newspaper publication",
  "non-applicability", "non applicability", "secretarial auditor", "related party transaction",
  "asset cover", "closure of trading window", "sustainability report", "rumour verification",
  "authorized key managerial personnel", "determine the materiality of an event",
  "resignation of company secretary", "loss of certificate", "cessation", "audio recording",
  "agency report", "asset liability management statement", "video recording",
  "intimation regarding tax deduction on dividend", "shareholders meeting to be held",
  "quarterly compliance report", "newspaper advertisement", "certificate pursuant to regulation 74(5)",
  "intimation of book", "violations related to code of conduct under",
  "intimation on tax deduction on dividend", "certificate of interest payment",
  "closure of books", "appointment of company secretary and compliance officer",
  "statement of deviation", "certificate from ceo", "physical mode",
  "communication on tax deduction at source", "income tax demand", "gst demand order",
  "demand", "to furnish pan", "unit holding pattern", "district commission",
  "unitholder", "stock options", "gst", "corrigendum",
  "investor education and protection fund authority", "tds", "deduction of tax at source",
  "esop", "esps", "annual general meeting", "annual report", "iepf",
  "to consider and approve financial results", "postal ballot-scrutinizer", "cgst",
  "current movements in share price of the company", "regulation 13(3)", "trading window",
  "compliance-57", "intimation after the end of quarter", "resignation of statutory auditors",
  "certificate on utilization of proceeds", "compliance certificate", "clarification",
  "date of payment of dividend", "intimation of show cause notice", "appointment of statutory",
  "book closure", "audio and video recording", "statement of investor complaints",
  "intimation under regulation 8(2) of the sebi", "xbrl",
  "74 (5) of sebi (dp) regulations", "brsr", "quarterly disclosures",
  "business responsibility and sustainability reporting", "change in rta",
  "regarding dispatching of letter for furnishing of pan", "certificate under regulation 74",
]

/**
 * Check if announcement should be excluded (noise filter)
 */
export function shouldExcludeAnnouncement(text: string): boolean {
  const lowerText = text.toLowerCase()
  return EXCLUDE_WORDS.some(word => lowerText.includes(word.toLowerCase()))
}

/**
 * Analyze announcement and generate AI verdict
 */
export function analyzeAnnouncement(
  headline: string,
  summary: string,
  category: string,
  subCategory?: string,
  pdfContent?: string
): AISummary {
  const fullText = `${headline} ${summary} ${pdfContent || ""}`.toLowerCase()
  
  // Score calculation
  let score = 0
  const matchedKeywords: string[] = []

  // Emphasis lists for regulatory orders/penalties
  const ORDER_TERMS = [
    "order", "direction", "show cause", "show-cause", "warning",
    "penalty", "fine", "debar", "ban", "disgorgement", "sanction",
  ]
  const CLARIFICATION_TERMS = [
    "clarification", "no impact", "no material impact", "does not impact",
    "no change", "no change in", "no effect", "no adverse impact",
  ]

  // Check strong positive
  for (const kw of STRONG_POSITIVE_KEYWORDS) {
    if (fullText.includes(kw)) {
      score += 3
      matchedKeywords.push(kw)
    }
  }

  // Check positive
  for (const kw of POSITIVE_KEYWORDS) {
    if (fullText.includes(kw)) {
      score += 1
      matchedKeywords.push(kw)
    }
  }

  // Check negative
  for (const kw of NEGATIVE_KEYWORDS) {
    if (fullText.includes(kw)) {
      score -= 1
      matchedKeywords.push(kw)
    }
  }

  // Check strong negative
  for (const kw of STRONG_NEGATIVE_KEYWORDS) {
    if (fullText.includes(kw)) {
      score -= 3
      matchedKeywords.push(kw)
    }
  }

  // Extra weighting for regulatory orders/penalties/fines/show-cause
  let orderHits = 0
  for (const term of ORDER_TERMS) {
    if (fullText.includes(term)) {
      score -= 2
      orderHits++
      matchedKeywords.push(term)
    }
  }

  // Clarification / No-impact softener: if no strong-negative signals, lean neutral
  const hasClarification = CLARIFICATION_TERMS.some(t => fullText.includes(t))
  const hasStrongNeg = STRONG_NEGATIVE_KEYWORDS.some(kw => fullText.includes(kw)) || orderHits >= 2

  // Check neutral keywords
  let neutralCount = 0
  for (const kw of NEUTRAL_KEYWORDS) {
    if (fullText.includes(kw)) neutralCount++
  }

  // Determine verdict type
  let verdictType: VerdictType
  let confidence = 70

  if (score >= 5) {
    verdictType = "strong_positive"
    confidence = Math.min(95, 70 + score * 3)
  } else if (score >= 2) {
    verdictType = "positive"
    confidence = Math.min(90, 65 + score * 5)
  } else if (score <= -5) {
    verdictType = "strong_negative"
    confidence = Math.min(95, 70 + Math.abs(score) * 3)
  } else if (score <= -2) {
    verdictType = "negative"
    confidence = Math.min(90, 65 + Math.abs(score) * 5)
  } else if (matchedKeywords.length > 0 && score !== 0) {
    verdictType = "mixed"
    confidence = 60
  } else {
    verdictType = "neutral"
    confidence = neutralCount > 2 ? 85 : 50
  }

  // Clarification adjustment (post decision):
  if (hasClarification) {
    if (!hasStrongNeg && score <= 0) {
      verdictType = "neutral"
      confidence = Math.max(confidence, 70)
    } else if (hasStrongNeg) {
      verdictType = "mixed"
      confidence = Math.max(confidence, 60)
    }
  }

  // Generate insights
  const keyInsights = generateKeyInsights(headline, category, subCategory, verdictType)
  const analystCommentary = generateAnalystCommentary(headline, category, verdictType)
  const simpleSummary = generateSimpleSummary(headline, category, verdictType)

  return {
    verdict: {
      type: verdictType,
      confidence,
      reasoning: matchedKeywords.length > 0 
        ? `Based on: ${matchedKeywords.slice(0, 5).join(", ")}`
        : "Based on category and content analysis"
    },
    simpleSummary,
    keyInsights,
    analystCommentary,
    riskFactors: verdictType.includes("negative") || verdictType === "mixed"
      ? extractRiskFactors(fullText)
      : undefined,
    opportunities: verdictType.includes("positive")
      ? extractOpportunities(fullText)
      : undefined,
  }
}

function generateSimpleSummary(headline: string, category: string, verdict: VerdictType): string {
  const templates: Record<VerdictType, string[]> = {
    strong_positive: [
      "Update signals **strong improvement in business fundamentals**, with clear positive impact on operations or earnings as described in the announcement.",
      "Disclosure highlights **materially favourable developments** that strengthen growth prospects and reinforce the existing business strategy.",
    ],
    positive: [
      "Announcement reflects **constructive progress** with identifiable business benefits, supporting the ongoing strategic and operational direction.",
      "Disclosure indicates **supportive developments** such as new business, capacity, or financial improvements that incrementally strengthen the outlook.",
    ],
    neutral: [
      "**Routine disclosure** or compliance update that does not materially change the business or financial outlook based on the available information.",
      "**Standard corporate communication** where the impact on core operations or earnings is limited or not clearly specified in the text.",
    ],
    mixed: [
      "Announcement contains both **supportive elements and potential risks**, so the overall impact depends on execution and follow-up disclosures.",
      "Disclosure presents **offsetting positives and negatives**, requiring close monitoring of implementation details and any subsequent clarifications.",
    ],
    negative: [
      "Update highlights **adverse developments or pressures** on operations, finances, or compliance that warrant careful attention to future updates.",
      "Disclosure reflects **unfavourable changes or setbacks** that could weigh on performance until mitigating actions or clarifications emerge.",
    ],
    strong_negative: [
      "Announcement points to **serious adverse developments or material risks** that may have significant implications for the business if not resolved.",
      "Disclosure flags **high-impact issues** such as major losses, regulatory actions, or structural concerns requiring close ongoing scrutiny.",
    ],
  }

  const options = templates[verdict]
  return options[Math.floor(Math.random() * options.length)]
}

function generateKeyInsights(
  headline: string, 
  category: string, 
  subCategory: string | undefined,
  verdict: VerdictType
): string[] {
  const insights: string[] = []
  const lower = headline.toLowerCase()

  if (category.includes("Result") || subCategory?.includes("Result")) {
    insights.push("Financial results directly impact valuation multiples")
    insights.push("Compare with consensus estimates and YoY growth")
  }

  if (category.includes("Board Meeting")) {
    insights.push("Board decisions may include dividends, fundraising, or M&A")
    insights.push("Watch for outcome announcement within 24-48 hours")
  }

  if (lower.includes("acquisition") || lower.includes("subsidiary")) {
    insights.push("Acquisitions drive inorganic growth but watch integration costs")
    insights.push("Evaluate strategic fit and synergy potential")
  }

  if (lower.includes("dividend")) {
    insights.push("Dividend signals healthy cash flow and shareholder focus")
    insights.push("Note record date for eligibility")
  }

  if (lower.includes("order") || lower.includes("contract")) {
    insights.push("New orders boost revenue visibility and backlog")
    insights.push("Assess order value relative to annual revenue")
  }

  if (verdict === "strong_positive" || verdict === "positive") {
    insights.push("Positive momentum may attract institutional buying")
  }

  if (verdict === "negative" || verdict === "strong_negative") {
    insights.push("Negative news creates short-term selling pressure")
    insights.push("Monitor management commentary and recovery timeline")
  }

  return insights.slice(0, 4)
}

function generateAnalystCommentary(
  headline: string,
  category: string,
  verdict: VerdictType
): string {
  const commentaries: Record<VerdictType, string[]> = {
    strong_positive: [
      "This represents a significant value creation event. The strategic implications are clearly positive, and we expect the market to react favorably. Consider accumulating on dips.",
      "An exceptional announcement demonstrating strong execution capabilities. This could be a catalyst for stock re-rating. Bullish stance warranted.",
    ],
    positive: [
      "A constructive development aligning with our positive outlook. While not transformational, it reinforces the investment thesis. Maintain positions.",
      "Incrementally positive news supporting the growth narrative. Continue monitoring for sustained momentum. Slight upward bias in outlook.",
    ],
    neutral: [
      "A procedural announcement with limited investment implications. Focus should remain on operational metrics and upcoming results.",
      "Routine corporate update that doesn't materially alter our view. No change to target price or recommendation.",
    ],
    mixed: [
      "This announcement presents a complex picture. Positive elements are balanced by certain concerns. Recommend a balanced approach with careful monitoring.",
      "A development with dual implications requiring nuanced analysis. Net impact depends on execution. Maintain neutral stance pending clarity.",
    ],
    negative: [
      "Concerning development that may pressure near-term performance. While not catastrophic, investors should reassess risk exposure.",
      "A setback requiring attention. Monitor management's response and industry developments. Reduce position sizing if concerns persist.",
    ],
    strong_negative: [
      "A serious development significantly increasing investment risk. Strong recommendation to review position and implement risk controls immediately.",
      "Critical news demanding immediate attention. The situation warrants extreme caution until resolution path becomes clear. Defensive stance advised.",
    ],
  }

  const options = commentaries[verdict]
  return options[Math.floor(Math.random() * options.length)]
}

function extractRiskFactors(text: string): string[] {
  const risks: string[] = []
  
  if (text.includes("regulatory") || text.includes("compliance")) {
    risks.push("Regulatory scrutiny may increase")
  }
  if (text.includes("debt") || text.includes("loan") || text.includes("borrowing")) {
    risks.push("Debt levels may impact future flexibility")
  }
  if (text.includes("delay") || text.includes("postpone")) {
    risks.push("Timeline delays may affect projected outcomes")
  }
  if (text.includes("competition") || text.includes("market share")) {
    risks.push("Competitive pressure in the market")
  }
  if (text.includes("loss") || text.includes("decline")) {
    risks.push("Financial performance concerns")
  }

  return risks.slice(0, 3)
}

function extractOpportunities(text: string): string[] {
  const opportunities: string[] = []
  
  if (text.includes("expansion") || text.includes("growth")) {
    opportunities.push("Growth expansion potential")
  }
  if (text.includes("acquisition") || text.includes("subsidiary")) {
    opportunities.push("Strategic growth through M&A")
  }
  if (text.includes("new product") || text.includes("launch")) {
    opportunities.push("New product/service revenue streams")
  }
  if (text.includes("market") || text.includes("global")) {
    opportunities.push("Market expansion opportunities")
  }
  if (text.includes("order") || text.includes("contract")) {
    opportunities.push("Revenue visibility from order book")
  }

  return opportunities.slice(0, 3)
}

/**
 * Verdict display helpers
 */
export function getVerdictColor(verdict: VerdictType): string {
  const colors: Record<VerdictType, string> = {
    strong_positive: "#10b981",
    positive: "#22c55e",
    neutral: "#6b7280",
    mixed: "#f59e0b",
    negative: "#ef4444",
    strong_negative: "#dc2626",
  }
  return colors[verdict]
}

export function getVerdictBgColor(verdict: VerdictType): string {
  const colors: Record<VerdictType, string> = {
    strong_positive: "bg-emerald-500/20",
    positive: "bg-green-500/20",
    neutral: "bg-zinc-500/20",
    mixed: "bg-amber-500/20",
    negative: "bg-red-500/20",
    strong_negative: "bg-red-600/20",
  }
  return colors[verdict]
}

export function getVerdictLabel(verdict: VerdictType): string {
  const labels: Record<VerdictType, string> = {
    strong_positive: "Strong Positive",
    positive: "Positive",
    neutral: "Neutral",
    mixed: "Mixed",
    negative: "Negative",
    strong_negative: "Strong Negative",
  }
  return labels[verdict]
}

export function getVerdictIcon(verdict: VerdictType): string {
  const icons: Record<VerdictType, string> = {
    strong_positive: "👍👍",
    positive: "👍",
    neutral: "➖",
    mixed: "🔄",
    negative: "👎",
    strong_negative: "👎👎",
  }
  return icons[verdict]
}
