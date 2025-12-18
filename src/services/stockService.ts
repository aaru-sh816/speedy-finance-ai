/**
 * Stock Service - Comprehensive stock data service
 * Provides search, details, corporate actions, and news functionality
 */

const RAPIDAPI_KEY = process.env.NEXT_PUBLIC_RAPID_API_KEY || "ddf0cc9ceamsh82b350724463929p1aaddbjsne64445473a7c"
const RAPIDAPI_HOST = "indian-stock-market-data-nse-bse-bcd-mcx-cds-nfo.p.rapidapi.com"

export interface StockSuggestion {
  id: string
  commonName: string
  symbol: string
  mgIndustry: string
  mgSector: string
  exchangeCodeBse: string
  exchangeCodeNsi: string
  instrumentToken?: number
  exchangeToken?: number
  lastPrice?: number
  change?: number
  changePercent?: number
}

export interface StockDetails {
  tickerId: string
  companyName: string
  symbol: string
  industry: string
  sector: string
  currentPrice: {
    BSE?: number
    NSE?: number
  }
  change: number
  percentChange: number
  dayHigh: number
  dayLow: number
  yearHigh: number
  yearLow: number
  open: number
  previousClose: number
  volume: number
  marketCap?: number
  peRatio?: number
  pbRatio?: number
  dividendYield?: number
  bookValue?: number
  faceValue?: number
  eps?: number
  bseCode?: string
  nseCode?: string
  isin?: string
  companySlug?: string
}

export interface CorporateAction {
  id: string
  scripCode: string
  company: string
  purpose: string
  exDate: string
  recordDate?: string
  bcStartDate?: string
  bcEndDate?: string
  ndStartDate?: string
  ndEndDate?: string
  details?: string
  actionType: "dividend" | "bonus" | "split" | "rights" | "other"
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  imageUrl?: string
  pubDate: string
  source: string
  topics: string[]
  sentiment?: "positive" | "negative" | "neutral"
}

// Stock Code Mapper utilities
export const StockCodeMapper = {
  generateCompanySlug(companyName: string): string {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
  },

  getBSEUrl(symbol: string, scripCode?: string): string {
    const slug = this.generateCompanySlug(symbol)
    if (scripCode) {
      return `https://www.bseindia.com/stock-share-price/${slug}/${symbol.toLowerCase()}/${scripCode}/`
    }
    return `https://www.bseindia.com/stock-share-price/x/${symbol.toLowerCase()}/`
  },

  getNSEUrl(symbol: string): string {
    return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol.toUpperCase())}`
  },

  getScreenerUrl(symbol: string): string {
    return `https://www.screener.in/company/${symbol.toUpperCase()}/`
  },

  getTradingViewUrl(symbol: string, exchange: "BSE" | "NSE" = "BSE"): string {
    return `https://www.tradingview.com/chart/?symbol=${exchange}:${symbol.toUpperCase()}`
  },

  getMoneyControlUrl(symbol: string): string {
    return `https://www.moneycontrol.com/india/stockpricequote/${this.generateCompanySlug(symbol)}`
  },
}

class StockService {
  private static instance: StockService

  public static getInstance(): StockService {
    if (!StockService.instance) {
      StockService.instance = new StockService()
    }
    return StockService.instance
  }

  /**
   * Search stocks using RapidAPI instruments/search
   */
  public async searchStocks(query: string): Promise<StockSuggestion[]> {
    if (!query || query.length < 1) return []

    try {
      // Use the API route instead of direct RapidAPI call (for CORS)
      const response = await fetch(`/api/bse/search?q=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.results || !Array.isArray(data.results)) {
        return []
      }

      return data.results.map((item: any, index: number) => ({
        id: item.scripCode || item.exchangeToken?.toString() || `stock_${index}`,
        commonName: item.name || item.symbol,
        symbol: item.symbol,
        mgIndustry: item.industry || "",
        mgSector: item.sector || "",
        exchangeCodeBse: item.scripCode || "",
        exchangeCodeNsi: item.symbol || "",
        instrumentToken: item.instrumentToken,
        exchangeToken: item.exchangeToken,
        lastPrice: item.lastPrice || item.price,
        change: item.change,
        changePercent: item.changePercent,
      }))
    } catch (error) {
      console.error("Error searching stocks:", error)
      return []
    }
  }

  /**
   * Get detailed stock information
   */
  public async getStockDetails(symbol: string, scripCode?: string): Promise<StockDetails | null> {
    try {
      // First try to get from company API
      const companyUrl = scripCode 
        ? `/api/bse/company/${scripCode}` 
        : `/api/bse/search?q=${encodeURIComponent(symbol)}`
      
      const [companyResponse, quoteResponse] = await Promise.all([
        fetch(companyUrl),
        this.getQuote(symbol)
      ])

      let companyData: any = {}
      if (companyResponse.ok) {
        companyData = await companyResponse.json()
      }

      const quote = quoteResponse

      return {
        tickerId: symbol,
        companyName: companyData.companyName || companyData.name || symbol,
        symbol: companyData.symbol || symbol,
        industry: companyData.industry || "N/A",
        sector: companyData.sector || "N/A",
        currentPrice: {
          BSE: quote?.price,
          NSE: quote?.price,
        },
        change: quote?.change || 0,
        percentChange: quote?.changePercent || 0,
        dayHigh: quote?.dayHigh || 0,
        dayLow: quote?.dayLow || 0,
        yearHigh: companyData.yearHigh || quote?.fiftyTwoWeekHigh || 0,
        yearLow: companyData.yearLow || quote?.fiftyTwoWeekLow || 0,
        open: quote?.open || 0,
        previousClose: quote?.previousClose || 0,
        volume: quote?.volume || 0,
        marketCap: quote?.marketCap || companyData.marketCap,
        peRatio: companyData.peRatio,
        pbRatio: companyData.pbRatio,
        dividendYield: companyData.dividendYield,
        bookValue: companyData.bookValue,
        faceValue: companyData.faceValue,
        eps: companyData.eps,
        bseCode: scripCode || companyData.scripCode,
        nseCode: symbol,
        isin: companyData.isin,
        companySlug: StockCodeMapper.generateCompanySlug(companyData.companyName || symbol),
      }
    } catch (error) {
      console.error("Error fetching stock details:", error)
      return null
    }
  }

  /**
   * Get real-time quote from RapidAPI
   */
  public async getQuote(symbol: string, exchange: "BSE" | "NSE" = "BSE"): Promise<any> {
    try {
      const response = await fetch(
        `https://${RAPIDAPI_HOST}/v1/rapidapi/stock/quote?tradingSymbol=${encodeURIComponent(symbol.toUpperCase())}&exchange=${exchange}`,
        {
          method: "GET",
          headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
        }
      )

      if (!response.ok) {
        console.error(`Quote API error: ${response.status}`)
        return null
      }

      const data = await response.json()
      
      // Parse market cap from various field names
      let marketCap = null
      const marketCapFields = ["marketCap", "mktCap", "market_cap", "marketCapitalization", "mcap"]
      for (const field of marketCapFields) {
        if (data[field] != null) {
          marketCap = parseFloat(data[field])
          if (!isNaN(marketCap) && marketCap > 0) break
        }
      }

      return {
        price: data.lastPrice || data.ltp || data.price,
        change: data.change || 0,
        changePercent: data.pChange || data.percentChange || 0,
        open: data.open,
        dayHigh: data.dayHigh || data.high,
        dayLow: data.dayLow || data.low,
        previousClose: data.previousClose,
        volume: data.totalTradedVolume || data.volume,
        marketCap,
        fiftyTwoWeekHigh: data.fiftyTwoWeekHigh || data["52WeekHigh"],
        fiftyTwoWeekLow: data.fiftyTwoWeekLow || data["52WeekLow"],
      }
    } catch (error) {
      console.error("Error fetching quote:", error)
      return null
    }
  }

  /**
   * Get corporate actions for a stock
   */
  public async getCorporateActions(scripCode: string): Promise<CorporateAction[]> {
    try {
      const response = await fetch(`/api/bse/corporate-actions?scripCode=${encodeURIComponent(scripCode)}`)
      
      if (!response.ok) {
        throw new Error(`Corporate actions failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.actions || !Array.isArray(data.actions)) {
        return []
      }

      return data.actions.map((action: any) => {
        const purposeLower = (action.purpose || "").toLowerCase()
        let actionType: CorporateAction["actionType"] = "other"
        
        if (purposeLower.includes("dividend")) actionType = "dividend"
        else if (purposeLower.includes("bonus")) actionType = "bonus"
        else if (purposeLower.includes("split")) actionType = "split"
        else if (purposeLower.includes("right")) actionType = "rights"

        return {
          id: action.id || `ca_${action.scripCode}_${action.exDate}`,
          scripCode: action.scripCode,
          company: action.company,
          purpose: action.purpose,
          exDate: action.exDate,
          recordDate: action.recordDate,
          bcStartDate: action.bcStartDate,
          bcEndDate: action.bcEndDate,
          ndStartDate: action.ndStartDate,
          ndEndDate: action.ndEndDate,
          details: action.details,
          actionType,
        }
      })
    } catch (error) {
      console.error("Error fetching corporate actions:", error)
      return []
    }
  }

  /**
   * Get market news
   */
  public async getNews(): Promise<NewsItem[]> {
    try {
      // This would connect to a news API - placeholder for now
      return []
    } catch (error) {
      console.error("Error fetching news:", error)
      return []
    }
  }

  /**
   * Filter news by stock
   */
  public filterNewsByStock(news: NewsItem[], stockName: string): NewsItem[] {
    const keywords = stockName.toLowerCase().split(" ")
    return news.filter((item) => {
      const searchText = `${item.title} ${item.summary}`.toLowerCase()
      return keywords.some((keyword) => searchText.includes(keyword))
    })
  }

  /**
   * Get BSE URL for a stock
   */
  public getBSEUrl(symbol: string, scripCode?: string): string {
    return StockCodeMapper.getBSEUrl(symbol, scripCode)
  }

  /**
   * Get NSE URL for a stock
   */
  public getNSEUrl(symbol: string): string {
    return StockCodeMapper.getNSEUrl(symbol)
  }

  /**
   * Get Screener URL for a stock
   */
  public getScreenerUrl(symbol: string): string {
    return StockCodeMapper.getScreenerUrl(symbol)
  }

  /**
   * Get TradingView URL for a stock
   */
  public getTradingViewUrl(symbol: string, exchange: "BSE" | "NSE" = "BSE"): string {
    return StockCodeMapper.getTradingViewUrl(symbol, exchange)
  }

  /**
   * Get announcements for a stock
   */
  public async getAnnouncements(scripCode: string, fromDate?: string, toDate?: string): Promise<any[]> {
    try {
      let url = `/api/bse/announcements?scripCode=${encodeURIComponent(scripCode)}`
      if (fromDate) url += `&fromDate=${fromDate}`
      if (toDate) url += `&toDate=${toDate}`

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Announcements failed: ${response.status}`)
      }

      const data = await response.json()
      return data.announcements || data || []
    } catch (error) {
      console.error("Error fetching announcements:", error)
      return []
    }
  }
}

// Export singleton instance
export const stockService = StockService.getInstance()

// Export types and class for flexibility
export { StockService }
export default stockService
