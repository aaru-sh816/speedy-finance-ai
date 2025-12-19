/**
 * Investor Classification System
 * Distinguishes between Individual investors and Institutional (companies/advisors/securities)
 */

// Keywords that indicate institutional investors
const INSTITUTIONAL_KEYWORDS = [
  'securities', 'broking', 'broker', 'brokerage', 'trading',
  'capital', 'investments', 'investment', 'fund', 'funds', 'asset', 'assets',
  'wealth', 'portfolio', 'equity', 'equities', 'venture',
  'limited', 'ltd', 'pvt', 'private', 'company', 'corp', 'corporation',
  'holdings', 'enterprises', 'industries', 'group', 'associates',
  'bank', 'banking', 'finance', 'financial', 'finsol', 'finserv',
  'advisors', 'advisory', 'consultants', 'consulting', 'services',
  'insurance', 'mutual', 'amc', 'trustee', 'trust',
  'fii', 'dii', 'nri', 'foreign', 'institutional', 'overseas',
  'nbfc', 'leasing', 'factoring', 'microfinance',
  'huf', 'llp', 'partnership', 'partners',
]

const INSTITUTIONAL_PATTERNS = [
  /\b(securities|broking|capital|investments?|fund|funds|asset|wealth|equity|equities)\b/i,
  /\b(limited|ltd|pvt|private|llp)\b/i,
  /\b(advisors?|advisory|consultants?)\b/i,
  /\b(bank|banking|finance|financial|insurance)\b/i,
  /\b(holdings?|enterprises?|industries|group|associates?)\b/i,
  /\b(fii|dii|nri|foreign|institutional|overseas)\b/i,
  /\b(huf|trust|trustee|mutual)\b/i,
]

const KNOWN_INDIVIDUALS = [
  'rakesh jhunjhunwala', 'rekha jhunjhunwala',
  'dolly khanna', 'rajiv khanna',
  'radhakishan damani', 'gopikishan damani',
  'vijay kedia', 'porinju veliyath',
  'ashish kacholia', 'basant maheshwari',
  'madhu kela', 'nemish shah',
  'sunil singhania', 'kenneth andrade',
  'ramesh damani', 'shankar sharma',
  'raamdeo agrawal', 'motilal oswal',
  'vallabh bhansali', 'prashant jain',
  'samir arora', 'saurabh mukherjea',
  'anil kumar goel', 'mukul agrawal',
  'hitesh parekh', 'mohnish pabrai',
]

export type InvestorType = 'individual' | 'institutional' | 'unknown'

export interface InvestorClassification {
  type: InvestorType
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export function classifyInvestor(clientName: string): InvestorClassification {
  if (!clientName || clientName.trim().length === 0) {
    return { type: 'unknown', confidence: 'low', reason: 'Empty name' }
  }

  const nameLower = clientName.toLowerCase().trim()
  const nameWords = nameLower.split(/\s+/)

  if (KNOWN_INDIVIDUALS.some(known => nameLower.includes(known))) {
    return { type: 'individual', confidence: 'high', reason: 'Known individual investor' }
  }

  for (const pattern of INSTITUTIONAL_PATTERNS) {
    if (pattern.test(clientName)) {
      return { type: 'institutional', confidence: 'high', reason: 'Matches institutional pattern' }
    }
  }

  for (const keyword of INSTITUTIONAL_KEYWORDS) {
    if (nameWords.includes(keyword) || nameLower.includes(keyword)) {
      return { type: 'institutional', confidence: 'medium', reason: `Contains keyword: ${keyword}` }
    }
  }

  if (nameWords.length <= 3) {
    const capitalizedWords = clientName.split(/\s+/).filter(w => /^[A-Z]/.test(w))
    if (capitalizedWords.length >= 2 && capitalizedWords.length <= 4) {
      return { type: 'individual', confidence: 'medium', reason: 'Name structure suggests individual' }
    }
  }

  if (nameWords.length > 4) {
    return { type: 'institutional', confidence: 'low', reason: 'Long name suggests institution' }
  }

  if (nameWords.length <= 2) {
    return { type: 'individual', confidence: 'low', reason: 'Short name, assumed individual' }
  }

  return { type: 'unknown', confidence: 'low', reason: 'Unable to determine' }
}

export function getInvestorTypeLabel(type: InvestorType): string {
  switch (type) {
    case 'individual': return 'Individual'
    case 'institutional': return 'Institutional'
    default: return 'Unknown'
  }
}

export function getInvestorTypeIcon(type: InvestorType): string {
  switch (type) {
    case 'individual': return '👤'
    case 'institutional': return '🏢'
    default: return '❓'
  }
}

export function getInvestorTypeColor(type: InvestorType): { bg: string; text: string; border: string } {
  switch (type) {
    case 'individual':
      return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' }
    case 'institutional':
      return { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' }
    default:
      return { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' }
  }
}
