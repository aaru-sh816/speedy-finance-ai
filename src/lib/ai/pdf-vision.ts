import { chunkPages, embedTexts } from "./vector"

// Suppress pdf2json internal warnings globally - must be FIRST
const originalConsoleWarn = console.warn
const originalConsoleError = console.error
const suppressedPatterns = [
  'TT:', 'fake worker', 'undefined function', 'invalid function',
  'Unsupported:', 'NOT valid', 'complementing', 'TODO:', 'SMask',
  'pdf2json', 'pdfParser', 'Setting up'
]
console.warn = (...args: any[]) => {
  const msg = args[0]?.toString() || ''
  if (suppressedPatterns.some(p => msg.includes(p))) return
  originalConsoleWarn.apply(console, args)
}
console.error = (...args: any[]) => {
  const msg = args[0]?.toString() || ''
  if (suppressedPatterns.some(p => msg.includes(p))) return
  originalConsoleError.apply(console, args)
}

interface ExtractedEntity {
  type: "person" | "amount" | "date" | "company" | "shares" | "percentage"
  value: string
  raw: string
  page: number
  confidence: number
}

interface TableData {
  headers: string[]
  rows: string[][]
  page: number
}

interface VisionExtractionResult {
  pages: { page: number; text: string; entities: ExtractedEntity[] }[]
  tables: TableData[]
  allEntities: ExtractedEntity[]
  summary: string
  rawText: string
}

const INDIAN_NAME_PATTERNS = [
  /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Shri|Smt\.?|Sh\.?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/gi,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s*[-–]\s*(?:Director|Chairman|CEO|CFO|MD|Managing Director|Promoter|Investor|Shareholder))/gi,
  /(?:Name|Allottee|Investor|Shareholder|Client|Person|Director|Beneficiary)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi,
  /(?:^|\n|\|)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\||\n|$)/gm
]

const AMOUNT_PATTERNS = [
  /₹\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|Crores|Lakh|Lakhs|L|K|M|B)?/gi,
  /Rs\.?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|Crores|Lakh|Lakhs|L|K|M|B)?/gi,
  /INR\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|Crores|Lakh|Lakhs|Million|Billion)?/gi,
  /([\d,]+(?:\.\d+)?)\s*(?:Crore|Crores|Lakh|Lakhs)\s*(?:rupees|Rupees)?/gi
]

const SHARE_PATTERNS = [
  /([\d,]+)\s*(?:equity\s+)?shares/gi,
  /([\d,]+)\s*(?:equity|preference)\s*(?:shares|securities)/gi,
  /(?:total|aggregate|upto|up\s+to)\s*([\d,]+)\s*shares/gi
]

const DATE_PATTERNS = [
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g,
  /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4})/gi,
  /(?:Record\s+Date|Ex-Date|Payment\s+Date|Effective\s+Date)\s*[:\-]?\s*(\d{1,2}[-\/\s][A-Za-z]+[-\/\s]\d{2,4})/gi
]

const PERCENTAGE_PATTERNS = [
  /([\d.]+)\s*%/g,
  /([\d.]+)\s*percent/gi
]

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\x00-\x7F\u0900-\u097F₹%]/g, "")
    .trim()
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch (e) {
    return text
  }
}

function extractEntitiesFromText(text: string, pageNum: number): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  for (const pattern of INDIAN_NAME_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const name = (match[1] || match[0]).trim()
      if (name.length > 5 && name.length < 60 && !seen.has(name.toLowerCase())) {
        const words = name.split(/\s+/)
        if (words.length >= 2 && words.every(w => /^[A-Z][a-z]+$/.test(w))) {
          seen.add(name.toLowerCase())
          entities.push({
            type: "person",
            value: name,
            raw: match[0],
            page: pageNum,
            confidence: 0.9
          })
        }
      }
    }
  }

  for (const pattern of AMOUNT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const amount = match[0].trim()
      if (!seen.has(amount)) {
        seen.add(amount)
        entities.push({
          type: "amount",
          value: match[1] || amount,
          raw: amount,
          page: pageNum,
          confidence: 0.95
        })
      }
    }
  }

  for (const pattern of SHARE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const shares = match[0].trim()
      if (!seen.has(shares)) {
        seen.add(shares)
        entities.push({
          type: "shares",
          value: match[1] || shares,
          raw: shares,
          page: pageNum,
          confidence: 0.95
        })
      }
    }
  }

  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const date = (match[1] || match[0]).trim()
      if (!seen.has(date)) {
        seen.add(date)
        entities.push({
          type: "date",
          value: date,
          raw: match[0],
          page: pageNum,
          confidence: 0.9
        })
      }
    }
  }

  for (const pattern of PERCENTAGE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const pct = match[0].trim()
      if (!seen.has(pct)) {
        seen.add(pct)
        entities.push({
          type: "percentage",
          value: match[1] || pct,
          raw: pct,
          page: pageNum,
          confidence: 0.95
        })
      }
    }
  }

  return entities
}

function extractTablesFromText(text: string, pageNum: number): TableData[] {
  const tables: TableData[] = []
  const lines = text.split(/\n/)
  let tableLines: string[] = []
  let inTable = false

  const splitRow = (line: string): string[] => {
    if (line.includes("|")) {
      return line.split("|").map(c => c.trim()).filter(c => c.length > 0)
    }
    if (/\t/.test(line)) {
      return line.split(/\t+/).map(c => c.trim()).filter(c => c.length > 0)
    }
    const parts = line.split(/\s{2,}/).map(c => c.trim()).filter(c => c.length > 0)
    if (parts.length >= 2) return parts
    
    const numericPattern = /(-?\d[\d,]*\.?\d*%?|\(\d[\d,]*\.?\d*\))/g
    const numbers = line.match(numericPattern)
    if (numbers && numbers.length >= 2) {
      let remaining = line
      const cols: string[] = []
      for (const num of numbers) {
        const idx = remaining.indexOf(num)
        if (idx > 0) {
          const prefix = remaining.slice(0, idx).trim()
          if (prefix) cols.push(prefix)
        }
        cols.push(num)
        remaining = remaining.slice(idx + num.length)
      }
      if (remaining.trim()) cols.push(remaining.trim())
      if (cols.length >= 2) return cols
    }
    return [line.trim()]
  }

  const processTableLines = (lines: string[]) => {
    if (lines.length < 2) return
    
    const rows = lines.map(splitRow).filter(r => r.length > 0)
    if (rows.length < 2) return

    const colCounts = rows.map(r => r.length)
    const freq: Record<number, number> = {}
    colCounts.forEach(c => { freq[c] = (freq[c] || 0) + 1 })
    const mostCommon = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    const targetCols = parseInt(mostCommon[0])
    
    if (targetCols < 2) return
    
    const normalizedRows = rows.filter(r => 
      r.length >= targetCols - 1 && r.length <= targetCols + 1
    )
    
    if (normalizedRows.length >= 2) {
      tables.push({
        headers: normalizedRows[0],
        rows: normalizedRows.slice(1),
        page: pageNum
      })
    }
  }

  const tableKeywords = /particulars|description|quarter|year|audited|unaudited|statement|financial|standalone|consolidated|revenue|profit|income|expense|assets|liabilities|equity|total|net|gross/i

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inTable && tableLines.length > 0) {
        processTableLines(tableLines)
        inTable = false
        tableLines = []
      }
      continue
    }

    const cols = splitRow(trimmed)
    const hasMultipleColumns = cols.length >= 2
    const hasNumbers = /\d/.test(trimmed)
    const hasKeyword = tableKeywords.test(trimmed)

    if (hasMultipleColumns || (inTable && (hasNumbers || hasKeyword))) {
      if (!inTable) {
        inTable = true
        tableLines = []
      }
      tableLines.push(trimmed)
    } else if (inTable) {
      if (tableLines.length >= 2) {
        processTableLines(tableLines)
      }
      inTable = false
      tableLines = []
    }
  }

  if (inTable && tableLines.length >= 2) {
    processTableLines(tableLines)
  }

  return tables
}

function getBSEPdfUrlVariants(pdfUrl: string): string[] {
  const cleanUrl = pdfUrl.replace(/["']/g, "").trim()
  const urls: string[] = []
  
  if (cleanUrl.includes('/AttachLive/')) {
    urls.push(cleanUrl.replace('/AttachLive/', '/AttachHis/'))
    urls.push(cleanUrl)
  } else if (cleanUrl.includes('/AttachHis/')) {
    urls.push(cleanUrl)
    urls.push(cleanUrl.replace('/AttachHis/', '/AttachLive/'))
  } else {
    urls.push(cleanUrl)
  }
  
  return urls
}

async function extractWithPythonService(
  pdfUrl: string
): Promise<{ text: string; pages: any[]; tables: any[]; usedUrl: string } | null> {
  const bseServiceUrl = process.env.BSE_SERVICE_URL
  if (!bseServiceUrl) return null

  const urlVariants = getBSEPdfUrlVariants(pdfUrl)
  
  for (const url of urlVariants) {
    try {
      console.log(`[PDF-Vision] Trying Python service with: ${url.slice(0, 80)}...`)
      const response = await fetch(`${bseServiceUrl}/api/pdf/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(60000),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && (result.text || result.combined_text)) {
          console.log(`[PDF-Vision] Success with URL: ${url.slice(0, 80)}...`)
          return {
            text: result.text || result.combined_text || "",
            pages: result.pages || [],
            tables: result.tables || [],
            usedUrl: url
          }
        }
      }
    } catch (e: any) {
      console.log(`[PDF-Vision] Python service failed for ${url.slice(0, 50)}:`, e.message)
    }
  }
  return null
}

async function extractWithGPT4oVision(
  pdfUrl: string,
  openaiKey: string
): Promise<{ text: string; analysis: string } | null> {
  return null
}

// Global cache for PDF extraction results to prevent redundant processing
const extractionCache = new Map<string, VisionExtractionResult>()

export async function extractPdfWithVision(
  pdfUrl: string,
  openaiKey: string
): Promise<VisionExtractionResult> {
  // Check cache first
  const cacheKey = pdfUrl.trim()
  if (extractionCache.has(cacheKey)) {
    console.log(`[PDF-Vision] Returning cached result for: ${cacheKey.slice(0, 50)}...`)
    return extractionCache.get(cacheKey)!
  }

  let pages: { page: number; text: string; entities: ExtractedEntity[] }[] = []
  let tables: TableData[] = []
  let allEntities: ExtractedEntity[] = []
  let summary = ""
  let rawText = ""

  // 1. Try Python Service first (most reliable for BSE PDFs)
  const pythonResult = await extractWithPythonService(pdfUrl)
  
  if (pythonResult) {
    rawText = pythonResult.text
    
    if (pythonResult.pages && pythonResult.pages.length > 0) {
      for (const p of pythonResult.pages) {
        const pageEntities = extractEntitiesFromText(p.text, p.page || 1)
        pages.push({
          page: p.page || 1,
          text: p.text,
          entities: pageEntities
        })
        allEntities.push(...pageEntities)
      }
    } else if (rawText) {
      const entities = extractEntitiesFromText(rawText, 1)
      pages.push({ page: 1, text: rawText, entities })
      allEntities.push(...entities)
    }

    if (pythonResult.tables && pythonResult.tables.length > 0) {
      for (const t of pythonResult.tables) {
        tables.push({
          headers: t.headers || [],
          rows: t.rows || [],
          page: t.page || 1
        })
      }
    }
  }

  // 2. Try GPT-4 Vision placeholder (currently disabled)
  if (!rawText) {
    const visionResult = await extractWithGPT4oVision(pdfUrl, openaiKey)
    
    if (visionResult) {
      rawText = visionResult.text
      const visionEntities = extractEntitiesFromText(visionResult.analysis, 1)
      const visionTables = extractTablesFromText(visionResult.analysis, 1)
      
      pages.push({
        page: 1,
        text: visionResult.text,
        entities: visionEntities
      })
      tables.push(...visionTables)
      allEntities.push(...visionEntities)
      
      const summaryMatch = visionResult.analysis.match(/## SUMMARY\n([\s\S]*?)(?:\n##|$)/i)
      summary = summaryMatch ? summaryMatch[1].trim() : ""
    }
  }

  // 3. Fallback to pdf2json if others failed or as a supplement
  if (!rawText || rawText.length < 200) {
    const urlVariants = getBSEPdfUrlVariants(pdfUrl)
    
    for (const url of urlVariants) {
      if (rawText && rawText.length >= 200) break
      
      try {
        const PDFParser = (await import("pdf2json")).default
        console.log(`[PDF-Vision] Trying pdf2json with: ${url.slice(0, 80)}...`)
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.bseindia.com/",
            "Accept": "application/pdf",
          },
          cache: "no-store",
        })
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
            console.log(`[PDF-Vision] Skipping non-PDF response: ${contentType}`)
            continue
          }
          
          const arrayBuf = await response.arrayBuffer()
          if (arrayBuf.byteLength < 1000) {
            console.log(`[PDF-Vision] Response too small, likely error page`)
            continue
          }
          
          const pdfParser = new PDFParser()
          
          const textPromise = new Promise<{ page: number; text: string }[]>((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
              try {
                const rawPages = pdfData?.Pages || []
                const extractedPages: { page: number; text: string }[] = []
                
                for (let i = 0; i < rawPages.length; i++) {
                  const page = rawPages[i]
                  const pageTextParts: string[] = []
                  const texts = page.Texts || []
                  for (const textItem of texts) {
                    const runs = textItem.R || []
                    for (const run of runs) {
                      if (run.T) {
                        pageTextParts.push(safeDecode(run.T))
                      }
                    }
                  }
                  const pageText = pageTextParts.join(" ").replace(/\s+/g, " ").trim()
                  if (pageText) {
                    extractedPages.push({ page: i + 1, text: pageText })
                  }
                }
                resolve(extractedPages)
              } catch (e) {
                reject(e)
              }
            })
            pdfParser.on("pdfParser_dataError", reject)
          })
          
          pdfParser.parseBuffer(Buffer.from(arrayBuf))
          const textPages = await textPromise
          
          if (textPages.length > 0) {
            console.log(`[PDF-Vision] pdf2json success with: ${url.slice(0, 80)}...`)
            rawText = textPages.map(p => p.text).join("\n\n")
            
            for (const tp of textPages) {
              const pageEntities = extractEntitiesFromText(tp.text, tp.page)
              const pageTables = extractTablesFromText(tp.text, tp.page)
              
              const existingPage = pages.find(p => p.page === tp.page)
              if (existingPage) {
                existingPage.text += "\n" + tp.text
                existingPage.entities.push(...pageEntities)
              } else {
                pages.push({
                  page: tp.page,
                  text: tp.text,
                  entities: pageEntities
                })
              }
              
              tables.push(...pageTables)
              allEntities.push(...pageEntities)
            }
            break
          }
        }
      } catch (e) {
        console.log(`[PDF-Vision] pdf2json failed for ${url.slice(0, 50)}`)
      }
    }
  }

  const uniqueEntities = allEntities.reduce((acc, entity) => {
    const key = `${entity.type}:${entity.value.toLowerCase()}`
    if (!acc.has(key)) {
      acc.set(key, entity)
    } else {
      const existing = acc.get(key)!
      if (entity.confidence > existing.confidence) {
        acc.set(key, entity)
      }
    }
    return acc
  }, new Map<string, ExtractedEntity>())

  const result = {
    pages,
    tables,
    allEntities: Array.from(uniqueEntities.values()),
    summary,
    rawText
  }

  // Cache result for future use
  if (rawText && rawText.length > 100) {
    extractionCache.set(cacheKey, result)
    console.log(`[PDF-Vision] Cached result for: ${cacheKey.slice(0, 50)}...`)
  }

  return result
}

export function formatEntitiesForPrompt(entities: ExtractedEntity[]): string {
  const byType = entities.reduce((acc, e) => {
    if (!acc[e.type]) acc[e.type] = []
    acc[e.type].push(e)
    return acc
  }, {} as Record<string, ExtractedEntity[]>)

  let output = ""

  if (byType.person?.length) {
    output += "\n### PERSONS/NAMES FOUND:\n"
    output += byType.person.map(e => `- ${e.value} (page ${e.page})`).join("\n")
  }

  if (byType.amount?.length) {
    output += "\n\n### FINANCIAL AMOUNTS:\n"
    output += byType.amount.map(e => `- ${e.raw} (page ${e.page})`).join("\n")
  }

  if (byType.shares?.length) {
    output += "\n\n### SHARE QUANTITIES:\n"
    output += byType.shares.map(e => `- ${e.raw} (page ${e.page})`).join("\n")
  }

  if (byType.date?.length) {
    output += "\n\n### DATES:\n"
    output += byType.date.map(e => `- ${e.raw} (page ${e.page})`).join("\n")
  }

  if (byType.percentage?.length) {
    output += "\n\n### PERCENTAGES:\n"
    output += byType.percentage.map(e => `- ${e.raw} (page ${e.page})`).join("\n")
  }

  return output
}

export function formatTablesForPrompt(tables: TableData[]): string {
  if (tables.length === 0) return ""

  let output = "\n\n### TABLES EXTRACTED:\n"

  for (const table of tables) {
    output += `\n**Table (Page ${table.page}):**\n`
    output += `| ${table.headers.join(" | ")} |\n`
    output += `| ${table.headers.map(() => "---").join(" | ")} |\n`
    for (const row of table.rows) {
      output += `| ${row.join(" | ")} |\n`
    }
  }

  return output
}
