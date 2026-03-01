import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o"

const PORTFOLIO_SYSTEM_PROMPT = `You are Speedy Finance AI, an elite portfolio analyst for Indian stock investors.

## YOUR ROLE
Generate a 1-2 sentence portfolio insight based on the user's holdings and metrics.
Be specific, actionable, and India-focused. Use ₹ for currency, % for returns.

## RULES
- Start directly with the insight (no preamble)
- Mention outperformance/underperformance vs NIFTY 50 if relevant
- Highlight concentration risks if any stock >20% of portfolio
- Suggest one simple action if obvious (e.g. "Consider diversifying out of IT if >40%")
- Max 2 sentences, plain English
`

interface PortfolioSummaryRequest {
  totalInvested: number
  currentValue: number
  pnlPercent: number
  cagr?: number
  holdings: { symbol: string; name: string; allocationPercent: number; pnlPercent: number }[]
  risks: string[]
}

export async function POST(request: Request) {
  let body: PortfolioSummaryRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  try {
    const { totalInvested, currentValue, pnlPercent, cagr, holdings, risks } = body

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({
        summary: `You are ${pnlPercent >= 0 ? "up" : "down"} ${Math.abs(pnlPercent).toFixed(1)}% since inception${holdings.length ? `, with ${holdings.length} holdings.` : "."}`,
        source: "rule-based",
      })
    }

    const topHoldings = holdings.slice(0, 8).map((h) => `${h.symbol} (${h.allocationPercent.toFixed(1)}%, ${h.pnlPercent >= 0 ? "+" : ""}${h.pnlPercent.toFixed(1)}%)`).join(", ")
    const riskText = risks.length > 0 ? `Risks: ${risks.slice(0, 3).join("; ")}` : ""

    const userContent = `
Portfolio metrics:
- Invested: ₹${totalInvested.toLocaleString("en-IN")}, Current: ₹${currentValue.toLocaleString("en-IN")}
- P&L: ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%${cagr != null ? `, CAGR: ${cagr.toFixed(1)}%` : ""}
- Top holdings: ${topHoldings || "None"}
${riskText ? `\n${riskText}` : ""}

Generate one concise portfolio insight.
`.trim()

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: PORTFOLIO_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim() || `You are ${pnlPercent >= 0 ? "up" : "down"} ${Math.abs(pnlPercent).toFixed(1)}% since inception.`

    return NextResponse.json({ summary, source: "openai" })
  } catch (e: unknown) {
    const pnlPercent = body?.pnlPercent ?? 0
    const holdings = body?.holdings ?? []
    return NextResponse.json({
      summary: `You are ${pnlPercent >= 0 ? "up" : "down"} ${Math.abs(pnlPercent).toFixed(1)}% since inception${holdings.length ? `, with ${holdings.length} holdings.` : "."}`,
      source: "rule-based",
      error: (e as Error).message,
    })
  }
}
