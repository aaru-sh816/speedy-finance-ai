export class TokenBucket {
  private capacity: number
  private tokens: number
  private refillRate: number // tokens per second
  private lastRefill: number

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity
    this.tokens = capacity
    this.refillRate = refillPerSecond
    this.lastRefill = Date.now()
  }

  private refill() {
    const now = Date.now()
    const delta = (now - this.lastRefill) / 1000
    if (delta > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillRate)
      this.lastRefill = now
    }
  }

  tryConsume(count = 1): boolean {
    this.refill()
    if (this.tokens >= count) {
      this.tokens -= count
      return true
    }
    return false
  }

  async consume(count = 1): Promise<void> {
    while (!this.tryConsume(count)) {
      await new Promise((r) => setTimeout(r, 10))
    }
  }
}

// Global registry for buckets to survive hot-reloads
const globalForRateLimit = globalThis as unknown as { __buckets?: Record<string, TokenBucket> }
if (!globalForRateLimit.__buckets) globalForRateLimit.__buckets = {}

export function getOrCreateBucket(name: string, capacity: number, refillPerSecond: number) {
  if (!globalForRateLimit.__buckets![name]) {
    globalForRateLimit.__buckets![name] = new TokenBucket(capacity, refillPerSecond)
  }
  return globalForRateLimit.__buckets![name]
}
