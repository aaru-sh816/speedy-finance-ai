export type TTLCacheStats = {
  size: number
  hits: number
  misses: number
  evictions: number
}

export class TTLCache<K, V> {
  private store = new Map<K, { value: V; expiresAt: number; createdAt: number }>()
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(private maxSize: number, private ttlMs: number) {}

  get(key: K): V | undefined {
    const now = Date.now()
    const entry = this.store.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }
    if (entry.expiresAt <= now) {
      this.store.delete(key)
      this.misses++
      return undefined
    }
    this.hits++
    return entry.value
  }

  set(key: K, value: V): void {
    const now = Date.now()
    const expiresAt = now + this.ttlMs
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      // Evict oldest
      let oldestKey: K | undefined
      let oldestCreated = Infinity
      for (const [k, v] of this.store.entries()) {
        if (v.createdAt < oldestCreated) {
          oldestCreated = v.createdAt
          oldestKey = k
        }
      }
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey)
        this.evictions++
      }
    }
    this.store.set(key, { value, expiresAt, createdAt: now })
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): boolean {
    return this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
  }

  stats(): TTLCacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    }
  }
}

// Create a process-wide singleton cache helper (for hot-reload safety)
const globalForCache = globalThis as unknown as { __ttlCaches?: Record<string, TTLCache<any, any>> }
if (!globalForCache.__ttlCaches) globalForCache.__ttlCaches = {}

export function getOrCreateCache<K, V>(name: string, maxSize: number, ttlMs: number): TTLCache<K, V> {
  if (!globalForCache.__ttlCaches![name]) {
    globalForCache.__ttlCaches![name] = new TTLCache<any, any>(maxSize, ttlMs)
  }
  return globalForCache.__ttlCaches![name] as TTLCache<K, V>
}
