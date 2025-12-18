/**
 * Summary Formatter - Bold important figures and terms
 * Ported from speedywhatsapp.py format_summary_with_bold function
 */

/**
 * Format summary with bold markers for important figures and terms
 * This makes the summary more scannable and highlights key information
 */
export function formatSummaryWithBold(summary: string, detectedKeyword?: string): string {
  if (!summary) return summary

  let formatted = summary

  // Currency/amounts patterns
  const patterns = [
    // Indian currency formats
    /\b(Rs\.?\s*[\d,]+(?:\.\d+)?)\b/gi,
    /\b(₹\s*[\d,]+(?:\.\d+)?)\b/gi,
    /\b(INR\s*[\d,]+(?:\.\d+)?)\b/gi,
    // Amount with units
    /\b([\d,]+(?:\.\d+)?\s*(?:cr|crore|crores|cr\.|lakh|lakhs|lac|lacs|million|millions|mn|billion|billions|bn))\b/gi,
    // Percentages
    /\b([+−\-]?\d+(?:\.\d+)?)\s*%/g,
    // Duration/timespan
    /\b(\d+\s*[-–]\s*year(?:s)?)\b/gi,
    /\b(\d+(?:\.\d+)?\s*(?:year|yr|years|month|months|quarter|quarters))\b/gi,
  ]

  // Apply currency and number formatting
  for (const pattern of patterns) {
    formatted = formatted.replace(pattern, '**$1**')
  }

  // Business impact terms
  const businessTerms = [
    'revenue', 'profit', 'loss', 'income', 'earnings',
    'expand', 'expanding', 'expansion', 'expanded',
    'acquire', 'acquired', 'acquisition', 'acquiring',
    'contract', 'tender', 'agreement', 'award', 'awarded',
    'partnership', 'joint venture', 'collaboration',
    'launch', 'introduction', 'release',
    'approval', 'clearance', 'permission', 'regulatory approval',
    'subsidiary', 'division', 'unit', 'facility', 'plant',
    'investment', 'funding', 'financing',
    'dividend', 'bonus', 'split', 'buyback', 'delisting',
  ]

  // Keyword-specific terms
  const dk = detectedKeyword?.toLowerCase() || ''
  if (['order', 'contract', 'tender', 'agreement', 'award', 'mou'].includes(dk)) {
    businessTerms.push(
      'order', 'value', 'worth', 'amount', 'quantity', 'units',
      'supply', 'deliver', 'purchase', 'operate', 'maintain'
    )
  }

  // Bold business terms (only if not already bolded)
  for (const term of businessTerms) {
    const regex = new RegExp(`\\b(${term})\\b(?!\\*\\*)`, 'gi')
    formatted = formatted.replace(regex, '**$1**')
  }

  // Clean up double bold markers
  formatted = formatted.replace(/\*\*\*\*/g, '**')

  return formatted
}

/**
 * Pre-process text before sending to AI
 * Removes administrative jargon and prioritizes business content
 */
export function preprocessTextForSummary(text: string): string {
  if (!text) return ""

  // Administrative phrases to remove
  const adminPhrases = [
    "pursuant to regulation",
    "sebi (listing obligations and disclosure requirements) regulations",
    "we hereby inform",
    "this is to inform",
    "we wish to inform",
    "intimation",
    "compliance",
    "secretarial",
    "registrar and transfer agent",
    "annual general meeting",
    "extraordinary general meeting",
    "book closure",
    "record date",
    "dear shareholders",
    "respected members",
    "sub:",
    "ref:",
    "encl:",
  ]

  let cleaned = text.toLowerCase()
  for (const phrase of adminPhrases) {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '')
  }

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Business keywords to prioritize
  const businessKeywords = [
    'order', 'contract', 'agreement', 'partnership', 'acquisition', 'merger',
    'revenue', 'profit', 'loss', 'expansion', 'launch', 'approval', 'subsidiary',
    'investment', 'fund', 'financing', 'ipo', 'rights issue', 'dividend',
    'split', 'bonus', 'buyback', 'delisting', 'restructuring', 'capacity',
    'plant', 'facility', 'production', 'sales', 'export', 'import'
  ]

  // Split into sentences and prioritize
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim())
  const prioritySentences: string[] = []
  const otherSentences: string[] = []

  for (const sentence of sentences) {
    if (businessKeywords.some(kw => sentence.includes(kw))) {
      prioritySentences.push(sentence.trim())
    } else {
      otherSentences.push(sentence.trim())
    }
  }

  // Combine priority sentences first
  let result = prioritySentences.join('. ')
  if (result.length < 2000 && otherSentences.length > 0) {
    const remaining = 2000 - result.length
    const additional = otherSentences.join('. ').slice(0, remaining)
    result += '. ' + additional
  }

  return result || text.slice(0, 2000)
}

/**
 * Post-process AI-generated summary
 */
export function postProcessSummary(summary: string): string {
  if (!summary) return ""

  let cleaned = summary

  // Remove redundant phrases
  const redundantPhrases = [
    "the company has",
    "the company will",
    "it is informed that",
    "we wish to inform",
    "pursuant to",
    "in compliance with",
    "as per",
    "with reference to",
  ]

  for (const phrase of redundantPhrases) {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '')
  }

  // Clean up spacing and punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  cleaned = cleaned.replace(/^\W+/, '') // Remove leading non-word chars

  // Ensure proper capitalization and ending
  if (cleaned) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.'
    }
  }

  return cleaned
}

/**
 * Get the enhanced prompt for OpenAI summarization
 *
 * This prompt enforces the 7 Cs of communication for "Simple Summary":
 * Clear, Concise, Concrete, Correct, Coherent, Complete (for the main point), Courteous.
 * 
 * Updated: MAX 35 words, WhatsApp-style *bold* for key figures
 */
export function getEnhancedSummaryPrompt(): string {
  return `You are a financial expert creating WhatsApp-style investor summaries.

THE 7 Cs (CRITICAL):
- *Clear*: Plain language, no jargon
- *Concise*: MAX 35 WORDS total (this is STRICT)
- *Concrete*: Bold key numbers with *asterisks* like *₹500 Cr*, *15%*, *Q3 FY25*
- *Correct*: Only use numbers from the text, never invent
- *Coherent*: Lead with impact, then context
- *Complete*: Capture the ONE key takeaway
- *Courteous*: Neutral tone, no advice

FORMATTING (WhatsApp-style):
- Use *asterisks* for bold: *₹100 Cr order*, *25% growth*, *FY25*
- Bold ALL numbers, percentages, amounts, dates
- Bold action words: *secures*, *wins*, *launches*, *expands*
- 2-3 punchy sentences max

STRICT RULES:
1. MAX 35 WORDS - count them
2. Never repeat company name
3. No "buy/sell/hold" advice
4. No stock price predictions
5. Lead with the business impact
6. If routine/no impact: "Routine compliance disclosure with no material business impact."

EXAMPLES:
✓ "*Secures* ₹*850 Cr* defence order for naval systems. *18-month* execution timeline. Strengthens order book by *12%*."
✓ "*Q3 profit jumps 42%* to *₹125 Cr* on strong export demand. *Margins expand 200 bps* to *18.5%*."
✓ "*Acquires* 51% stake in solar JV for *₹200 Cr*. Adds *500 MW* capacity to renewables portfolio."`
}

/**
 * Category to emoji mapping (from speedywhatsapp.py)
 */
export const categoryEmojis: Record<string, string> = {
  "Result": "📊",
  "Board Meeting": "📅",
  "Company Update": "🔔",
  "Corp. Action": "🏢",
  "AGM/EGM": "💲",
  "Insider Trading": "📈",
  "New Listing": "🆕",
  "Others": "📄",
  "General": "📋",
  "Outcome": "✅",
  "Intimation": "📬",
}

/**
 * Keyword to emoji mapping (from speedywhatsapp.py)
 */
export const keywordEmojis: Record<string, string> = {
  "Order": "🛒",
  "Preferential": "🎯",
  "Open Offer": "📜",
  "Memorandum of Understanding": "🤝",
  "MOU": "🤝",
  "Stock Split": "🔢",
  "Bonus": "🎁",
  "Acquisition": "🏬",
  "Collaboration": "👥",
  "Tie Up": "🔗",
  "Buyback": "💵",
  "Tender": "📄",
  "Subsidiary": "🏢",
  "Capacity Expansion": "🔧",
  "Restructuring": "🔄",
  "Agreement": "📝",
  "Scheme of Arrangement": "📑",
  "Solar": "☀️",
  "Green Hydrogen": "💧",
  "Wind Energy": "🌬️",
  "Fund Raising": "💰",
  "QIP": "💹",
  "Awards": "🏆",
  "Award": "🏆",
  "Allotment": "📊",
  "Renewable": "♻️",
  "USFDA": "🇺🇸",
  "Delisting": "❌",
  "Joint Venture": "🤝",
  "Press Release": "📰",
  "Approval": "✅",
  "Launch": "🚀",
  "Commercial": "🏬",
  "Capacity": "🔧",
  "Split": "🔢",
  "Railway": "🚆",
  "Defence": "🛡️",
  "Nuclear": "☢️",
  "Aerospace": "✈️",
  "Battery": "🔋",
  "Lithium": "🧪",
  "Merger": "🔄",
  "Amalgamation": "🔄",
  "Dividend": "💰",
  "Results": "📊",
  "Financial Results": "📊",
}

export function getCategoryEmoji(category: string): string {
  return categoryEmojis[category] || "📋"
}

export function getKeywordEmoji(keyword: string): string {
  return keywordEmojis[keyword] || "🎆"
}
