import { analyzeAnnouncement } from "@/lib/ai/verdict"
import { preprocessTextForSummary, postProcessSummary, getEnhancedSummaryPrompt, formatSummaryWithBold } from "@/lib/ai/summaryFormatter"

export const dynamic = "force-dynamic"

async function extractPdfText(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/pdf",
      },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`)
    const arrayBuf = await response.arrayBuffer()
    const data = new Uint8Array(arrayBuf)
    let text = ""
    try {
      const pdfjsLib: any = await import("pdfjs-dist")
      if (pdfjsLib?.GlobalWorkerOptions) {
        try { (pdfjsLib.GlobalWorkerOptions as any).workerSrc = undefined } catch {}
      }
      const task = pdfjsLib.getDocument({ data, disableWorker: true })
      const pdf = await task.promise
      const maxPages = Math.min(pdf.numPages, 20)
      const parts: string[] = []
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((it: any) => (it.str || "")).join(" ")
        parts.push(pageText)
        if (parts.join(" ").length > 120_000) break
      }
      text = parts.join("\n")
    } catch {
      text = ""
    }
    return text
  } catch {
    return ""
  }
}

async function generateOpenAISummary(apiKey: string, headline: string, summary: string, pdfContent?: string): Promise<string> {
  const textToSummarize = preprocessTextForSummary(`${headline}\n\n${summary}\n\n${pdfContent || ""}`)
  if (textToSummarize.length < 50) return ""
  const prompt = getEnhancedSummaryPrompt()
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Summarize this announcement:\n\n${textToSummarize.slice(0, 4000)}` }
      ],
      max_tokens: 150,
      temperature: 0.3,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
  const data = await response.json()
  const generatedSummary = data.choices?.[0]?.message?.content?.trim() || ""
  return postProcessSummary(generatedSummary)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const headline = searchParams.get("headline") || ""
  const summary = searchParams.get("summary") || ""
  const category = searchParams.get("category") || ""
  const subCategory = searchParams.get("subCategory") || undefined
  const pdfUrl = searchParams.get("pdfUrl") || undefined
  const announcementId = searchParams.get("announcementId") || ""

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        const pdfText = pdfUrl ? await extractPdfText(pdfUrl) : ""
        const ai = analyzeAnnouncement(headline, summary, category, subCategory, pdfText)
        let finalSummary = ai.simpleSummary
        const openaiKey = process.env.OPENAI_API_KEY
        if (openaiKey && pdfText) {
          try {
            const enhanced = await generateOpenAISummary(openaiKey, headline, summary, pdfText)
            if (enhanced) finalSummary = enhanced
          } catch {}
        }
        finalSummary = formatSummaryWithBold(finalSummary)
        const payload = { simpleSummary: finalSummary, pdfUsed: !!pdfText && pdfText.length > 50, announcementId }
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`))
      } catch (e: any) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`event: error\n`))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
