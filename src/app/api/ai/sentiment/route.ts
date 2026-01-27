import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SentimentRequest {
  symbol: string
  companyName: string
  currentPrice: number
  changePercent: number
  announcements?: Array<{ headline: string; date: string }>
  recentNews?: string[]
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body with better error handling
    let body: SentimentRequest
    try {
      const text = await request.text()
      console.log('[Sentiment] Raw request body:', text)
      body = JSON.parse(text)
    } catch (parseError) {
      console.error('[Sentiment] Failed to parse request body:', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { 
      symbol = 'Unknown', 
      companyName = 'Unknown Company', 
      currentPrice = 0, 
      changePercent = 0, 
      announcements = [], 
      recentNews = [] 
    } = body

    console.log('[Sentiment] Processing request for:', symbol, companyName)

    const announcementsText = announcements.length > 0
      ? announcements.slice(0, 5).map(a => `- ${a.headline} (${a.date})`).join('\n')
      : 'No recent announcements'

    const newsText = recentNews.length > 0
      ? recentNews.slice(0, 5).map(n => `- ${n}`).join('\n')
      : 'No recent news'

    const prompt = `You are an expert Indian stock market analyst. Analyze the sentiment for this stock and provide a Bull vs Bear analysis.

STOCK: ${symbol} - ${companyName}
Current Price: ₹${(currentPrice || 0).toLocaleString('en-IN')}
Today's Change: ${(changePercent || 0) >= 0 ? '+' : ''}${(changePercent || 0).toFixed(2)}%

RECENT ANNOUNCEMENTS:
${announcementsText}

RECENT NEWS/CONTEXT:
${newsText}

Provide your analysis as a JSON object with these fields:
- overallSentiment: one of "bullish", "bearish", or "neutral"
- sentimentScore: number from -100 to 100
- bullCase: object with "summary" (string) and "keyPoints" (array of 3 strings)
- bearCase: object with "summary" (string) and "keyPoints" (array of 3 strings)
- shortTermOutlook: string with 1 sentence outlook
- riskLevel: one of "low", "medium", or "high"
- catalysts: array of 2 upcoming catalysts

Be specific to Indian markets and this company. Keep it concise and actionable.`

    console.log('[Sentiment] Calling OpenAI API...')
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert Indian stock market analyst. Always respond with valid JSON only, no markdown code blocks or other formatting.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    console.log('[Sentiment] OpenAI response:', content?.substring(0, 200))
    
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const analysis = JSON.parse(content)

    return NextResponse.json({
      success: true,
      symbol,
      analysis
    })
  } catch (error) {
    console.error('[Sentiment] Analysis error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Failed to analyze sentiment', details: errorMessage },
      { status: 500 }
    )
  }
}
