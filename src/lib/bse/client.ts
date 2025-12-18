const BSE_SERVICE_URL = process.env.BSE_SERVICE_URL || 'http://localhost:5000'

export interface BSEQuote {
  companyName: string
  scripCode: string
  currentValue: number
  change: number
  pChange: number
  previousClose: number
  previousOpen: number
  dayHigh: number
  dayLow: number
  weekHigh52: number
  weekLow52: number
  weightedAvgPrice: number
  totalTradedValue: string
  totalTradedQuantity: string
  marketCapFull: string
  marketCapFreeFloat: string
  securityID: string
  group: string
  faceValue: string
  industry: string
  priceBand?: string
  upperPriceBand?: string
  lowerPriceBand?: string
  updatedOn: string
  buy: Record<string, { quantity: string; price: string }>
  sell: Record<string, { quantity: string; price: string }>
}

export interface BSEGainerLoser {
  securityID: string
  scripCode: string
  LTP: string
  change: string
  pChange: string
}

export interface BSEIndex {
  name: string
  currentValue: string
  change: string
  pChange: string
  scripFlag: string
}

export interface BSEIndicesResponse {
  updatedOn: string
  indices: BSEIndex[]
}

export interface BSEBhavCopyItem {
  scripCode: string
  open: string
  high: string
  low: string
  close: string
  last: string
  prevClose: string
  totalTrades: string
  totalSharesTraded: string
  netTurnover: string
  scripType: 'equity' | 'bond' | 'debenture' | 'preference'
  securityID: string
}

export class BSEClient {
  private baseURL: string
  private cache: Map<string, { data: any; timestamp: number }>

  constructor() {
    this.baseURL = BSE_SERVICE_URL
    this.cache = new Map()
  }

  private getCacheKey(endpoint: string): string {
    return endpoint
  }

  private getFromCache(key: string, ttlMs: number = 60000): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data
    }
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`)
      const data = await response.json()
      return data.status === 'healthy'
    } catch (error) {
      console.error('BSE Service health check failed:', error)
      return false
    }
  }

  async getQuote(scripCode: string): Promise<BSEQuote> {
    const cacheKey = this.getCacheKey(`quote_${scripCode}`)
    const cached = this.getFromCache(cacheKey, 30000) // 30s cache

    if (cached) {
      return cached
    }

    const response = await fetch(`${this.baseURL}/api/quote/${scripCode}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch quote')
    }

    this.setCache(cacheKey, result.data)
    return result.data
  }

  async getTopGainers(): Promise<BSEGainerLoser[]> {
    const cacheKey = this.getCacheKey('gainers')
    const cached = this.getFromCache(cacheKey, 60000) // 1min cache

    if (cached) {
      return cached
    }

    const response = await fetch(`${this.baseURL}/api/gainers`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch gainers')
    }

    this.setCache(cacheKey, result.data)
    return result.data
  }

  async getTopLosers(): Promise<BSEGainerLoser[]> {
    const cacheKey = this.getCacheKey('losers')
    const cached = this.getFromCache(cacheKey, 60000) // 1min cache

    if (cached) {
      return cached
    }

    const response = await fetch(`${this.baseURL}/api/losers`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch losers')
    }

    this.setCache(cacheKey, result.data)
    return result.data
  }

  async getIndices(category: string = 'market_cap/broad'): Promise<BSEIndicesResponse> {
    const cacheKey = this.getCacheKey(`indices_${category}`)
    const cached = this.getFromCache(cacheKey, 120000) // 2min cache

    if (cached) {
      return cached
    }

    const response = await fetch(`${this.baseURL}/api/indices?category=${encodeURIComponent(category)}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch indices')
    }

    this.setCache(cacheKey, result.data)
    return result.data
  }

  async verifyScripCode(code: string): Promise<{ valid: boolean; companyName?: string }> {
    const response = await fetch(`${this.baseURL}/api/verify-scrip/${code}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to verify scrip code')
    }

    return {
      valid: result.valid,
      companyName: result.companyName
    }
  }

  async getBhavCopy(date: string): Promise<BSEBhavCopyItem[]> {
    const cacheKey = this.getCacheKey(`bhav_${date}`)
    const cached = this.getFromCache(cacheKey, 3600000) // 1hr cache (historical data)

    if (cached) {
      return cached
    }

    const response = await fetch(`${this.baseURL}/api/bhav-copy?date=${date}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch Bhav Copy')
    }

    this.setCache(cacheKey, result.data)
    return result.data
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const bseClient = new BSEClient()
