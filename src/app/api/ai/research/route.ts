import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o"

const RESEARCH_SYSTEM_PROMPT = `You are SpeedyPip Research, an elite financial research assistant for Indian stock market analysis.

## YOUR ROLE
You help users write investment research notes. You are embedded INSIDE the user's note editor.
The user is currently writing a research note about a specific stock. Help them by:
- Drafting investment theses
- Analyzing risks
- Extracting earnings data
- Suggesting tags, sentiment, and confidence levels
- Answering any question about the stock

## FORMAT RULES
- Write in clean markdown suitable for a research note
- Use ## headings, bullet points, and **bold** for key data
- Be specific with numbers: use ₹ for Indian currency, show % changes
- Keep responses focused and actionable
- No preamble - start with the content directly

## CONTEXT
You will receive:
- The stock's scripCode, symbol, and company name
- The current note title and content (if any)
- The user's question or action request

## FOR AUTO-TAG REQUESTS
When asked to auto-tag, analyze the note content and respond with a JSON block:
\`\`\`json
{"sentiment": "bullish|bearish|neutral", "confidence": 1-5, "timeframe": "short|medium|long", "tags": ["tag1", "tag2"]}
\`\`\`
`

interface ResearchRequest {
  message?: string
  scripCode?: string
  symbol?: string
  companyName?: string
  noteContent?: string
  noteTitle?: string
  type?: "research" | "swot" | "auto-tag"
}

const SWOT_SYSTEM_PROMPT = `You are a strategic financial analyst specializing in the Indian stock market.
Conduct a professional SWOT analysis for the given company.
Respond ONLY with a JSON object in this exact format:
{
  "strengths": ["point 1", "point 2", ...],
  "weaknesses": ["point 1", "point 2", ...],
  "opportunities": ["point 1", "point 2", ...],
  "threats": ["point 1", "point 2", ...],
  "summary": "A concise executive summary of the overall strategic position."
}
Be specific to the company's sector, financials, and recent market developments.`

export async function POST(request: Request) {
  try {
    const body: ResearchRequest = await request.json()
    const { message, scripCode, symbol, companyName, noteContent, noteTitle, type = "research" } = body

    if (!message && type === "research") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 })
    }

    // Build context
    let contextBlock = ""
    if (scripCode || symbol || companyName) {
      contextBlock += `\n## STOCK CONTEXT\n`
      if (companyName) contextBlock += `- Company: ${companyName}\n`
      if (symbol) contextBlock += `- Symbol: ${symbol}\n`
      if (scripCode) contextBlock += `- BSE Code: ${scripCode}\n`
    }

    if (noteTitle || noteContent) {
      contextBlock += `\n## CURRENT NOTE\n`
      if (noteTitle) contextBlock += `Title: ${noteTitle}\n`
      if (noteContent) contextBlock += `Content:\n${noteContent.slice(0, 5000)}\n`
    }

    // Fetch live data for context
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    let marketData = ""

    if (scripCode) {
      try {
        // Fetch announcements and quote in parallel
        const [annRes, quoteRes, fundamentalsRes] = await Promise.all([
          fetch(`${baseUrl}/api/bse/announcements?scripCode=${scripCode}&maxPages=3`).catch(() => null),
          fetch(`${baseUrl}/api/bse/enhanced-quote?scripCode=${scripCode}`).catch(() => null),
          fetch(`${baseUrl}/api/finedge/company/${scripCode}`).catch(() => null),
        ])

        if (annRes?.ok) {
          const annData = await annRes.json()
          const recentAnns = (annData.announcements || []).slice(0, 5)
          if (recentAnns.length > 0) {
            marketData += `\n## RECENT ANNOUNCEMENTS\n`
            recentAnns.forEach((a: any) => {
              marketData += `- [${a.time}] ${a.headline} (${a.category})\n`
            })
          }
        }

        if (quoteRes?.ok) {
          const quoteData = await quoteRes.json()
          const q = quoteData.data
          if (q) {
            marketData += `\n## LIVE QUOTE\n`
            marketData += `- Price: ₹${q.currentValue || q.ltp}\n`
            marketData += `- Change: ${q.change} (${q.pChange}%)\n`
            marketData += `- Day Range: ₹${q.dayLow} - ₹${q.dayHigh}\n`
            marketData += `- Volume: ${q.totalTradedQuantity}\n`
          }
        }

        if (fundamentalsRes?.ok) {
          const fundamentalsData = await fundamentalsRes.json()
          marketData += `\n## FINANCIAL FUNDAMENTALS\n`
          marketData += JSON.stringify(fundamentalsData.summary || fundamentalsData).slice(0, 2000)
        }
      } catch (e) {
        console.error("[Research API] Market data fetch error:", e)
      }
    }

    if (type === "swot") {
      const messages = [
        { role: "system", content: SWOT_SYSTEM_PROMPT + contextBlock + marketData },
        { role: "user", content: `Conduct SWOT for ${companyName || symbol || scripCode}` },
      ]

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          response_format: { type: "json_object" },
          max_tokens: 1500,
        }),
      })

      if (!response.ok) throw new Error("OpenAI API error")
      const data = await response.json()
      return NextResponse.json({ content: data.choices[0].message.content })
    }

    const isAutoTag = /auto.?tag|suggest.*tag|categorize|classify/i.test(message || "")

    const messages = [
      { role: "system", content: RESEARCH_SYSTEM_PROMPT + contextBlock + marketData },
      { role: "user", content: message },
    ]

    // Stream response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: OPENAI_MODEL,
              messages,
              stream: true,
              max_tokens: 2000,
            }),
          })

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let fullContent = ""

          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const lines = chunk.split("\n")

              for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                  try {
                    const data = JSON.parse(line.slice(6))
                    const content = data.choices?.[0]?.delta?.content
                    if (content) {
                      fullContent += content
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", content })}\n\n`))
                    }
                  } catch {}
                }
              }
            }
          }

          // Check for auto-tag JSON in response
          if (isAutoTag) {
            const jsonMatch = fullContent.match(/```json\s*\n?([\s\S]*?)\n?```/)
            if (jsonMatch) {
              try {
                const suggestions = JSON.parse(jsonMatch[1])
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "auto-tag", suggestions })}\n\n`))
              } catch {}
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
          controller.close()
        } catch (e) {
          console.error("[Research API] Stream error:", e)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream failed" })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error: any) {
    console.error("[Research API] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
