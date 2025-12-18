import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Web Search API using OpenAI's gpt-4o-search-preview
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query, company, ticker } = body
    
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Build a finance-focused search query
    const searchQuery = company 
      ? `${query} ${company} ${ticker || ""} India stock market BSE NSE`
      : query

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        web_search_options: {
          user_location: {
            type: "approximate",
            approximate: {
              country: "IN",
              city: "Mumbai",
              region: "Maharashtra",
            }
          }
        },
        messages: [
          {
            role: "system",
            content: `You are a financial research assistant for the Indian stock market. 
Provide accurate, up-to-date information from reliable financial sources.
Always cite your sources with URLs.
Focus on BSE/NSE listed companies, SEBI regulations, and Indian market news.
Be concise but thorough.`
          },
          {
            role: "user",
            content: searchQuery
          }
        ],
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Web search failed:", err)
      // Fallback to regular model if search model unavailable
      return NextResponse.json({ 
        error: "Web search unavailable", 
        fallback: true 
      }, { status: 200 })
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    
    // Extract citations from annotations
    const citations = message?.annotations?.filter((a: any) => a.type === "url_citation")
      .map((a: any) => ({
        url: a.url_citation.url,
        title: a.url_citation.title,
        startIndex: a.url_citation.start_index,
        endIndex: a.url_citation.end_index,
      })) || []

    return NextResponse.json({
      content: message?.content || "",
      citations,
      usage: data.usage,
    })

  } catch (error: any) {
    console.error("Search API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
