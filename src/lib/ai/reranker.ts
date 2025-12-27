interface RerankResult {
  index: number
  relevance_score: number
  text: string
  page: number
}

export async function rerankWithCohere(
  query: string,
  documents: { text: string; page: number }[],
  topN: number = 5
): Promise<RerankResult[]> {
  const cohereKey = process.env.COHERE_API_KEY
  
  if (!cohereKey || documents.length === 0) {
    return documents.slice(0, topN).map((doc, i) => ({
      index: i,
      relevance_score: 1 - (i * 0.1),
      text: doc.text,
      page: doc.page
    }))
  }

  try {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cohereKey}`,
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query: query,
        documents: documents.map(d => d.text),
        top_n: Math.min(topN, documents.length),
        return_documents: false
      }),
    })

    if (!response.ok) {
      console.error("Cohere rerank failed:", response.status)
      return documents.slice(0, topN).map((doc, i) => ({
        index: i,
        relevance_score: 1 - (i * 0.1),
        text: doc.text,
        page: doc.page
      }))
    }

    const data = await response.json()
    const results = (data.results || []) as { index: number; relevance_score: number }[]

    return results.map(r => ({
      index: r.index,
      relevance_score: r.relevance_score,
      text: documents[r.index].text,
      page: documents[r.index].page
    }))
  } catch (e) {
    console.error("Cohere rerank error:", e)
    return documents.slice(0, topN).map((doc, i) => ({
      index: i,
      relevance_score: 1 - (i * 0.1),
      text: doc.text,
      page: doc.page
    }))
  }
}

export async function rerankWithOpenAI(
  query: string,
  documents: { text: string; page: number }[],
  openaiKey: string,
  topN: number = 5
): Promise<RerankResult[]> {
  if (documents.length <= topN) {
    return documents.map((doc, i) => ({
      index: i,
      relevance_score: 1 - (i * 0.1),
      text: doc.text,
      page: doc.page
    }))
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a relevance scorer. Given a query and documents, return JSON array of indices sorted by relevance.
Output format: {"rankings": [0, 3, 1, 2]} where numbers are document indices in order of relevance.
Only output valid JSON, nothing else.`
          },
          {
            role: "user",
            content: `Query: "${query}"

Documents:
${documents.map((d, i) => `[${i}] ${d.text.slice(0, 300)}`).join("\n\n")}

Return the indices of the top ${topN} most relevant documents for this query.`
          }
        ],
        temperature: 0,
        max_tokens: 100
      }),
    })

    if (!response.ok) {
      throw new Error("OpenAI rerank failed")
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""
    
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      const rankings = (parsed.rankings || []) as number[]
      
      return rankings.slice(0, topN).map((idx, i) => ({
        index: idx,
        relevance_score: 1 - (i * 0.1),
        text: documents[idx]?.text || "",
        page: documents[idx]?.page || 1
      })).filter(r => r.text)
    }
  } catch (e) {
    console.error("OpenAI rerank error:", e)
  }

  return documents.slice(0, topN).map((doc, i) => ({
    index: i,
    relevance_score: 1 - (i * 0.1),
    text: doc.text,
    page: doc.page
  }))
}

export async function hybridRerank(
  query: string,
  documents: { text: string; page: number; score?: number }[],
  openaiKey: string,
  topN: number = 5
): Promise<RerankResult[]> {
  const cohereKey = process.env.COHERE_API_KEY
  
  if (cohereKey) {
    return rerankWithCohere(query, documents, topN)
  }
  
  return rerankWithOpenAI(query, documents, openaiKey, topN)
}
