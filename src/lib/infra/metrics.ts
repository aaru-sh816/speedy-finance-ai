type ErrorMap = Record<string, number>

export type MetricsSnapshot = {
  cacheHits: number
  cacheMisses: number
  requestSuccesses: number
  requestFailures: number
  batchCount: number
  batchSizeSum: number
  responseTimeSum: number
  averageBatchSize: number
  averageResponseTime: number
  cacheHitRate: number
  successRate: number
  requestsPerSecond: number
  errorTypes: ErrorMap
  since: number
}

class Metrics {
  private cacheHits = 0
  private cacheMisses = 0
  private requestSuccesses = 0
  private requestFailures = 0
  private batchCount = 0
  private batchSizeSum = 0
  private responseTimeSum = 0
  private errorTypes: ErrorMap = {}
  private startedAt = Date.now()

  recordCacheHit() {
    this.cacheHits++
  }
  recordCacheMiss() {
    this.cacheMisses++
  }
  recordRequestSuccess(durationMs: number) {
    this.requestSuccesses++
    this.responseTimeSum += durationMs
  }
  recordRequestFailure() {
    this.requestFailures++
  }
  recordBatch(size: number) {
    this.batchCount++
    this.batchSizeSum += size
  }
  recordError(type: string) {
    this.errorTypes[type] = (this.errorTypes[type] || 0) + 1
  }

  snapshot(): MetricsSnapshot {
    const now = Date.now()
    const durationSec = Math.max(1, (now - this.startedAt) / 1000)
    const avgBatch = this.batchCount > 0 ? this.batchSizeSum / this.batchCount : 0
    const avgResp = this.requestSuccesses > 0 ? this.responseTimeSum / this.requestSuccesses : 0
    const cacheRate = (this.cacheHits + this.cacheMisses) > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
    const successRate = (this.requestSuccesses + this.requestFailures) > 0 ? this.requestSuccesses / (this.requestSuccesses + this.requestFailures) : 0
    const rps = (this.requestSuccesses + this.requestFailures) / durationSec

    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      requestSuccesses: this.requestSuccesses,
      requestFailures: this.requestFailures,
      batchCount: this.batchCount,
      batchSizeSum: this.batchSizeSum,
      responseTimeSum: this.responseTimeSum,
      averageBatchSize: avgBatch,
      averageResponseTime: avgResp,
      cacheHitRate: cacheRate,
      successRate,
      requestsPerSecond: rps,
      errorTypes: { ...this.errorTypes },
      since: this.startedAt,
    }
  }
}

const globalForMetrics = globalThis as unknown as { __metrics?: Metrics }
if (!globalForMetrics.__metrics) globalForMetrics.__metrics = new Metrics()

export function metrics() {
  return globalForMetrics.__metrics!
}
