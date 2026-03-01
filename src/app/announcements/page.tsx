"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  Search, Filter, Download, Volume2, VolumeX, RefreshCw, TrendingUp, TrendingDown, 
    FileText, Sparkles, X, ExternalLink, ChevronRight, Globe, AlertTriangle, Zap, ZapOff,
    Calendar, BarChart2, Share2, Bookmark, ChevronDown, MessageSquare, Clock, ArrowLeft, ChevronLeft,
    EyeOff, Eye, PenSquare
  } from "lucide-react"
import type { BSEAnnouncement, BSEImpact } from "@/lib/bse/types"
import { ResearchNoteOverlay, type ResearchNoteContext } from "@/components/research-note-overlay"
import { AISummaryPanel, VerdictBadge } from "@/components/ai-summary-panel"
import { TradingViewChart } from "@/components/trading-view-chart"
import { LightweightChart } from "@/components/lightweight-chart"
import { useWhaleDeals } from "@/hooks/useWhaleDeals"
import { type VerdictType, type AISummary, analyzeAnnouncement, getVerdictColor, getVerdictIcon, shouldExcludeAnnouncement } from "@/lib/ai/verdict"
import { getMarketStatus, isWithinMarketHoursIST } from "@/lib/bse/market-hours"
import { FilterModal, FilterState, getDefaultFilters, McapRange, SortBy } from "@/components/filter-modal"
import { StockTicker, type TickerStock } from "@/components/stock-ticker"
import { SearchModal } from "@/components/search-modal"
import { SpeedyPipChat } from "@/components/speedy-pip-chat"
import { DigitalClock } from "@/components/digital-clock"
import { ShareMenu } from "@/components/share-menu"
import { SentimentBadge, RiskAlert, analyzeSentiment } from "@/components/sentiment-badge"
import { clsx } from "clsx"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { OnboardingHint } from "@/components/onboarding-hint"

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const intervals: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [604800, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ]
  for (const [sec, label] of intervals) {
    const v = Math.floor(seconds / sec)
    if (v >= 1) return `${v}${label} ago`
  }
  return "just now"
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

/**
 * World-class text highlighter component
 * Highlights search terms with a premium cyan-400 color matching the search interface
 */
function HighlightText({ text, query, className = "text-cyan-400" }: { text: string; query: string; className?: string }) {
  if (!query || !query.trim()) return <>{text}</>
  
  try {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'))
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className={clsx(className, "font-bold")}>{part}</span>
          ) : (
            part
          )
        )}
      </>
    )
  } catch (e) {
    return <>{text}</>
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  "General": "category-general",
  "Acquisition": "category-acquisition",
  "Board Meeting": "category-board",
  "Outcome": "category-outcome",
  "Financial Results": "category-result",
  "Result": "category-result",
  "AGM/EGM": "bg-cyan-500/15 text-cyan-400",
  "Dividend": "bg-pink-500/15 text-pink-400",
  "Analyst/Investor Meet": "bg-indigo-500/15 text-indigo-400",
  "Intimation": "bg-amber-500/15 text-amber-400",
  "Order": "bg-emerald-500/15 text-emerald-400",
  "Allotment": "bg-violet-500/15 text-violet-400",
  "Company Update": "bg-blue-500/15 text-blue-400",
}

type Quote = {
  symbol: string
  price: number | null
  previousClose?: number | null
  change?: number | null
  changePercent?: number | null
  volume?: number | null
  dayHigh?: number | null
  dayLow?: number | null
  marketCap?: number | null
}

type CompanyInfo = {
  tradingViewSymbol: string | null
  companyName: string
  symbol: string
}

// LocalStorage key for cached quotes
const QUOTES_CACHE_KEY = 'speedy_quotes_cache'
const QUOTES_CACHE_TIMESTAMP_KEY = 'speedy_quotes_cache_timestamp'

// Helper to get today's date string (for cache invalidation)
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export default function AnnouncementsPage() {
  const router = useRouter()
  // Data state
  const [announcements, setAnnouncements] = useState<BSEAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [companyAnnouncements, setCompanyAnnouncements] = useState<BSEAnnouncement[]>([])
  const [localSearchQuery, setLocalSearchQuery] = useState("")
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false)
  
  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [selectedForChat, setSelectedForChat] = useState<string[]>([]) // IDs of announcements selected for multi-doc chat
  const [openChatMaximized, setOpenChatMaximized] = useState(false) // Open chat directly in full-screen mode
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters())
  const [showFilterModal, setShowFilterModal] = useState(false)
    const [showSearchModal, setShowSearchModal] = useState(false)
    const [query, setQuery] = useState("")
    const [excludeNoise, setExcludeNoise] = useState(false)
    const [excludeNoiseInitialized, setExcludeNoiseInitialized] = useState(false)

    useEffect(() => {
      const saved = localStorage.getItem('speedy_hide_irrelevant')
      if (saved === 'true') {
        setExcludeNoise(true)
      }
      setExcludeNoiseInitialized(true)
    }, [])

    useEffect(() => {
      if (excludeNoiseInitialized) {
        localStorage.setItem('speedy_hide_irrelevant', String(excludeNoise))
      }
    }, [excludeNoise, excludeNoiseInitialized])
    
    // Verdicts & local summary cache for filtered items
  const verdictsCache = useRef<Map<string, VerdictType>>(new Map())
  const summaryCache = useRef<Map<string, AISummary>>(new Map())
  const announcementsRef = useRef<BSEAnnouncement[]>([])
  
  // Quote state
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [priceAtAnnouncement, setPriceAtAnnouncement] = useState<number | null>(null)

  // Batch quote cache for all announcements (scripCode -> quote data) — must be before researchContext
  const [quotesCache, setQuotesCache] = useState<Map<string, { price: number; changePercent: number; marketCap: number | null }>>(new Map())
  const [quotesLoading, setQuotesLoading] = useState(false)
  const batchFetchedRef = useRef<Set<string>>(new Set())
  const initialBatchFetchDone = useRef(false)
  
    // Cache for prices captured at announcement time (persisted in localStorage)
    const announcementPricesRef = useRef<Map<string, number>>(new Map())
    
    // Company info for TradingView
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
    
    // Get selected announcement - check both main and company announcements
    const selected = useMemo(() => {
      // First check main announcements
      const fromMain = announcements.find((a) => a.id === selectedId)
      if (fromMain) return fromMain
      // Then check company announcements (for Recent Announcements selection)
      const fromCompany = companyAnnouncements.find((a) => a.id === selectedId)
      return fromCompany || null
    }, [announcements, companyAnnouncements, selectedId])

    // Fetch company specific announcements when selected company changes
    useEffect(() => {
      if (!selected?.scripCode) return
      
      const fetchCompanyAnnouncements = async () => {
        try {
          const res = await fetch(`/api/bse/announcements?scripCode=${selected.scripCode}&maxPages=20&days=365`, { cache: "no-store" })
          if (!res.ok) throw new Error("Failed to fetch company announcements")
          const data = await res.json()
          setCompanyAnnouncements(data.announcements || [])
        } catch (e) {
          console.error("Failed to load company announcements", e)
          setCompanyAnnouncements([])
        }
      }
      
      fetchCompanyAnnouncements()
    }, [selected?.scripCode])

    // Local filtering for company announcements
    const filteredCompanyAnnouncements = useMemo(() => {
      if (!localSearchQuery) return companyAnnouncements
      const q = localSearchQuery.toLowerCase()
      return companyAnnouncements.filter(a => 
        a.headline.toLowerCase().includes(q) || 
        a.category.toLowerCase().includes(q) ||
        (a.subCategory && a.subCategory.toLowerCase().includes(q))
      )
    }, [companyAnnouncements, localSearchQuery])

    // Whale Deals for the selected company
    const { deals: whaleDeals } = useWhaleDeals(selected?.scripCode)

    // Research note overlay
    const [researchOverlayOpen, setResearchOverlayOpen] = useState(false)
    const researchContext: ResearchNoteContext | undefined = selected ? {
      scripCode: String(selected.scripCode),
      symbol: selected.ticker,
      companyName: selected.company,
      currentPrice: quote?.price ?? quotesCache.get(String(selected.scripCode))?.price ?? undefined,
      changePercent: quote?.changePercent ?? quotesCache.get(String(selected.scripCode))?.changePercent ?? undefined,
      announcement: {
        id: selected.id,
        headline: selected.headline,
        date: selected.time,
        category: selected.category,
        pdfUrl: selected.pdfUrl ?? undefined,
      },
    } : undefined
    
    // TTS state
  const [enableTTS, setEnableTTS] = useState(false)
  const spokenRef = useRef<Set<string>>(new Set())
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Ticker stocks
  const [tickerStocks, setTickerStocks] = useState<TickerStock[]>([])

  // Bookmarks & History state
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<string[]>([])

  // Bulk Quote Fetcher - fetches quotes in batches of 100 (API limit)
  const fetchBulkQuotesFromAPI = useCallback(async (scripCodes: string[], retryCount = 0): Promise<void> => {
    if (scripCodes.length === 0) return
    
    setQuotesLoading(true)
    const startTime = Date.now()
    const BATCH_SIZE = 100
    
    try {
      const batches: string[][] = []
      for (let i = 0; i < scripCodes.length; i += BATCH_SIZE) {
        batches.push(scripCodes.slice(i, i + BATCH_SIZE))
      }
      
      const fetchBatch = async (batch: string[], batchRetry = 0): Promise<any[]> => {
        try {
          const res = await fetch(`/api/bse/quotes/bulk?symbols=${batch.join(',')}`, { 
            cache: "no-store",
            signal: AbortSignal.timeout(30000)
          })
          
          if (!res.ok) {
            if (res.status === 429 && batchRetry < 2) {
              await new Promise(r => setTimeout(r, 1000 * (batchRetry + 1)))
              return fetchBatch(batch, batchRetry + 1)
            }
            throw new Error(`Bulk API returned ${res.status}`)
          }
          
          const data = await res.json()
          return data.quotes || []
        } catch (err) {
          if (batchRetry < 2) {
            await new Promise(r => setTimeout(r, 500))
            return fetchBatch(batch, batchRetry + 1)
          }
          batch.forEach(code => batchFetchedRef.current.add(code))
          return []
        }
      }
      
      const results = await Promise.all(batches.map(batch => fetchBatch(batch)))
      const allQuotes = results.flat()
      
      if (allQuotes.length > 0) {
        setQuotesCache(prev => {
          const newMap = new Map(prev)
          for (const q of allQuotes) {
            if (q && q.symbol && q.price != null) {
              newMap.set(q.symbol, {
                price: q.price,
                changePercent: q.changePercent ?? 0,
                marketCap: q.marketCap ?? null
              })
            }
            if (q?.symbol) batchFetchedRef.current.add(q.symbol)
          }
          return newMap
        })
        
        const duration = Date.now() - startTime
        console.log(`[Bulk Quotes] Fetched ${allQuotes.length} quotes in ${duration}ms across ${batches.length} batches`)
      }
    } catch (err) {
      console.error('[Bulk Quotes] Failed to fetch:', err)
      scripCodes.forEach(code => batchFetchedRef.current.add(code))
    } finally {
      setQuotesLoading(false)
    }
  }, [])

  // Batch fetch quotes for all unique scripCodes in announcements.
  // Option A: On first load always run; when market is closed, still fetch when there are new (unfetched) scrip codes so filters work.
  const fetchBatchQuotes = useCallback(async (scripCodes: string[], forceRefresh: boolean = false) => {
    const unfetched = forceRefresh
      ? scripCodes
      : scripCodes.filter((code) => !batchFetchedRef.current.has(code))
    if (unfetched.length === 0) return

    const marketStatus = getMarketStatus()
    // When market is closed and not force refresh, skip only if we already have quotes for all (avoid redundant refetch).
    if (!marketStatus.isOpen && !forceRefresh && initialBatchFetchDone.current) {
      const allFetched = scripCodes.every((code) => batchFetchedRef.current.has(code))
      if (allFetched) {
        console.log('[Quotes] Market closed, using cached quotes. Skip batch fetch.')
        return
      }
    }

    await fetchBulkQuotesFromAPI(unfetched)
    initialBatchFetchDone.current = true
  }, [fetchBulkQuotesFromAPI])

  // Market status helper
  const getMarketStatusLabel = useCallback(() => {
    const status = getMarketStatus();
    
    if (status.isWeekend) return { status: 'Closed', label: 'Weekend', color: 'text-rose-400', bg: 'bg-rose-500/20' }
    if (status.isPreMarket) return { status: 'Closed', label: 'Pre-Market', color: 'text-amber-400', bg: 'bg-amber-500/20' }
    if (status.isPostMarket) return { status: 'Closed', label: 'Post-Market', color: 'text-zinc-400', bg: 'bg-zinc-500/20' }
    return { status: 'Open', label: 'Market Open', color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
  }, [])

  const market = useMemo(() => getMarketStatusLabel(), [getMarketStatusLabel])

  // Mobile view state
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'all' | 'bookmarks' | 'history'>('all')

  // Keyboard navigation index
  const [kbdIndex, setKbdIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Load bookmarks & history from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem('speedy_bookmarks')
      if (savedBookmarks) setBookmarks(new Set(JSON.parse(savedBookmarks)))
      
      const savedHistory = localStorage.getItem('speedy_history')
      if (savedHistory) setHistory(JSON.parse(savedHistory))
    } catch (e) {
      console.error('Failed to load bookmarks/history', e)
    }
  }, [])

  // Update history when selection changes
  useEffect(() => {
    if (selectedId) {
      setHistory(prev => {
        const next = [selectedId, ...prev.filter(id => id !== selectedId)].slice(0, 20)
        localStorage.setItem('speedy_history', JSON.stringify(next))
        return next
      })
    }
  }, [selectedId])

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('speedy_bookmarks', JSON.stringify(Array.from(next)))
      setToast({ 
        message: next.has(id) ? 'Added to bookmarks' : 'Removed from bookmarks', 
        type: 'info' 
      })
      return next
    })
  }, [])

  // Load cached quotes from localStorage on mount
  useEffect(() => {
    try {
      const cachedTimestamp = localStorage.getItem(QUOTES_CACHE_TIMESTAMP_KEY)
      const today = getTodayDateString()
      
      // Only use cache if it's from today (prices change daily)
      if (cachedTimestamp === today) {
        const cached = localStorage.getItem(QUOTES_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, { price: number; changePercent: number; marketCap: number | null }>
          const newMap = new Map<string, { price: number; changePercent: number; marketCap: number | null }>()
          Object.entries(parsed).forEach(([key, value]) => {
            newMap.set(key, value)
            batchFetchedRef.current.add(key) // Mark as already fetched
          })
          setQuotesCache(newMap)
          console.log(`[Quotes] Loaded ${newMap.size} cached quotes from localStorage`)
        }
      } else {
        // Clear stale cache from previous day
        localStorage.removeItem(QUOTES_CACHE_KEY)
        localStorage.removeItem(QUOTES_CACHE_TIMESTAMP_KEY)
        console.log('[Quotes] Cleared stale cache from previous day')
      }
    } catch (e) {
      console.error('[Quotes] Failed to load cache:', e)
    }
  }, [])

  // Save quotes cache to localStorage when it changes
  useEffect(() => {
    if (quotesCache.size === 0) return
    try {
      const obj: Record<string, { price: number; changePercent: number; marketCap: number | null }> = {}
      quotesCache.forEach((v, k) => { obj[k] = v })
      localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(obj))
      localStorage.setItem(QUOTES_CACHE_TIMESTAMP_KEY, getTodayDateString())
    } catch {}
  }, [quotesCache])

  // Local summary helper
  const getLocalSummary = useCallback((a: BSEAnnouncement): AISummary => {
    const cached = summaryCache.current.get(a.id)
    if (cached) return cached
    
    return {
      verdict: { type: 'neutral', confidence: 50, reasoning: 'No analysis available.' },
      simpleSummary: a.headline,
      keyInsights: [a.headline],
      analystCommentary: ''
    }
  }, [])

  // Fetch announcements (optional signal for abort on navigation).
  // Fetches BSE + FinEdge corp-announcements, merges, deduplicates by symbol+date, shows source badge.
  const fetchAnnouncements = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
      const toDateIsToday = filters.toDate === todayStr
      const fromDateBeforeToday = filters.fromDate < todayStr
      const existing = announcementsRef.current
      const existingToday = toDateIsToday && fromDateBeforeToday
        ? existing.filter((a) => (a.time ? new Date(a.time).toISOString().slice(0, 10) : "") === todayStr)
        : []
      const useOptimization = toDateIsToday && fromDateBeforeToday && existingToday.length > 0

      const queryParams = new URLSearchParams()
      queryParams.set("maxPages", "30")
      if (filters.fromDate) queryParams.set("fromDate", filters.fromDate)
      if (useOptimization) {
        queryParams.set("toDate", yesterdayStr)
      } else if (filters.toDate) {
        queryParams.set("toDate", filters.toDate)
      }
      const toDateParam = useOptimization ? yesterdayStr : (filters.toDate || todayStr)

      // Fetch BSE and FinEdge corp-announcements in parallel
      const [bseRes, finedgeRes] = await Promise.all([
        fetchWithTimeout(`/api/bse/announcements?${queryParams.toString()}`, {
          cache: "no-store",
          timeoutMs: 20000,
          signal,
        }),
        fetchWithTimeout(`/api/finedge/corp-announcements?from_date=${filters.fromDate || ""}&to_date=${toDateParam}`, {
          cache: "no-store",
          timeoutMs: 15000,
          signal,
        }).catch(() => null),
      ])

      if (!bseRes.ok) throw new Error("Failed to fetch BSE announcements")
      const data = await bseRes.json()
      let fromApi: BSEAnnouncement[] = data.announcements || []

      // Convert FinEdge corp-announcements to BSEAnnouncement shape and merge
      if (finedgeRes?.ok) {
        const feData = await finedgeRes.json()
        const feList = Array.isArray(feData) ? feData : []
        const finedgeItems: BSEAnnouncement[] = feList.map((x: { ex_date?: string; stock_symbol?: string; description?: string; category?: string; sub_category?: string; bse_code?: string; timestamp_unix?: number; pdf_file_link?: string }) => {
          const scripCode = x.bse_code || x.stock_symbol || ""
          const dateStr = x.ex_date || (x.timestamp_unix ? new Date(x.timestamp_unix * 1000).toISOString().slice(0, 10) : "")
          const time = x.ex_date ? new Date(x.ex_date + "T12:00:00Z").toISOString() : (x.timestamp_unix ? new Date(x.timestamp_unix * 1000).toISOString() : new Date().toISOString())
          const headline = x.description || x.category || "Corporate announcement"
          const cat = x.category || "General"
          const impact = /dividend|bonus|split|rights|buyback/i.test(cat) ? "high" as const : /board|agm|egm/i.test(cat) ? "medium" as const : "low" as const
          return {
            id: `fe_${x.stock_symbol || "x"}_${dateStr}_${x.timestamp_unix || Date.now()}`,
            ticker: (x.stock_symbol || "").toUpperCase(),
            scripCode,
            company: x.stock_symbol || "",
            headline,
            summary: x.description || headline,
            category: cat,
            subCategory: x.sub_category || "",
            impact,
            time,
            pdfUrl: x.pdf_file_link || null,
            source: "FinEdge",
            tags: [cat.toLowerCase().replace(/\s+/g, "-")],
            isCritical: false,
          }
        })
        const seen = new Set<string>()
        fromApi.forEach((a) => seen.add(`${a.scripCode}_${(a.time || "").slice(0, 10)}`))
        finedgeItems.forEach((a) => {
          const key = `${a.scripCode}_${(a.time || "").slice(0, 10)}`
          if (!seen.has(key)) {
            seen.add(key)
            fromApi.push(a)
          }
        })
      }

      if (useOptimization) {
        const merged = [...fromApi, ...existingToday].sort((a, b) => {
          const ta = a.time ? new Date(a.time).getTime() : 0
          const tb = b.time ? new Date(b.time).getTime() : 0
          return tb - ta
        })
        setAnnouncements(merged)
        if (!selectedId && merged.length > 0) setSelectedId(merged[0].id)
      } else {
        fromApi.sort((a, b) => {
          const ta = a.time ? new Date(a.time).getTime() : 0
          const tb = b.time ? new Date(b.time).getTime() : 0
          return tb - ta
        })
        setAnnouncements(fromApi)
        if (!selectedId && fromApi.length > 0) setSelectedId(fromApi[0].id)
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") return
      setError((e as Error)?.message || "Failed to load announcements")
    } finally {
      setLoading(false)
    }
  }, [selectedId, filters.fromDate, filters.toDate])

  // Load cached announcement prices from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('speedy_announcement_prices')
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>
        Object.entries(parsed).forEach(([id, price]) => {
          announcementPricesRef.current.set(id, price)
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    announcementsRef.current = announcements
  }, [announcements])

  // Initial fetch and refetch when dates change; abort on unmount or when deps change
  useEffect(() => {
    const ctrl = new AbortController()
    fetchAnnouncements(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchAnnouncements])

// Auto-refresh - Real-time updates every 30 seconds
    useEffect(() => {
      if (autoRefresh) {
        refreshIntervalRef.current = setInterval(fetchAnnouncements, 30000) // 30 seconds for real-time
      }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [autoRefresh, fetchAnnouncements])

  // Trigger batch quote fetch when announcements change (so every result can have mcap/price/change for filters).
  useEffect(() => {
    if (announcements.length === 0) return
    const uniqueScripCodes = [...new Set(announcements.map((a) => a.scripCode))]
    fetchBatchQuotes(uniqueScripCodes)
  }, [announcements, fetchBatchQuotes])


  // Capture price for NEW announcements arriving during market hours
  useEffect(() => {
    const marketStatus = getMarketStatus()
    if (!marketStatus.isOpen) return
    
    const newAnnouncements = announcements.filter(a => {
      const annDate = new Date(a.time)
      const now = new Date()
      const diffMs = now.getTime() - annDate.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      return diffMins < 5 && !announcementPricesRef.current.has(a.id)
    })
    
    if (newAnnouncements.length === 0) return
    
    newAnnouncements.forEach(async (a) => {
      try {
        const res = await fetch(`/api/bse/quote?symbol=${encodeURIComponent(a.scripCode)}`, { cache: "no-store" })
        const d = await res.json()
        if (d && d.price) {
          announcementPricesRef.current.set(a.id, d.price)
          try {
            const existing = JSON.parse(localStorage.getItem('speedy_announcement_prices') || '{}')
            existing[a.id] = d.price
            localStorage.setItem('speedy_announcement_prices', JSON.stringify(existing))
          } catch {}
        }
      } catch {}
    })
  }, [announcements])

  // Fetch current quote data

  const fetchCurrentQuote = useCallback(async (scripCode: string, announcementId: string, announcementTime: string) => {
    setQuoteLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/bse/quote?symbol=${encodeURIComponent(scripCode)}`, {
        cache: "no-store",
        timeoutMs: 10000,
      })
      const d = await res.json()
      
      if (!d || d.error) {
        setQuote(null)
        return
      }
      
      setQuote({
        symbol: d.symbol,
        price: d.price,
        previousClose: d.previousClose,
        change: d.change,
        changePercent: d.changePercent,
        volume: d.volume,
        dayHigh: d.dayHigh,
        dayLow: d.dayLow,
        marketCap: d.marketCap,
      })
      
      // Priority 1: Use cached price captured at announcement time (if user was online)
      const cachedPrice = announcementPricesRef.current.get(announcementId)
      if (cachedPrice) {
        setPriceAtAnnouncement(cachedPrice)
        return
      }
      
      // Priority 2: For very recent announcements during market hours, capture now
      const annDate = new Date(announcementTime)
      const now = new Date()
      const diffMs = now.getTime() - annDate.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const marketStatus = getMarketStatus()
      
      if (diffMins < 5 && marketStatus.isOpen && d.price) {
        setPriceAtAnnouncement(d.price)
        announcementPricesRef.current.set(announcementId, d.price)
        try {
          const existing = JSON.parse(localStorage.getItem('speedy_announcement_prices') || '{}')
          existing[announcementId] = d.price
          localStorage.setItem('speedy_announcement_prices', JSON.stringify(existing))
        } catch {}
        return
      }
      
      // Priority 3: Fallback to previous close for same-day announcements
      const isSameDay = annDate.toDateString() === now.toDateString()
      const isPostMarket = annDate.getHours() >= 15 || annDate.getHours() < 9
      
      if (isSameDay || isPostMarket) {
        if (d.previousClose) {
          setPriceAtAnnouncement(d.previousClose)
        } else if (d.price && d.change != null) {
          setPriceAtAnnouncement(d.price - d.change)
        } else if (d.price && d.changePercent != null) {
          setPriceAtAnnouncement(d.price / (1 + (d.changePercent / 100)))
        }
      } else if (d.previousClose) {
        setPriceAtAnnouncement(d.previousClose)
      }
    } catch (e) {
      console.error("Failed to fetch quote", e)
      setQuote(null)
    } finally {
      setQuoteLoading(false)
    }
  }, [])

  // Fetch quote when selection changes OR every 10 seconds for real-time tracking (ONLY during market hours)
  useEffect(() => {
    if (!selected) return
    
    // Initial fetch when selection changes (always do this once)
    setPriceAtAnnouncement(null)
    fetchCurrentQuote(selected.scripCode, selected.id, selected.time)

    // Setup 10-second interval for real-time price & alpha updates ONLY during market hours
    const intervalId = setInterval(() => {
      const marketStatus = getMarketStatus()
      if (marketStatus.isOpen) {
        fetchCurrentQuote(selected.scripCode, selected.id, selected.time)
      }
      // No fetch during pre-market, post-market, or weekend - prices don't change
    }, 10000)

    return () => clearInterval(intervalId)
  }, [selected?.id, selected?.scripCode, selected?.time, fetchCurrentQuote])

  const getVerdict = useCallback((a: BSEAnnouncement): VerdictType => {
    const cachedVerdict = verdictsCache.current.get(a.id)
    if (cachedVerdict) return cachedVerdict
    const summary = getLocalSummary(a)
    return summary.verdict.type
  }, [getLocalSummary])

  // Mcap range definitions (in crores)
  const MCAP_RANGES: Record<McapRange, { min: number; max: number | null }> = {
    micro: { min: 0, max: 500 },
    small: { min: 500, max: 5000 },
    mid: { min: 5000, max: 20000 },
    large: { min: 20000, max: 100000 },
    mega: { min: 100000, max: null }
  }

  // Filter and sort announcements
  const filtered = useMemo(() => {
    let source = announcements
    
    // View mode selection
    if (viewMode === 'bookmarks') {
      source = announcements.filter(a => bookmarks.has(a.id))
    } else if (viewMode === 'history') {
      // In history mode, we show items in the order they were viewed
      source = history
        .map(id => announcements.find(a => a.id === id))
        .filter((a): a is BSEAnnouncement => !!a)
    }

    let result = source.filter((a) => {
      // If we are in history mode, we skip basic filters but keep search? 
      // Actually, let's keep all filters for bookmarks, but for history maybe just show the last 20.
      
      if (viewMode === 'history') return true // Show all history items
      
      // Date range filter
      const announcementDate = new Date(a.time)
      const fromDate = new Date(filters.fromDate)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(filters.toDate)
      toDate.setHours(23, 59, 59, 999)
      
      if (announcementDate < fromDate || announcementDate > toDate) return false
      
      // Noise exclusion filter
      if (excludeNoise && shouldExcludeAnnouncement(`${a.headline} ${a.summary}`)) return false
      
      // Verdict filter
      if (filters.verdicts.length > 0) {
        const verdict = getVerdict(a)
        if (!filters.verdicts.includes(verdict)) return false
      }

      // Impact filter
      if (filters.impacts && filters.impacts.length > 0) {
        if (!filters.impacts.includes(a.impact)) return false
      }

      // During market hours filter: BSE cash 09:15–15:30 IST
      if (filters.duringMarketHours && !isWithinMarketHoursIST(announcementDate)) return false
      
      // Text search filter
      if (query) {
        const q = query.toLowerCase()
        const hay = `${a.ticker} ${a.company} ${a.headline} ${a.summary} ${a.tags.join(" ")}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      // Mcap range filter
      if (filters.mcapRanges.length > 0 || filters.mcapMin !== null || filters.mcapMax !== null) {
                      const quoteData = quotesCache.get(String(a.scripCode))
        const mcap = quoteData?.marketCap
        
        if (mcap == null) return true // Keep items without mcap data (will be filtered when data loads)
        
        // Custom min/max takes precedence
        if (filters.mcapMin !== null || filters.mcapMax !== null) {
          const min = filters.mcapMin ?? 0
          const max = filters.mcapMax ?? Infinity
          if (mcap < min || mcap > max) return false
        } else if (filters.mcapRanges.length > 0) {
          // Check if mcap falls within any selected range
          const inRange = filters.mcapRanges.some(range => {
            const { min, max } = MCAP_RANGES[range]
            if (max === null) return mcap >= min
            return mcap >= min && mcap < max
          })
          if (!inRange) return false
        }
      }
      
      return true
    })

    // Sorting
    if (filters.sortBy !== "time") {
      result = result.sort((a, b) => {
        const quoteA = quotesCache.get(String(a.scripCode))
        const quoteB = quotesCache.get(String(b.scripCode))
        
        switch (filters.sortBy) {
          case "mcap_high":
            return (quoteB?.marketCap ?? 0) - (quoteA?.marketCap ?? 0)
          case "mcap_low":
            return (quoteA?.marketCap ?? Infinity) - (quoteB?.marketCap ?? Infinity)
          case "change_high":
            return (quoteB?.changePercent ?? -Infinity) - (quoteA?.changePercent ?? -Infinity)
          case "change_low":
            return (quoteA?.changePercent ?? Infinity) - (quoteB?.changePercent ?? Infinity)
          case "price_high":
            return (quoteB?.price ?? 0) - (quoteA?.price ?? 0)
          case "price_low":
            return (quoteA?.price ?? Infinity) - (quoteB?.price ?? Infinity)
          default:
            return 0
        }
      })
    }

    return result
  }, [announcements, query, filters, excludeNoise, getVerdict, quotesCache, MCAP_RANGES])

  // Keyboard shortcuts and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setShowSearchModal(true)
        return
      }

      // / to focus search modal
      if (e.key === "/") {
        e.preventDefault()
        setShowSearchModal(true)
        return
      }

      // Escape to close modals
      if (e.key === "Escape") {
        setShowSearchModal(false)
        setShowFilterModal(false)
        return
      }

      // Arrow keys / J/K for navigation
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        setKbdIndex(prev => {
          const next = Math.min(prev + 1, filtered.length - 1)
          if (next >= 0) {
            setSelectedId(filtered[next].id)
            itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          return next
        })
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        setKbdIndex(prev => {
          const next = Math.max(prev - 1, 0)
          if (next >= 0) {
            setSelectedId(filtered[next].id)
            itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
          return next
        })
      }

      // b to toggle bookmark
        if (e.key === "b" && selectedId) {
          toggleBookmark(selectedId)
        }

        // a to analyze with AI
        if (e.key === "a" && selectedId) {
          setShowChat(true)
        }

        // f to toggle hide irrelevant / focus mode
        if (e.key === "f") {
          e.preventDefault()
          setExcludeNoise(prev => !prev)
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [filtered, selectedId, toggleBookmark])

  // Sync kbdIndex when selection changes via mouse
  useEffect(() => {
    if (selectedId) {
      const idx = filtered.findIndex(a => a.id === selectedId)
      if (idx !== -1) setKbdIndex(idx)
    }
  }, [selectedId, filtered])

  // TTS for high-impact
  useEffect(() => {
    if (!enableTTS) return
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const synth = window.speechSynthesis
    for (const a of filtered.slice(0, 10)) {
      if (spokenRef.current.has(a.id)) continue
      if (a.impact !== "high") continue
      const u = new SpeechSynthesisUtterance(`${a.company}. ${a.headline}`)
      u.rate = 1.05
      try { synth.speak(u) } catch {}
      spokenRef.current.add(a.id)
    }
  }, [filtered, enableTTS])

  // Active filters count
    const activeFiltersCount = useMemo(() => {
      let count = 0
      if (filters.verdicts.length > 0) count++
      if (filters.groups.length > 0) count++
      if (filters.impacts.length > 0) count++
      if (filters.duringMarketHours) count++
      if (filters.mcapRanges.length > 0) count++
      if (filters.mcapMin !== null || filters.mcapMax !== null) count++
      if (filters.sortBy !== "time") count++
      return count
    }, [filters])

  // Calculate hidden count when "Hide Irrelevant" is active
  const hiddenCount = useMemo(() => {
    let source = announcements
    if (viewMode === 'bookmarks') {
      source = announcements.filter(a => bookmarks.has(a.id))
    } else if (viewMode === 'history') {
      source = history.map(id => announcements.find(a => a.id === id)).filter((a): a is BSEAnnouncement => !!a)
    }
    return source.filter(a => shouldExcludeAnnouncement(`${a.headline} ${a.summary}`)).length
  }, [announcements, viewMode, bookmarks, history])

  // Toggle function for keyboard shortcut
  const toggleHideIrrelevant = useCallback(() => {
    setExcludeNoise(prev => !prev)
  }, [])

  return (
    <div className="h-screen max-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white flex overflow-hidden" suppressHydrationWarning>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden" suppressHydrationWarning>
        {/* Stock Ticker */}
        <StockTicker 
          stocks={tickerStocks}
          onStockClick={async (symbol) => {
            try {
              const res = await fetch(`/api/bse/search?q=${encodeURIComponent(symbol)}`, { cache: "no-store" })
              const data = await res.json()
              const match = (data.results || []).find((r: any) => (r.symbol || "").toUpperCase() === symbol.toUpperCase()) || (data.results || [])[0]
              if (match?.scripCode) {
                router.push(`/company/${match.scripCode}`)
                return
              }
            } catch {}
            // Fallback: open search modal prefilled
            setQuery(symbol)
            setShowSearchModal(true)
          }}
        />

        {/* Header */}
          <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/5 bg-black/20" suppressHydrationWarning>
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-white" suppressHydrationWarning>Announcements</h1>
              <OnboardingHint
                id="announcements-hint"
                message="Use filters to narrow by impact, verdict, or market cap. Press Ctrl+K to search. AI summaries appear for high-impact filings."
                position="bottom"
              />
              <DigitalClock />
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
<span className="text-xs text-zinc-500">{filtered.length} results</span>
              {quotesLoading && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Loading quotes...
                </span>
              )}
              {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                {activeFiltersCount} filters
              </span>
            )}
            {/* Search Button - Premium Floating Style (Fey Nav Satellite) */}
            <button 
              onClick={() => setShowSearchModal(true)}
              className="w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px] shadow-[inset_1.25px_1.25px_1.25px_rgba(255,255,255,0.06),inset_1.25px_-1.25px_1.25px_rgba(255,255,255,0.02),0_10px_30px_rgba(0,0,0,0.6)] border border-white/5 hover:scale-110 active:scale-95 transition-all duration-300 group"
              title="Search (Ctrl+K)"
            >
              <Search className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" strokeWidth={1.5} />
            </button>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs",
                activeFiltersCount > 0 
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" 
                  : "bg-zinc-900/70 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFiltersCount > 0 && (
                <span className="px-1 rounded bg-cyan-500 text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Refresh Button */}
            <button 
              onClick={() => {
                fetchAnnouncements()
                // Force refresh quotes on manual refresh
                const uniqueScripCodes = [...new Set(announcements.map(a => a.scripCode))]
                batchFetchedRef.current.clear() // Clear the batch fetched set to force refetch
                fetchBatchQuotes(uniqueScripCodes, true)
              }} 
              className="p-1.5 rounded-lg bg-zinc-900/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>

          {/* TTS Toggle */}
          <button
            onClick={() => setEnableTTS(!enableTTS)}
            className={clsx(
              "p-1.5 rounded-lg border transition-all",
              enableTTS 
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" 
                : "bg-zinc-900/70 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {enableTTS ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <div className="fixed top-20 right-4 z-[100] animate-in fade-in slide-in-from-top-4">
                <div className={clsx(
                  "px-4 py-2 rounded-xl shadow-2xl border backdrop-blur-md flex items-center gap-3",
                  toast.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                  toast.type === 'error' ? "bg-rose-500/20 border-rose-500/30 text-rose-400" :
                  "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                )}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  <span className="text-sm font-medium">{toast.message}</span>
                </div>
              </div>
            )}
          </AnimatePresence>

              {/* Auto-Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold relative group overflow-hidden",
                  autoRefresh 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.1)]" 
                    : "bg-zinc-900/70 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
                title={autoRefresh ? "Live updates every 30s" : "Auto-refresh paused"}
              >
                {autoRefresh ? (
                  <>
                    <div className="absolute inset-0 bg-emerald-400/5 animate-pulse pointer-events-none" />
                    <Zap className="h-3.5 w-3.5 relative z-10" />
                    <span className="hidden sm:inline relative z-10">LIVE</span>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                    </span>
                  </>
                ) : (
                  <>
                    <ZapOff className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">PAUSED</span>
                  </>
                )}
              </button>

          </div>
        </header>

          {/* Main Content - Master-Detail */}
          <div className="flex-1 flex overflow-hidden min-h-0 relative">
            {/* Desktop Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={clsx(
                "hidden md:flex absolute top-1/2 -translate-y-1/2 z-40 w-1.5 h-32 items-center justify-center transition-all duration-500 group overflow-visible",
                sidebarCollapsed 
                  ? "left-0 bg-cyan-500/20 hover:bg-cyan-500/40 hover:w-3 rounded-r-full" 
                  : "left-[320px] -translate-x-full bg-white/5 hover:bg-white/10 hover:w-3 rounded-l-full border-y border-l border-white/10"
              )}
              title={sidebarCollapsed ? "Expand Announcements" : "Collapse Announcements"}
            >
              {/* Glow Effect */}
              <div className={clsx(
                "absolute inset-0 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                sidebarCollapsed ? "bg-cyan-500/20" : "bg-white/10"
              )} />
              
              <div className={clsx(
                "w-px h-12 rounded-full transition-all duration-500 relative z-10",
                sidebarCollapsed 
                  ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] group-hover:h-20" 
                  : "bg-zinc-600 group-hover:bg-zinc-300 group-hover:h-20"
              )} />
              
              <div className={clsx(
                "absolute transition-all duration-500 opacity-0 group-hover:opacity-100 group-hover:scale-110",
                sidebarCollapsed ? "left-1 text-cyan-400" : "right-1 text-zinc-300"
              )}>
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </div>
            </button>

              {/* Left Panel - Announcements List */}
              <aside className={clsx(
                "flex-col glass-sidebar transition-all duration-500 z-20",
                mobileView === 'list' ? "flex w-full" : "hidden md:flex",
                sidebarCollapsed 
                  ? "md:w-0 md:min-w-0 md:max-w-0 overflow-hidden opacity-0" 
                  : "md:w-[320px] opacity-100"
              )}>
                  {/* View Mode Switcher */}
                  <div className="flex items-center px-2 border-b border-white/5 bg-black/20">
                    {[
                      { id: 'all', label: 'LIVE', icon: Zap, color: 'cyan' },
                      { id: 'bookmarks', label: 'SAVED', icon: Bookmark, color: 'amber' },
                      { id: 'history', label: 'RECENT', icon: Clock, color: 'purple' },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = viewMode === tab.id;
                      const activeColorClass = 
                        tab.color === 'cyan' ? 'text-cyan-400' : 
                        tab.color === 'amber' ? 'text-amber-400' : 
                        'text-purple-400';
                      const activeBgClass = 
                        tab.color === 'cyan' ? 'bg-cyan-400' : 
                        tab.color === 'amber' ? 'bg-amber-400' : 
                        'bg-purple-400';

                      return (
                          <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id as any)}
                            className={clsx(
                              "relative flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold tracking-[0.1em] transition-all duration-300",
                              isActive ? activeColorClass : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            <Icon className={clsx(
                              "h-3 w-3 transition-all duration-300",
                              isActive ? "scale-110" : "opacity-50 grayscale",
                              tab.id === 'all' && isActive && "animate-pulse",
                              tab.id === 'bookmarks' && isActive && "fill-current"
                            )} style={isActive ? {
                              filter: tab.color === 'cyan' 
                                ? 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.8)) drop-shadow(0 0 12px rgba(34, 211, 238, 0.5))'
                                : tab.color === 'amber'
                                  ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8)) drop-shadow(0 0 12px rgba(251, 191, 36, 0.5))'
                                  : 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.8)) drop-shadow(0 0 12px rgba(192, 132, 252, 0.5))'
                            } : undefined} />
                          <span className="relative z-10">{tab.label}</span>
                          
                          {isActive && (
                            <motion.div
                              layoutId="activeTabUnderline"
                              className={clsx("absolute bottom-0 left-0 right-0 h-[2px] z-20", activeBgClass)}
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                          
                            {/* Subtle hover/active background - Deeper Navigation Style */}
                            <div className={clsx(
                              "absolute inset-x-1 inset-y-1.5 rounded-lg transition-all duration-300 -z-0",
                              isActive 
                                ? "bg-gradient-to-br from-zinc-900 to-black shadow-[0_4px_12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/5" 
                                : "group-hover:bg-white/[0.03]"
                            )} />
                        </button>
                      );
                    })}
                    </div>

                  {/* Focus Toggle - Ultra Minimal */}
                  <button
                    onClick={() => setExcludeNoise(!excludeNoise)}
                    className="group flex items-center justify-between w-full px-3 py-2 transition-colors hover:bg-white/[0.02]"
                    title="Focus mode (F)"
                  >
                    <span className={clsx(
                      "text-[10px] tracking-[0.2em] uppercase transition-colors",
                      excludeNoise ? "text-zinc-300" : "text-zinc-600"
                    )}>
                      Focus
                    </span>
                    <div className="flex items-center gap-2">
                      {excludeNoise && hiddenCount > 0 && (
                        <span className="text-[9px] text-zinc-600 tabular-nums">
                          -{hiddenCount}
                        </span>
                      )}
                      <div className={clsx(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        excludeNoise 
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" 
                          : "bg-zinc-700"
                      )} />
                    </div>
                  </button>

                  {/* List */}

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading && announcements.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <span className="text-sm text-zinc-500">Loading announcements...</span>
                </div>
              )}
              {error && (
                <div className="p-8 text-center">
                  <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
                  <p className="text-sm text-rose-400">{error}</p>
                  <button onClick={() => fetchAnnouncements()} className="mt-3 text-sm text-cyan-400 hover:underline">
                    Retry
                  </button>
                </div>
              )}
{filtered.map((a, idx) => {
                    const localSummary = getLocalSummary(a)
                    const verdict = localSummary.verdict.type
                    const isActive = selectedId === a.id
                    const announcementTime = new Date(a.time)
                    const now = new Date()
                    const diffMs = now.getTime() - announcementTime.getTime()
                    const diffMins = Math.floor(diffMs / 60000)
                    const isRecent = diffMins < 5
                    const isJustNow = diffMins < 1
                    
                                  const quoteData = quotesCache.get(String(a.scripCode))
                    
                    const verdictDot: Record<string, string> = {
                      'strong_positive': 'bg-emerald-400',
                      'positive': 'bg-emerald-400/70',
                      'neutral': 'bg-zinc-500',
                      'mixed': 'bg-amber-400',
                      'negative': 'bg-rose-400/70',
                      'strong_negative': 'bg-rose-400',
                    }
                    
                      const formatMcapValue = (mcap: number | null | undefined) => {
                        if (mcap == null) return null
                        if (mcap >= 100000) return `${(mcap / 100000).toFixed(2)}L`
                        if (mcap >= 1000) return mcap.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                        return mcap.toFixed(0)
                      }
                      
                              return (
                                  <button
                                    key={`${a.id}-${idx}`}
                                    ref={el => { itemRefs.current[idx] = el }}
                                    onClick={() => {
                                      setSelectedId(a.id)
                                      setMobileView('detail')
                                    }}
                                    className={clsx(
                                      "w-full text-left px-5 py-5 border-b border-white/[0.03] transition-all announcement-item group relative overflow-hidden",
                                      isActive && "active bg-white/[0.02]",
                                      !isActive && "hover:bg-white/[0.015]"
                                    )}
                                >
                                <div className="flex flex-col gap-2.5">
                                  {/* Top Row: Ticker & Time */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={clsx(
                                          "text-[10px] font-black tracking-[0.15em] uppercase transition-colors font-mono",
                                          isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-400"
                                        )}>
                                          <HighlightText text={a.ticker} query={query} />
                                        </span>
                                        <div className={clsx("w-1 h-1 rounded-full", verdictDot[verdict] || "bg-zinc-700")} />
                                        {isRecent && (
                                          <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {quoteData?.marketCap != null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-amber-400 font-bold tabular-nums flex items-baseline gap-0.5">
                                              {formatMcapValue(quoteData.marketCap)}
                                              <span className="text-[7px] font-black opacity-40 tracking-tighter uppercase ml-[1px]">CR</span>
                                            </span>
                                            <div className="w-0.5 h-0.5 rounded-full bg-zinc-800 mx-0.5" />
                                          </div>
                                        )}
                                        <span className="text-[10px] text-zinc-600 font-bold tabular-nums">
                                          {isJustNow ? 'JUST NOW' : timeAgo(a.time).replace(' ago', '').toUpperCase()}
                                        </span>
                                      </div>
                                    </div>

                                
                                {/* Middle: Headline */}
                                <h4 className={clsx(
                                  "text-[14px] leading-tight font-bold transition-colors",
                                  isActive ? "text-white" : "text-zinc-300 group-hover:text-white"
                                )}>
                                  <HighlightText text={a.headline} query={query} />
                                </h4>
                                
                                {/* Bottom: Meta Info */}
                                <div className="flex items-center justify-between text-[10px] font-bold tracking-tight">
                                  <div className="flex items-center gap-3">
                                    <span className={clsx(
                                      "px-2 py-0.5 rounded-md border border-white/[0.05]",
                                      CATEGORY_COLORS[a.category] || "bg-zinc-900 text-zinc-500"
                                    )}>
                                      {a.category.toUpperCase()}
                                    </span>
                                    {a.source === "FinEdge" && (
                                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">FinEdge</span>
                                    )}
                                    {bookmarks.has(a.id) && (
                                      <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500" />
                                    )}
                                  </div>
                                  
                                  {quoteData && (
                                    <div className="flex items-center gap-3 tabular-nums">
                                      <span className="text-zinc-500">₹{quoteData.price.toLocaleString()}</span>
                                      <span className={clsx(
                                        quoteData.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                      )}>
                                        {quoteData.changePercent >= 0 ? "+" : ""}{quoteData.changePercent.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>

                        )
                  })}
                {filtered.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p>No announcements match filters</p>
                  </div>
                )}
                {filtered.length > 0 && (
                  <div className="p-4 pt-0">
                    <button 
                      onClick={() => fetchAnnouncements()}
                      className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Load More Past Announcements
                    </button>
                  </div>
                )}
              </div>

          </aside>

            {/* Right Panel - Detail View */}
            <main className={clsx(
              "flex-1 overflow-hidden transition-all duration-300",
              mobileView === 'detail' ? "flex" : "hidden md:flex"
            )} suppressHydrationWarning>
              {selected ? (
                <div className="h-full w-full overflow-y-auto scrollbar-thin p-5 pb-32 md:pb-5 space-y-4">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden flex items-center gap-2 mb-4 text-cyan-400 font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                  </button>

                    {/* Company Header - Premium */}
                    <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3 md:px-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{selected.company}</span>
                            <span className="text-zinc-700">•</span>
                            <span className="text-[10px] text-zinc-600 font-medium">BSE: {selected.scripCode}</span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                              <h1 className="text-2xl font-bold tracking-tight gradient-text">{selected.ticker}</h1>
                              {(() => {
                                const cachedQuote = quotesCache.get(String(selected.scripCode))
                                const displayPrice = quote?.price ?? cachedQuote?.price
                                const displayChangePercent = quote?.changePercent ?? cachedQuote?.changePercent
                                const displayMarketCap = quote?.marketCap ?? cachedQuote?.marketCap
                                
                                if (displayPrice != null) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl font-semibold text-white tabular-nums">₹{displayPrice.toLocaleString()}</span>
                                      {typeof displayChangePercent === "number" && (
                                        <span className={clsx(
                                          "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
                                          displayChangePercent >= 0 ? "badge-positive" : "badge-negative"
                                        )}>
                                          {displayChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                          {displayChangePercent >= 0 ? "+" : ""}{displayChangePercent.toFixed(2)}%
                                        </span>
                                      )}
                                      {displayMarketCap != null && (
                                        <span className="text-[11px] text-zinc-500 font-medium tabular-nums">
                                          MCap: <span className="text-amber-400">{displayMarketCap >= 100000 
                                            ? `₹${(displayMarketCap / 100000).toFixed(1)}L Cr` 
                                            : displayMarketCap >= 1000 
                                              ? `₹${(displayMarketCap / 1000).toFixed(1)}K Cr`
                                              : `₹${displayMarketCap.toFixed(0)} Cr`
                                          }</span>
                                        </span>
                                      )}
                                      <button
                                        onClick={() => fetchCurrentQuote(selected.scripCode, selected.id, selected.time)}
                                        disabled={quoteLoading}
                                        className={clsx(
                                          "p-1.5 rounded-md hover:bg-white/5 text-zinc-600 hover:text-cyan-400 transition-all",
                                          quoteLoading && "opacity-50"
                                        )}
                                        title="Refresh"
                                      >
                                        <RefreshCw className={clsx("h-3 w-3", quoteLoading && "animate-spin")} />
                                      </button>
                                    </div>
                                  )
                                }
                                return quoteLoading ? <div className="h-5 w-24 skeleton" /> : null
                              })()}
                          </div>
                      
                        {/* Links Row - Compact */}
                              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                <a
                                  href={selected.bseUrl || `https://www.bseindia.com/stock-share-price/x/${selected.ticker.toLowerCase()}/${selected.scripCode}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-zinc-400 hover:text-white transition-all"
                                >
                                  <Globe className="h-3 w-3" />
                                  BSE
                                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                </a>
                                <a
                                  href={`https://www.nseindia.com/get-quotes/equity?symbol=${selected.ticker.toUpperCase()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-zinc-400 hover:text-white transition-all"
                                >
                                  <Globe className="h-3 w-3" />
                                  NSE
                                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                </a>
                                <a
                                  href={`https://www.screener.in/company/${selected.scripCode}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-amber-400/70 hover:text-amber-400 transition-all"
                                >
                                  <BarChart2 className="h-3 w-3" />
                                  Screener
                                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                </a>
                                  <Link
                                    href={`/company/${selected.scripCode}`}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-[10px] font-medium text-cyan-400 transition-all"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    Speedy Alpha
                                    <ChevronRight className="h-2.5 w-2.5" />
                                  </Link>
                                    <button
                                      onClick={() => setResearchOverlayOpen(true)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-[10px] font-medium text-purple-400 transition-all"
                                      title="Open research note for this announcement"
                                    >
                                      <PenSquare className="h-3 w-3" />
                                      Research Note
                                    </button>
                              </div>
                        </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <ShareMenu url={`${window.location.origin}/company/${selected.scripCode}`} title={`${selected.company} - Speedy Finance AI`} />
                            <button 
                              onClick={() => toggleBookmark(selected.id)}
                              className={clsx(
                                "p-1.5 rounded-md transition-colors",
                                bookmarks.has(selected.id) 
                                  ? "bg-amber-500/10 text-amber-400" 
                                  : "hover:bg-white/5 text-zinc-500 hover:text-white"
                              )}
                              title={bookmarks.has(selected.id) ? "Remove Bookmark" : "Bookmark (B)"}
                            >
                              <Bookmark className={clsx("h-4 w-4", bookmarks.has(selected.id) && "fill-amber-400")} />
                            </button>
                          </div>

                      </div>

                      <div className="mt-4 pt-4 border-t border-white/[0.04]">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-3 md:px-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-zinc-300" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold text-white leading-snug whitespace-normal">{selected.headline}</span>
                              <span className="text-xs text-zinc-400 mt-1">
                                {selected.category}
                                {selected.subCategory && ` · ${selected.subCategory}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {selected.pdfUrl && (
                              <a
                                href={selected.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-200 hover:bg-white/10 hover:text-white transition-all"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>View PDF</span>
                              </a>
                            )}
                            <button
                              onClick={() => setShowChat(true)}
                              className="relative group px-6 py-2.5 rounded-full bg-zinc-950 border border-white/10 text-[11px] font-bold text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.05)] hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:border-cyan-500/50"
                            >
                              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                              <div className="relative flex items-center gap-2 tracking-tight">
                                <div className="relative">
                                  <Sparkles className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform duration-500" />
                                  <div className="absolute inset-0 h-3.5 w-3.5 bg-cyan-400 blur-[8px] opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
                                </div>
                                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400 group-hover:from-white group-hover:to-white transition-colors">
                                  Analyze with Speedy AI
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Risk Alert - Shows for critical/high risk announcements */}
                  <RiskAlert text={`${selected.headline} ${selected.summary}`} />

                  {/* AI Summary Panel */}
                  <AISummaryPanel
                  headline={selected.headline}
                  summary={selected.summary}
                  category={selected.category}
                  subCategory={selected.subCategory}
                  announcementId={selected.id}
                  pdfUrl={selected.pdfUrl}
                    time={selected.time}
                    ticker={selected.ticker}
                    scripCode={selected.scripCode}
                    company={selected.company}

                  impact={selected.impact}
                  onFullScreenChat={() => {
                    setOpenChatMaximized(true)
                    setShowChat(true)
                  }}
                  quote={quote ? {
                      currentPrice: quote.price,
                      previousClose: quote.previousClose,
                      change: quote.change,
                      changePercent: quote.changePercent,
                      priceAtAnnouncement: priceAtAnnouncement,
                      alphaSinceAnnouncement: priceAtAnnouncement && quote.price 
                        ? ((quote.price - priceAtAnnouncement) / priceAtAnnouncement) * 100 
                        : null
                    } : undefined}
                />

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-zinc-500">Tags:</span>
                    {selected.tags.map((t) => (
                      <span key={t} className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                  {/* Recent Announcements - Collapsible with Multi-Select */}
                  <details className="glass-card rounded-2xl" open>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors list-none">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                        <AnimatePresence mode="wait">
                          {!isLocalSearchOpen ? (
                            <motion.h3 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="font-semibold text-white text-sm"
                            >
                              Recent Announcements
                            </motion.h3>
                          ) : (
                            <motion.div 
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: "auto" }}
                              exit={{ opacity: 0, width: 0 }}
                              className="flex-1 max-w-[300px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input 
                                autoFocus
                                placeholder="Smart filter..."
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-sm text-cyan-400 placeholder:text-zinc-600"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                          {filteredCompanyAnnouncements.length}
                        </span>
                        
                        {/* Satellite Search Button */}
                        <button 
                          onClick={() => {
                            setIsLocalSearchOpen(!isLocalSearchOpen)
                            if (isLocalSearchOpen) setLocalSearchQuery("")
                          }}
                          className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                            "bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_100%)]",
                            "backdrop-blur-[12px] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.1)] border border-white/10",
                            isLocalSearchOpen ? "text-cyan-400 scale-110" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          {isLocalSearchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </summary>
                    
                    {/* Chat with All / Selected Actions */}
                    {filteredCompanyAnnouncements.length > 0 && (
                      <div className="px-4 pb-2 flex items-center gap-2">
                        {selectedForChat.length === 0 ? (
                          <button
                            onClick={() => {
                              setSelectedForChat(filteredCompanyAnnouncements.map(a => a.id))
                              setShowChat(true)
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-[10px] text-cyan-400 font-medium transition-all"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Chat with All {filteredCompanyAnnouncements.length} {localSearchQuery ? 'Filtered' : ''}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setShowChat(true)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-[10px] text-purple-400 font-medium transition-all animate-in fade-in zoom-in-95"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Chat with {selectedForChat.length} selected
                            </button>
                            <button
                              onClick={() => setSelectedForChat([])}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                              title="Clear selection"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  
                        <div className="space-y-2 px-4 pb-4 md:pb-4 max-h-[500px] overflow-y-auto scrollbar-thin">
                          {filteredCompanyAnnouncements.map((a, idx) => (
                          <div
                            key={`${a.id}-${idx}`}

                          className={clsx(
                            "w-full text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border transition-all px-4 py-3",
                            selectedForChat.includes(a.id) 
                              ? "border-purple-500/40 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]" 
                              : a.id === selectedId 
                                ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.1)]" 
                                : "border-white/10 bg-black/40 hover:bg-black/60 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox for multi-select */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedForChat(prev => 
                                  prev.includes(a.id) 
                                    ? prev.filter(id => id !== a.id) 
                                    : [...prev, a.id]
                                )
                              }}
                              className={clsx(
                                "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                                selectedForChat.includes(a.id) 
                                  ? "bg-purple-500 border-purple-500" 
                                  : "border-zinc-600 hover:border-purple-400"
                              )}
                            >
                              {selectedForChat.includes(a.id) && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            
                            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-zinc-300" />
                            </div>

                            {/* Content - clickable to view */}
                            <button
                              onClick={() => {
                                setSelectedId(a.id)
                                setMobileView('detail')
                              }}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-white leading-snug whitespace-normal line-clamp-1">
                                  <HighlightText text={a.headline} query={localSearchQuery} />
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={clsx("text-[10px] font-medium text-zinc-400")}>
                                    <HighlightText text={a.category} query={localSearchQuery} />
                                  </span>
                                  <span className="text-[10px] text-zinc-600">·</span>
                                  <span className="text-[10px] text-zinc-600">{formatDate(a.time)}</span>
                                </div>
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {a.pdfUrl && (
                              <a
                                href={a.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
                              >
                                <Download className="h-3 w-3" />
                                <span>PDF</span>
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setSelectedId(a.id)
                                setShowChat(true)
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-[10px] font-semibold text-cyan-400 transition-all"
                            >
                              <Sparkles className="h-3 w-3" />
                              Analyze
                            </button>
                          </div>
                        </div>
                      ))}
                          {filteredCompanyAnnouncements.length === 0 && (
                            <div className="text-xs text-zinc-500 text-center py-4">
                              {localSearchQuery ? `No results for "${localSearchQuery}"` : "No recent announcements"}
                            </div>
                          )}
                        </div>
                      </details>


                  {/* Price & Change Since Announcement */}
                  <details className="glass-card rounded-2xl" open>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors list-none">
                      <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4 text-cyan-400" />
                        Price & Performance
                      </h3>
                      <div className="flex items-center gap-2">
                        {quoteLoading && <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />}
                        <span className={clsx(
                          "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors",
                          market.bg, market.color
                        )}>
                          {market.label}
                        </span>
                      </div>
                    </summary>
                      <div className="px-4 pb-4">
                        {/* Price at Announcement vs Current */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[10px] text-zinc-500">Price at News</div>
                              <Clock className="h-2.5 w-2.5 text-zinc-600" />
                            </div>
                            <div className="text-xl font-bold text-white tabular-nums">
                              {priceAtAnnouncement 
                                ? `₹${priceAtAnnouncement.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                                : "—"
                              }
                            </div>
                            <div className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-cyan-400" />
                              {(() => {
                                const annDate = new Date(selected.time)
                                const isPostMarket = annDate.getHours() >= 15 || (annDate.getHours() < 9 || (annDate.getHours() === 9 && annDate.getMinutes() < 15))
                                return isPostMarket ? "Post Market Announcement" : "During Market Hours"
                              })()}
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[10px] text-zinc-500">Alpha Since News</div>
                              <TrendingUp className="h-2.5 w-2.5 text-zinc-600" />
                            </div>
                            {priceAtAnnouncement && quote?.price ? (
                              <>
                                {(() => {
                                  const alpha = ((quote.price - priceAtAnnouncement) / priceAtAnnouncement) * 100
                                  return (
                                    <>
                                      <div className={clsx(
                                        "text-xl font-bold tabular-nums flex items-center gap-2",
                                        alpha >= 0 ? "text-emerald-400" : "text-rose-400"
                                      )}>
                                        {alpha >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        {alpha >= 0 ? "+" : ""}{alpha.toFixed(2)}%
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className={clsx(
                                          "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                                          alpha >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                        )}>
                                          {alpha >= 5 ? "Strong Gain" : alpha >= 0 ? "Positive" : alpha <= -5 ? "Strong Loss" : "Negative"}
                                        </span>
                                      </div>
                                    </>
                                  )
                                })()}
                              </>
                            ) : (
                              <div className="text-xl font-bold text-zinc-500">—</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Day Stats with Live Tag */}
                        <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Live Market Feed (BSE)</div>
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", market.status === 'Open' ? "bg-emerald-400" : "bg-zinc-400")}></span>
                                <span className={clsx("relative inline-flex rounded-full h-2 w-2", market.status === 'Open' ? "bg-emerald-500" : "bg-zinc-500")}></span>
                              </span>
                              <span className="text-[9px] text-zinc-500 font-medium">Synced</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center">
                              <div className="text-[10px] text-zinc-500 mb-0.5">Current</div>
                              <div className="text-base font-semibold text-white tabular-nums">
                                ₹{quote?.price?.toLocaleString() || "—"}
                              </div>
                            </div>
                            <div className="text-center border-x border-white/5">
                              <div className="text-[10px] text-zinc-500 mb-0.5">Day High</div>
                              <div className="text-base font-semibold text-emerald-400/90 tabular-nums">
                                ₹{quote?.dayHigh?.toLocaleString() || "—"}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-zinc-500 mb-0.5">Day Low</div>
                              <div className="text-base font-semibold text-rose-400/90 tabular-nums">
                                ₹{quote?.dayLow?.toLocaleString() || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* TradingView Chart Container */}
                        <div className="relative group">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BarChart2 className="h-3.5 w-3.5 text-zinc-500" />
                              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Technical Chart</span>
                            </div>
                            {market.status === 'Closed' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                <Clock className="h-2.5 w-2.5 text-amber-500" />
                                <span className="text-[9px] text-amber-500 font-medium">Last Session: {market.label === 'Weekend' ? 'Friday' : 'Earlier'}</span>
                              </div>
                            )}
                          </div>
                          
                            <div className="relative rounded-xl overflow-hidden border border-white/5">
                                    <LightweightChart
                                      symbol={companyInfo?.symbol || selected.ticker}
                                      scripCode={selected.scripCode}
                                      exchange="BSE"
                                      height={400}
                                      targetDate={selected.time}
                                      type="area"
                                      announcements={companyAnnouncements}
                                      whaleDeals={whaleDeals}
                                      highlightedAnnouncementId={selectedId}
                                    />

                              
                              {/* Event Markers Overlay */}
                            <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
                              {companyAnnouncements.slice(0, 3).map((ann, i) => (
                                <div 
                                  key={ann.id}
                                  className="animate-in fade-in slide-in-from-right-2 duration-500"
                                  style={{ animationDelay: `${i * 150}ms` }}
                                >
                                  <div className="px-2 py-1 rounded-md bg-zinc-900/90 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-xl pointer-events-auto cursor-help group/ann" title={ann.headline}>
                                    <div className={clsx(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      ann.impact === 'high' ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : 
                                      ann.impact === 'medium' ? "bg-amber-400" : "bg-zinc-400"
                                    )} />
                                    <span className="text-[9px] font-medium text-zinc-300 group-hover/ann:text-white transition-colors truncate max-w-[100px]">
                                      {ann.category}
                                    </span>
                                    <span className="text-[8px] text-zinc-500">{formatDate(ann.time)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                  </details>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-zinc-700" />
                  <p className="text-zinc-500">Select an announcement to view details</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={setFilters}
        initialFilters={filters}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectStock={(stock) => {
          setQuery(stock.symbol)
          setShowSearchModal(false)
        }}
      />

      {/* Research Note Overlay */}
      <ResearchNoteOverlay
        isOpen={researchOverlayOpen}
        onClose={() => setResearchOverlayOpen(false)}
        context={researchContext}
        initialTitle={researchContext?.announcement?.headline}
      />

      {/* Speedy AI Chat - PIP Style */}
      {selected && (
        <SpeedyPipChat
          announcement={selected}
          isOpen={showChat}
          onClose={() => {
            setShowChat(false)
            setSelectedForChat([])
            setOpenChatMaximized(false)
          }}
          companyAnnouncements={companyAnnouncements}
          preSelectedDocIds={selectedForChat}
          initialMaximized={openChatMaximized}
        />
      )}

      {/* Mobile Floating Filter Button */}
      <button
        onClick={() => setShowFilterModal(true)}
        className={clsx(
          "md:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg shadow-black/30 transition-all",
          activeFiltersCount > 0 
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white" 
            : "bg-zinc-800 border border-zinc-700 text-white"
        )}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Filter className="h-5 w-5" />
        <span className="font-medium">Filters</span>
        {activeFiltersCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-cyan-600 text-xs font-bold">
            {activeFiltersCount}
          </span>
        )}
      </button>
    </div>
  )
}
