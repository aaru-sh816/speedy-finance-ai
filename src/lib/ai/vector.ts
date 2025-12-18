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
    if (text.length <= maxChars) {
      chunks.push({ id: `${p.page}-0`, page: p.page, text })
      continue
    }
    let i = 0, part = 0
    while (i < text.length) {
      const slice = text.slice(i, i + maxChars)
      chunks.push({ id: `${p.page}-${part++}`, page: p.page, text: slice })
      i += maxChars
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

export async function topK(docId: string, queryEmbedding: Embedding, k = 3): Promise<{ page: number; text: string; score: number }[]> {
  const index = getUpstashIndex()
  if (index) {
    try {
      const res = await index.query({ vector: queryEmbedding, topK: k, filter: { docId } })
      const matches = (res?.matches || res?.vectors || res || []) as any[]
      return matches.map((m: any) => ({ page: m?.metadata?.page ?? 1, text: m?.metadata?.text ?? "", score: m?.score ?? 0 }))
    } catch {
      // fall through to memory
    }
  }
  const entry = mem.get(docId)
  if (!entry) return []
  const scored = entry.embeddings.map((e, i) => ({ score: cosine(queryEmbedding, e), chunk: entry.chunks[i] }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k).map(s => ({ page: s.chunk.page, text: s.chunk.text, score: s.score }))
}
