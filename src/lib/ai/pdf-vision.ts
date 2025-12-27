import { chunkPages, embedTexts } from "./vector"

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

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.includes("|") || /\t{2,}/.test(trimmed) || /\s{3,}/.test(trimmed)) {
      if (!inTable) {
        inTable = true
        tableLines = []
      }
      tableLines.push(trimmed)
    } else if (inTable && tableLines.length > 0) {
      if (tableLines.length >= 2) {
        const rows = tableLines.map(l => 
          l.split(/[|\t]/).map(c => c.trim()).filter(c => c.length > 0)
        ).filter(r => r.length > 0)

        if (rows.length >= 2 && rows[0].length >= 2) {
          tables.push({
            headers: rows[0],
            rows: rows.slice(1),
            page: pageNum
          })
        }
      }
      inTable = false
      tableLines = []
    }
  }

  return tables
}

async function extractWithGPT4oVision(
  pdfUrl: string,
  openaiKey: string
): Promise<{ text: string; analysis: string } | null> {
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/pdf",
      },
      cache: "no-store",
    })
    
    if (!response.ok) return null
    
    const arrayBuf = await response.arrayBuffer()
    const base64Pdf = Buffer.from(arrayBuf).toString("base64")
    
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert financial document analyzer. Extract ALL information from this PDF with 100% accuracy.

CRITICAL EXTRACTION REQUIREMENTS:
1. Extract EVERY name mentioned (directors, shareholders, allottees, investors)
2. Extract ALL monetary amounts with units (Cr, Lakh, etc.)
3. Extract ALL dates (record date, ex-date, payment date, etc.)
4. Extract ALL share quantities and percentages
5. Identify and transcribe ALL tables completely
6. Note any corporate actions (dividend, buyback, rights issue, bonus)

OUTPUT FORMAT:
## NAMES FOUND
- [List every person name with their role if mentioned]

## FINANCIAL FIGURES  
- [List every amount with context]

## DATES
- [List every date with its purpose]

## TABLES
[Transcribe any tables in markdown format]

## SUMMARY
[3-line summary of what this document is about]`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL information from this BSE corporate announcement PDF. Be exhaustive - extract every name, every number, every date. Missing information is unacceptable."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0
      }),
    })

    if (!visionResponse.ok) {
      console.log("GPT-4o Vision not available for PDF, falling back to text extraction")
      return null
    }

    const visionData = await visionResponse.json()
    const analysis = visionData.choices?.[0]?.message?.content || ""
    
    return {
      text: analysis,
      analysis
    }
  } catch (e) {
    console.error("GPT-4o Vision extraction failed:", e)
    return null
  }
}

export async function extractPdfWithVision(
  pdfUrl: string,
  openaiKey: string
): Promise<VisionExtractionResult> {
  let pages: { page: number; text: string; entities: ExtractedEntity[] }[] = []
  let tables: TableData[] = []
  let allEntities: ExtractedEntity[] = []
  let summary = ""
  let rawText = ""

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

  try {
    const PDFParser = (await import("pdf2json")).default
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/pdf",
      },
      cache: "no-store",
    })
    
    if (response.ok) {
      const arrayBuf = await response.arrayBuffer()
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
      }
    }
  } catch (e) {
    console.error("pdf2json extraction failed:", e)
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

  return {
    pages,
    tables,
    allEntities: Array.from(uniqueEntities.values()),
    summary,
    rawText
  }
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
