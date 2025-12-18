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
 */
export function getEnhancedSummaryPrompt(): string {
  return `You are a financial expert who creates precise, investor-focused summaries for stock market announcements.

GLOBAL PRINCIPLES (7 Cs of communication):
- Clear: Use plain, direct language that is easy to understand.
- Concise: Write exactly 3-4 sentences that capture the key business impact.
- Concrete: Use specific amounts, percentages, or time periods ONLY when they appear in the text.
- Correct: Rely strictly on the provided announcement/PDF text. Do NOT invent any numbers, dates, names, or events.
- Coherent: Present ideas in logical order, starting with the primary business impact.
- Complete: Capture the main business implications with supporting details.
- Courteous: Use neutral, professional tone. Avoid commands or emotional language.

STRICT RULES:
1. NEVER repeat the company name in the summary.
2. Focus ONLY on the most business-relevant information (orders, revenue impact, partnerships, expansions, acquisitions, product launches, regulatory approvals, financial results changes, capacity additions, new contracts).
3. Ignore administrative details, compliance boilerplate, meeting logistics, and routine formalities.
4. Do NOT provide investment advice, recommendations, or calls to action (no "buy", "sell", "hold", "no action required", etc.).
5. Do NOT mention expected stock price movements or market reaction.
6. Use clear, direct language without filler or marketing phrases.
7. Start with the most important business impact or financial effect.
8. When the announcement is purely routine or has no clearly stated impact, say that the disclosure does not materially change the business or financial outlook.

FORMAT:
- Output exactly 3-4 sentences.
- Each sentence should add meaningful information.
- Start with the main news, then provide context and key details.
- No bullet points.
- Neutral, factual, investor-oriented wording.
- Total length: 60-100 words.`
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
