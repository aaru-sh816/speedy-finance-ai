type Embedding = number[]

// Upstash Vector (if configured) + in-memory fallback
let upstashIndex: any | null = null
function getUpstashIndex() {
  if (upstashIndex !== null) return upstashIndex
  const url = process.env.UPSTASH_VECTOR_REST_URL
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN
  if (!url || !token) {
    upstashIndex = undefined
    return upstashIndex
  }
  try {
    // Lazy import to avoid bundler issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Index } = require("@upstash/vector") as any
    upstashIndex = new Index({ url, token })
  } catch {
    upstashIndex = undefined
  }
  return upstashIndex
}

// In-memory fallback store
const mem = new Map<string, { chunks: { id: string; page: number; text: string }[]; embeddings: Embedding[] }>()

function cosine(a: Embedding, b: Embedding): number {
  let dot = 0, na = 0, nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1))
}

export function chunkPages(pages: { page: number; text: string }[], maxChars = 1200) {
  const chunks: { id: string; page: number; text: string }[] = []
  for (const p of pages) {
    const text = (p.text || "").replace(/\s+/g, " ").trim()
    if (!text) continue
    
    // Page context prepended to each chunk
    const pageContext = `[Page ${p.page}] `
    const actualMaxChars = maxChars - pageContext.length

    if (text.length <= actualMaxChars) {
      chunks.push({ id: `${p.page}-0`, page: p.page, text: pageContext + text })
      continue
    }

    // Split by sentences if possible
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text]
    let currentChunk = ""
    let part = 0

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > actualMaxChars) {
        if (currentChunk) {
          chunks.push({ id: `${p.page}-${part++}`, page: p.page, text: pageContext + currentChunk.trim() })
        }
        currentChunk = sentence
      } else {
        currentChunk += sentence
      }
    }

    if (currentChunk) {
      chunks.push({ id: `${p.page}-${part++}`, page: p.page, text: pageContext + currentChunk.trim() })
    }
  }
  return chunks
}

export async function embedTexts(apiKey: string, texts: string[]): Promise<Embedding[]> {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for embeddings")
  const body = { input: texts, model: "text-embedding-3-small" }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Embeddings API error: ${res.status}`)
  const data = await res.json()
  return (data.data || []).map((d: any) => d.embedding as Embedding)
}

export async function ensureIndexed(docId: string, pages: { page: number; text: string }[], apiKey: string) {
  const index = getUpstashIndex()
  const chunks = chunkPages(pages)

  if (index) {
    // Check if already indexed by trying to fetch the first chunk
    try {
      const firstChunkId = `${docId}::${chunks[0]?.id}`
      const existing = await index.fetch([firstChunkId])
      if (existing && existing.length > 0 && existing[0]) {
        console.log(`[Vector] Document ${docId} already indexed. Skipping.`)
        return { chunks, embeddings: [] }
      }
    } catch (e) {
      console.error(`[Vector] Error checking existence for ${docId}:`, e)
    }

    // Upstash path
    const embeddings = await embedTexts(apiKey, chunks.map(c => c.text))
    const ups = [] as any[]
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const id = `${docId}::${c.id}`
      ups.push(index.upsert({ id, vector: embeddings[i], metadata: { docId, page: c.page, text: c.text } }))
    }
    await Promise.allSettled(ups)
    return { chunks, embeddings } // return local view
  }

  // Memory fallback
  if (mem.has(docId)) return mem.get(docId)!
  const embeddings = await embedTexts(apiKey, chunks.map(c => c.text))
  const entry = { chunks, embeddings }
  mem.set(docId, entry)
  return entry
}

export async function topK(
  docId: string, 
  queryEmbedding: Embedding, 
  k = 3, 
  boostPage?: number,
  options?: { threshold?: number; minResults?: number }
): Promise<{ page: number; text: string; score: number }[]> {
  const threshold = options?.threshold ?? 0.30
  const minResults = options?.minResults ?? 1
  
  const index = getUpstashIndex()
  if (index) {
    try {
      const res = await index.query({ vector: queryEmbedding, topK: k * 2, filter: { docId } })
      const matches = (res?.matches || res?.vectors || res || []) as any[]
      const scored = matches
        .map((m: any) => {
          let score = m?.score ?? 0
          const page = m?.metadata?.page ?? 1
          if (boostPage && page === boostPage) score += 0.15
          return { page, text: m?.metadata?.text ?? "", score }
        })
        .sort((a, b) => b.score - a.score)
      
      const aboveThreshold = scored.filter(m => m.score >= threshold)
      if (aboveThreshold.length >= minResults) {
        return aboveThreshold.slice(0, k)
      }
      return scored.slice(0, Math.max(minResults, Math.min(k, scored.length)))
    } catch {
      // fall through to memory
    }
  }
  
  const entry = mem.get(docId)
  if (!entry) return []
  
  const scored = entry.embeddings.map((e, i) => {
    let score = cosine(queryEmbedding, e)
    const page = entry.chunks[i].page
    if (boostPage && page === boostPage) score += 0.15
    return { score, chunk: entry.chunks[i] }
  }).sort((a, b) => b.score - a.score)
  
  const aboveThreshold = scored.filter(s => s.score >= threshold)
  const results = aboveThreshold.length >= minResults 
    ? aboveThreshold.slice(0, k)
    : scored.slice(0, Math.max(minResults, Math.min(k, scored.length)))
    
  return results.map(s => ({ page: s.chunk.page, text: s.chunk.text, score: s.score }))
}
