import { getQuote, type Quote } from "@/lib/quotes/provider"
import { metrics } from "@/lib/infra/metrics"

// Simple priority: lower number = higher priority
export type Priority = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100

class QuoteBatcher {
  private pending = new Map<string, { resolvers: Array<(q: Quote | null) => void>; priority: number }>()
  private flushTimer: any | null = null
  private readonly maxBatch = 60
  private readonly flushDelayMs = 150

  enqueue(symbol: string, priority: Priority = 50): Promise<Quote | null> {
    const sym = symbol.trim().toUpperCase()
    return new Promise((resolve) => {
      const existing = this.pending.get(sym)
      if (existing) {
        existing.resolvers.push(resolve)
        existing.priority = Math.min(existing.priority, priority)
      } else {
        this.pending.set(sym, { resolvers: [resolve], priority })
      }
      this.scheduleFlush()
    })
  }

  private scheduleFlush() {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => this.flush(), this.flushDelayMs)
  }

  private async flush() {
    this.flushTimer = null
    if (this.pending.size === 0) return

    // take up to maxBatch sorted by priority
    const entries = Array.from(this.pending.entries())
    entries.sort((a, b) => a[1].priority - b[1].priority)
    const slice = entries.slice(0, this.maxBatch)

    // remove from pending first
    for (const [sym] of slice) this.pending.delete(sym)

    metrics().recordBatch(slice.length)

    await Promise.all(
      slice.map(async ([sym, info]) => {
        let result: Quote | null = null
        try {
          result = await getQuote(sym)
        } catch (e) {
          metrics().recordError((e as Error).name || "BatchError")
          result = null
        }
        info.resolvers.forEach((r) => r(result))
      })
    )

    // if more pending, schedule another flush
    if (this.pending.size > 0) this.scheduleFlush()
  }
}

const globalForBatch = globalThis as unknown as { __quoteBatcher?: QuoteBatcher }
if (!globalForBatch.__quoteBatcher) globalForBatch.__quoteBatcher = new QuoteBatcher()

export function batcher() {
  return globalForBatch.__quoteBatcher!
}
