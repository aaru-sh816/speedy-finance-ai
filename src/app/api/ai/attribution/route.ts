import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { symbol, changePercent, announcements } = await req.json();

    if (!announcements || announcements.length === 0) {
      return NextResponse.json({ reason: null });
    }

    const direction = changePercent >= 0 ? "spike" : "drop";
    const prompt = `A stock (${symbol}) moved ${Math.abs(changePercent).toFixed(2)}% (${direction}). 
Given these recent announcements, which one is the primary driver? 
Summarize the 'Why' in 10-12 words maximum, starting with the event.
Example: "Acquisition of Reliance Solar for ₹4000Cr" or "Delayed Q3 results due to auditor resignation".

Announcements:
${announcements.map((a: any, i: number) => `${i + 1}. [${a.category}] ${a.headline}`).join('\n')}

Response should be just the summary. If none seem to be the driver, respond with 'Market sentiment'.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a financial analyst at a top hedge fund. You are expert at correlating news with price moves." },
        { role: "user", content: prompt }
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const reason = response.choices[0].message.content?.trim();

    return NextResponse.json({ reason });
  } catch (error) {
    console.error("AI Attribution error:", error);
    return NextResponse.json({ error: "Failed to attribute price move" }, { status: 500 });
  }
}
