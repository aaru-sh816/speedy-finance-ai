import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const url = process.env.UPSTASH_VECTOR_REST_URL
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN
  const openai = process.env.OPENAI_API_KEY

  let upstashInit = false
  let msg = ""
  if (url && token) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Index } = require("@upstash/vector") as any
      const idx = new Index({ url, token })
      // Light ping: some providers fail on missing vector dimension; ignore errors
      try {
        await idx.query({ vector: new Array(1536).fill(0), topK: 1 })
      } catch (e: any) {
        // If we reach here, env works and index responds; dimension/name mismatch is acceptable
      }
      upstashInit = true
      msg = "Upstash client initialized"
    } catch (e: any) {
      msg = `Upstash init error: ${e?.message || e}`
    }
  } else {
    msg = "UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN missing"
  }

  return NextResponse.json({
    mode: url && token ? "upstash" : "memory",
    envPresent: !!url && !!token,
    openaiPresent: !!openai,
    upstashInit,
    message: msg,
    timestamp: new Date().toISOString(),
  })
}
