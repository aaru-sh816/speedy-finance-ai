/**
 * Blacklist filtering for announcements
 * Based on BseIndiaApi news.py implementation
 */

// Keywords to filter out (from news.py)
const FILTERED_KEYWORDS = [
  "trading window",
  "reg. 74 (5)", // demat
  "book closure",
  "investor meet",
  "loss of share",
  "loss of certificate",
  "investor conference",
  "shares in physical",
  "reg. 74(5)",
  "dematerialisation",
  "demat",
]

/**
 * Check if announcement should be filtered out based on blacklisted keywords
 * @param subject - Announcement subject/headline
 * @returns true if announcement should be filtered out
 */
export function isBlacklisted(subject: string): boolean {
  if (!subject) return false
  
  const subjectLower = subject.toLowerCase()
  
  return FILTERED_KEYWORDS.some(keyword => subjectLower.includes(keyword))
}

/**
 * Clean dividend action string
 * 'Interim Dividend - Rs. - 18.0000' => 'Interim Dividend Rs.18.0'
 */
export function cleanDividendAction(str: string): string {
  if (!str) return str
  
  // Split on '-' and strip spaces
  const parts = str.split("-").map(s => s.trim())
  
  if (parts.length < 2) return str
  
  // Last part should be the dividend amount
  const lastPart = parts[parts.length - 1]
  const dividend = parseFloat(lastPart)
  
  if (isNaN(dividend)) return str
  
  // Rejoin without the last part, add cleaned dividend
  const prefix = parts.slice(0, -1).join(" ")
  return `${prefix} ${dividend}`
}

/**
 * Parse shareholder complaints string
 * Looks for integer values between HTML tags
 */
export function parseComplaints(html: string): string {
  if (!html) return html
  
  const matches = html.match(/>(\d+)</g)
  
  if (!matches || matches.length < 4) return html
  
  const numbers = matches.map(m => m.replace(/[><]/g, ""))
  
  return `Pending: ${numbers[0]}\nReceived: ${numbers[1]}\nDisposed: ${numbers[2]}\nUnresolved: ${numbers[3]}`
}

/**
 * Clean announcement subject
 * Remove company name, scrip code etc. and limit to 70 chars
 */
export function cleanSubject(subject: string): string {
  if (!subject) return subject
  
  let cleaned = subject
  
  // If contains Regulation, Notice, or Change and has '-', strip prefix
  if ((cleaned.includes("Regulation") || cleaned.includes("Notice") || cleaned.includes("Change")) && cleaned.includes("-")) {
    const dashIndex = cleaned.indexOf("-")
    cleaned = cleaned.substring(dashIndex + 1).trim()
  }
  
  // Remove XBRL suffix
  if (cleaned.includes("XBRL")) {
    cleaned = cleaned.replace("- XBRL", "").replace("XBRL", "").trim()
  }
  
  // Limit to 70 characters
  if (cleaned.length > 70) {
    cleaned = cleaned.substring(0, 70) + "..."
  }
  
  return cleaned
}
