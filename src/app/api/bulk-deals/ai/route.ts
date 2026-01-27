import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

interface AnalysisRequest {
  prompt: string
  ticker?: string
  scripCode?: string
}

export async function POST(request: Request) {
  try {
    const body: AnalysisRequest = await request.json()
    const { prompt, ticker, scripCode } = body

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ 
        error: "OpenAI API key not configured",
        analysis: "AI analysis is not available at this time."
      }, { status: 200 })
    }

    const systemPrompt = `You are SpeedyPip, an elite institutional deal analyst for Indian stock markets.

RULES:
1. Be direct and data-driven - cite specific numbers from the data provided
2. Use professional analyst language but keep it accessible
3. Maximum 200 words
4. Format with markdown: use **bold** for key metrics, bullet points for lists
5. Focus on actionable insights

STRUCTURE YOUR RESPONSE AS:
1. **Pattern**: What accumulation/distribution/rotation pattern is visible
2. **Whale Insight**: Key observation about the biggest players
3. **Anchor Zones**: Price levels where institutions have positioned (these become support/resistance)
4. **Risk Note**: One-liner risk assessment for retail investors
5. **Bottom Line**: Single sentence trading implication`

    // Stream the response
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
              model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 500
            }),
          })

          if (!response.ok) {
            const error = await response.text()
            console.error("OpenAI API error:", error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Unable to generate analysis. Please try again." })}\n\n`))
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
            return
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

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
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                    }
                  } catch {}
                }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (e) {
          console.error("Streaming error:", e)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Analysis failed. Please try again." })}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

  } catch (error: any) {
    console.error("Whale AI analysis error:", error)
    return NextResponse.json({ 
      error: error.message,
      analysis: "Unable to process analysis request."
    }, { status: 500 })
  }
}
