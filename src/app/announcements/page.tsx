"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  Search, Filter, Download, Volume2, VolumeX, RefreshCw, TrendingUp, TrendingDown, 
    FileText, Sparkles, X, ExternalLink, ChevronRight, Globe, AlertTriangle, Zap, ZapOff,
    Calendar, BarChart2, Share2, Bookmark, ChevronDown, MessageSquare, Clock, ArrowLeft, ChevronLeft
  } from "lucide-react"
import type { BSEAnnouncement, BSEImpact } from "@/lib/bse/types"
import { AISummaryPanel, VerdictBadge } from "@/components/ai-summary-panel"
import { TradingViewChart } from "@/components/trading-view-chart"
import { type VerdictType, type AISummary, analyzeAnnouncement, getVerdictColor, getVerdictIcon, shouldExcludeAnnouncement } from "@/lib/ai/verdict"
import { FilterModal, FilterState, getDefaultFilters } from "@/components/filter-modal"
import { StockTicker, type TickerStock } from "@/components/stock-ticker"
import { SearchModal } from "@/components/search-modal"
import { SpeedyPipChat } from "@/components/speedy-pip-chat"
import { DigitalClock } from "@/components/digital-clock"
import { ShareMenu } from "@/components/share-menu"

function clsx(...v: (string | false | undefined)[]) {
  return v.filter(Boolean).join(" ")
}

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

export default function AnnouncementsPage() {
  const router = useRouter()
  // Data state
  const [announcements, setAnnouncements] = useState<BSEAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [companyAnnouncements, setCompanyAnnouncements] = useState<BSEAnnouncement[]>([])
  
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
    
    // Verdicts & local summary cache for filtered items
  const verdictsCache = useRef<Map<string, VerdictType>>(new Map())
  const summaryCache = useRef<Map<string, AISummary>>(new Map())
  
  // Quote state
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [priceAtAnnouncement, setPriceAtAnnouncement] = useState<number | null>(null)
  
  // Company info for TradingView
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  
  // TTS state
  const [enableTTS, setEnableTTS] = useState(false)
  const spokenRef = useRef<Set<string>>(new Set())
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Ticker stocks
  const [tickerStocks, setTickerStocks] = useState<TickerStock[]>([])

  // Mobile view state
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setShowSearchModal(true)
      }
      // Escape to close modals
      if (e.key === "Escape") {
        setShowSearchModal(false)
        setShowFilterModal(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const queryParams = new URLSearchParams()
      queryParams.set("maxPages", "30") // Increased for "all possible past announcements"
      if (filters.fromDate) queryParams.set("fromDate", filters.fromDate)
      if (filters.toDate) queryParams.set("toDate", filters.toDate)
      
      const res = await fetch(`/api/bse/announcements?${queryParams.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setAnnouncements(data.announcements || [])
      // Auto-select first if none selected
      if (!selectedId && data.announcements?.length > 0) {
        setSelectedId(data.announcements[0].id)
      }
    } catch (e: any) {
      setError(e.message || "Failed to load announcements")
    } finally {
      setLoading(false)
    }
  }, [selectedId, filters.fromDate, filters.toDate])

  // Initial fetch
  useEffect(() => {
    fetchAnnouncements()
  }, [])

  // Refetch when dates change
  useEffect(() => {
    fetchAnnouncements()
  }, [filters.fromDate, filters.toDate])

  // Auto-refresh - Real-time updates every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchAnnouncements, 30000) // 30 seconds for real-time
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [autoRefresh, fetchAnnouncements])

  // Get selected announcement - check both main and company announcements
  const selected = useMemo(() => {
    // First check main announcements
    const fromMain = announcements.find((a) => a.id === selectedId)
    if (fromMain) return fromMain
    // Then check company announcements (for Recent Announcements selection)
    const fromCompany = companyAnnouncements.find((a) => a.id === selectedId)
    return fromCompany || null
  }, [announcements, companyAnnouncements, selectedId])

  // Fetch quote when selection changes
  useEffect(() => {
    if (!selected) return
    const ctrl = new AbortController()
    setQuoteLoading(true)
    setPriceAtAnnouncement(null)
    
    fetch(`/api/bse/quote?symbol=${encodeURIComponent(selected.scripCode)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
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
        
        // For announcements from the same day, use previous close as reference price
        const annDate = new Date(selected.time)
        const today = new Date()
        const isSameDay = annDate.toDateString() === today.toDateString()
        const isPostMarket = annDate.getHours() >= 15 || annDate.getHours() < 9
        
        if (isSameDay || isPostMarket) {
          // Use previous close as reference price for same-day or post-market announcements
          if (d.previousClose) {
            setPriceAtAnnouncement(d.previousClose)
          }
        } else {
          // For older announcements, use previous close as approximation
          if (d.previousClose) {
            setPriceAtAnnouncement(d.previousClose)
          }
        }
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false))
    return () => ctrl.abort()
  }, [selected?.scripCode, selected?.time])

    // Fetch company announcements and info when selection changes
    useEffect(() => {
      if (!selected) return
      const ctrl = new AbortController()
      fetch(`/api/bse/company/${selected.scripCode}?days=365`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        let companyAnns = d.announcements || []
        
        // If API returned no announcements, use announcements from main list for same company
        if (companyAnns.length === 0) {
          companyAnns = announcements.filter(a => 
            a.scripCode === selected.scripCode || 
            a.ticker === selected.ticker ||
            a.company === selected.company
          )
        }
        
        setCompanyAnnouncements(companyAnns)
        // Store tradingViewSymbol for chart
        setCompanyInfo({
          tradingViewSymbol: d.tradingViewSymbol || null,
          companyName: d.companyName || selected.company,
          symbol: d.symbol || selected.ticker,
        })
      })
      .catch(() => {
        // Fallback: filter from main announcements list
        const fallbackAnns = announcements.filter(a => 
          a.scripCode === selected.scripCode || 
          a.ticker === selected.ticker ||
          a.company === selected.company
        )
        setCompanyAnnouncements(fallbackAnns)
        setCompanyInfo(null)
      })
    return () => ctrl.abort()
  }, [selected?.scripCode, selected?.company, selected?.ticker, announcements])

  // Get local AI summary & verdict for announcement (with caching)
  const getLocalSummary = useCallback((a: BSEAnnouncement): AISummary => {
    const existing = summaryCache.current.get(a.id)
    if (existing) return existing
    const result = analyzeAnnouncement(a.headline, a.summary, a.category, a.subCategory)
    summaryCache.current.set(a.id, result)
    verdictsCache.current.set(a.id, result.verdict.type)
    return result
  }, [])

  const getVerdict = useCallback((a: BSEAnnouncement): VerdictType => {
    const cachedVerdict = verdictsCache.current.get(a.id)
    if (cachedVerdict) return cachedVerdict
    const summary = getLocalSummary(a)
    return summary.verdict.type
  }, [getLocalSummary])

  // Filter announcements
  const filtered = useMemo(() => {
    return announcements.filter((a) => {
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

      // During market hours filter (approximate, based on local time)
      if (filters.duringMarketHours) {
        const hour = announcementDate.getHours()
        if (hour < 9 || hour >= 16) return false
      }
      
      // Text search filter
      if (query) {
        const q = query.toLowerCase()
        const hay = `${a.ticker} ${a.company} ${a.headline} ${a.summary} ${a.tags.join(" ")}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      
      return true
    })
  }, [announcements, query, filters, excludeNoise, getVerdict])

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
    return count
  }, [filters])

  return (
    <div className="h-screen max-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
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
          <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-white">Announcements</h1>
              <DigitalClock />
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
            <span className="text-xs text-zinc-500">{filtered.length} results</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                {activeFiltersCount} filters
              </span>
            )}
            {/* Search Button */}
            <button 
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ctrl+K</span>
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
              onClick={fetchAnnouncements} 
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

            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium",
                autoRefresh 
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" 
                  : "bg-zinc-900/70 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
              title={autoRefresh ? "Live updates every 30s" : "Auto-refresh paused"}
            >
              {autoRefresh ? (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Live</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </>
              ) : (
                <>
                  <ZapOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Paused</span>
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
                  <button onClick={fetchAnnouncements} className="mt-3 text-sm text-cyan-400 hover:underline">
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
                const isRecent = diffMins < 5 // Within 5 minutes = show live dot
                const isJustNow = diffMins < 1
                
                // Verdict colors
                const verdictColors: Record<string, string> = {
                  'strong_positive': 'text-emerald-400',
                  'positive': 'text-green-400',
                  'neutral': 'text-zinc-400',
                  'mixed': 'text-amber-400',
                  'negative': 'text-orange-400',
                  'strong_negative': 'text-rose-400',
                }
                
                  return (
                    <button
                      key={`${a.id}-${idx}`}
                      onClick={() => {
                        setSelectedId(a.id)
                        setMobileView('detail')
                      }}
                      className={clsx(

                      "w-full text-left p-3 border-b border-white/5 transition-all announcement-item",
                      isActive && "active",
                      isRecent && !isActive && "bg-cyan-500/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Company Avatar with Initial */}
                      <div className={clsx(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 transition-transform",
                        isActive 
                          ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white scale-105" 
                          : "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400"
                      )}>
                        {a.ticker.charAt(0)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="font-medium text-white text-xs truncate">{a.company}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Live dot for recent announcements */}
                            {isRecent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Just arrived" />
                            )}
                            <span className="text-[10px] text-zinc-500">
                              {isJustNow ? 'Just now' : timeAgo(a.time)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {/* Category chip */}
                          <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", CATEGORY_COLORS[a.category] || "bg-zinc-500/15 text-zinc-400")}>
                            {a.category}
                          </span>
                          {/* Verdict indicator */}
                          {verdict && verdict !== 'neutral' && (
                            <span className={clsx("text-[10px] font-medium", verdictColors[verdict] || 'text-zinc-400')}>
                              {verdict === 'strong_positive' ? '▲▲' : verdict === 'positive' ? '▲' : verdict === 'negative' ? '▼' : verdict === 'strong_negative' ? '▼▼' : '◆'}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{a.headline}</p>
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
            )}>
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

                {/* Company Header - Compact */}
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-zinc-400 mb-0.5">{selected.company}</div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold gradient-text">{selected.ticker}</h1>
                        {quote && quote.price != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-semibold text-white tabular-nums">₹{quote.price.toLocaleString()}</span>
                            {typeof quote.changePercent === "number" && (
                              <span className={clsx(
                                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold",
                                quote.changePercent >= 0 ? "badge-positive" : "badge-negative"
                              )}>
                                {quote.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        )}
                        {quoteLoading && <span className="text-xs text-zinc-500 animate-pulse">Loading...</span>}
                      </div>
                      
                            {/* Links Row */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {/* BSE Link */}
                                  <a
                                    href={selected.bseUrl || `https://www.bseindia.com/stock-share-price/x/${selected.ticker.toLowerCase()}/${selected.scripCode}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121212] border border-white/5 text-[11px] font-medium text-[#00E5FF] hover:bg-[#1A1A1A] transition-all"
                                  >
                                    <Globe className="h-3.5 w-3.5 text-[#00E5FF]" />
                                    <span>BSE</span>
                                    <ExternalLink className="h-3 w-3 text-[#00E5FF]" />
                                  </a>

                                  <span className="text-zinc-700 text-[10px]">•</span>

                                  {/* NSE Link */}
                                  <a
                                    href={`https://www.nseindia.com/get-quotes/equity?symbol=${selected.ticker.toUpperCase()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121212] border border-white/5 text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition-all"
                                  >
                                    <Globe className="h-3.5 w-3.5 opacity-50" />
                                    <span>NSE</span>
                                    <ExternalLink className="h-3 w-3 opacity-50" />
                                  </a>

                                <span className="text-zinc-700 text-[10px]">•</span>
                                
                                {/* Screener Link */}
                                <a
                                  href={`https://www.screener.in/company/${selected.scripCode}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121212] border border-white/5 text-[11px] font-medium text-[#FF9100] hover:bg-[#1A1A1A] transition-all"
                                >
                                  <BarChart2 className="h-3.5 w-3.5 text-[#FF9100]" />
                                  <span>Screener</span>
                                  <ExternalLink className="h-3 w-3 text-[#FF9100]" />
                                </a>

                                <span className="text-zinc-700 text-[10px]">•</span>
                                
                                {/* Speedy Finance Internal Link */}
                                <Link
                                  href={`/company/${selected.scripCode}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121212] border border-emerald-500/30 text-[11px] font-medium text-[#00E676] hover:bg-[#1A1A1A] transition-all"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-[#00E676]" />
                                  <span>Speedy Alpha</span>
                                  <ChevronRight className="h-3 w-3 text-[#00E676]" />
                                </Link>

                                <span className="text-zinc-700 text-[10px]">•</span>

                                {/* Scrip Code */}
                                <span className="text-zinc-500 text-[11px] font-medium px-1">
                                  BSE: {selected.scripCode}
                                </span>
                              </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ShareMenu url={`${window.location.origin}/company/${selected.scripCode}`} title={`${selected.company} - Speedy Finance AI`} />
                        <button className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
                          <Bookmark className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                  <div className="text-sm md:text-base text-zinc-100 leading-relaxed">
                    {selected.summary && selected.summary !== selected.headline
                      ? selected.summary
                      : selected.headline}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-3 md:px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-zinc-300" />
                      </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-white leading-snug whitespace-normal">
                              {selected.headline}
                            </span>
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
                              {/* Futuristic Scanner Effect */}
                              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                              
                              <div className="relative flex items-center gap-2 tracking-tight">
                                <div className="relative">
                                  <Sparkles className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform duration-500" />
                                  <div className="absolute inset-0 h-3.5 w-3.5 bg-cyan-400 blur-[8px] opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                </div>
                                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400 group-hover:from-white group-hover:to-white transition-colors">
                                  Analyze with Speedy AI
                                </span>
                              </div>
                            </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span>BSE Corporate Filings</span>
                    <a
                      href={selected.bseUrl || `https://www.bseindia.com/stock-share-price/x/${selected.ticker.toLowerCase()}/${selected.scripCode}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                    >
                      <span>View on BSE</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

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
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      Recent Announcements
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                      {companyAnnouncements.length}
                    </span>
                  </summary>
                  
                  {/* Chat with All / Selected Actions */}
                  {companyAnnouncements.length > 0 && (
                    <div className="px-4 pb-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedForChat(companyAnnouncements.map(a => a.id))
                          setShowChat(true)
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-[10px] text-cyan-400 font-medium transition-all"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Chat with ALL {companyAnnouncements.length}
                      </button>
                      {selectedForChat.length > 0 && selectedForChat.length < companyAnnouncements.length && (
                        <button
                          onClick={() => setShowChat(true)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-[10px] text-purple-400 font-medium transition-all"
                        >
                          Chat with {selectedForChat.length} selected
                        </button>
                      )}
                      {selectedForChat.length > 0 && (
                        <button
                          onClick={() => setSelectedForChat([])}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                          title="Clear selection"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  
                    <div className="space-y-1.5 px-4 pb-4 md:pb-4 max-h-[500px] overflow-y-auto scrollbar-thin">
                      {companyAnnouncements.map((a, idx) => (

                      <div
                        key={`${a.id}-${idx}`}
                        className={clsx(
                          "w-full text-left p-2.5 rounded-xl border transition-all",
                          selectedForChat.includes(a.id) 
                            ? "border-purple-500/40 bg-purple-500/10" 
                            : a.id === selectedId 
                              ? "border-cyan-500/40 bg-cyan-500/5" 
                              : "border-white/5 hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
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
                              "mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all",
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
                          
                          {/* Content - clickable to view */}
                          <button
                            onClick={() => {
                        setSelectedId(a.id)
                        setMobileView('detail')
                      }}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={clsx("text-[10px] px-1.5 py-0.5 rounded", CATEGORY_COLORS[a.category] || "bg-zinc-500/15 text-zinc-400")}>
                                {a.category}
                              </span>
                              <span className="text-[10px] text-zinc-600">{formatDate(a.time)}</span>
                            </div>
                            <p className="text-xs text-zinc-300 line-clamp-2">{a.headline}</p>
                          </button>
                        </div>
                      </div>
                    ))}
                    {companyAnnouncements.length === 0 && (
                      <div className="text-xs text-zinc-500 text-center py-4">No recent announcements</div>
                    )}
                  </div>
                </details>

                {/* Price & Change Since Announcement */}
                <details className="glass-card rounded-2xl" open>
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors list-none">
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      Price & Change
                    </h3>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium",
                      new Date().getHours() >= 9 && new Date().getHours() < 16 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/20 text-rose-400"
                    )}>
                      {new Date().getHours() >= 9 && new Date().getHours() < 16 ? "Market Open" : "Market Closed"}
                    </span>
                  </summary>
                    <div className="px-4 pb-4">
                        {/* Price at Announcement vs Current */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-white/5 rounded-xl p-3">
                            <div className="text-[10px] text-zinc-500 mb-1">Price at News</div>
                            <div className="text-xl font-bold text-white tabular-nums">
                              {priceAtAnnouncement 
                                ? `₹${priceAtAnnouncement.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                                : "—"
                              }
                            </div>
                            <div className="text-[10px] text-cyan-400 mt-1">
                              {(() => {
                                const annDate = new Date(selected.time)
                                const isPostMarket = annDate.getHours() >= 15 || annDate.getHours() < 9
                                return isPostMarket ? "Post Market Announcement" : "During Market Hours"
                              })()}
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-3">
                            <div className="text-[10px] text-zinc-500 mb-1">Alpha Since News</div>
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
                      
                      {/* Day Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-[10px] text-zinc-500 mb-0.5">Current</div>
                          <div className="text-base font-semibold text-cyan-400 tabular-nums">
                            ₹{quote?.price?.toLocaleString() || "—"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-zinc-500 mb-0.5">Day High</div>
                          <div className="text-base font-semibold text-emerald-400 tabular-nums">
                            ₹{quote?.dayHigh?.toLocaleString() || "—"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-zinc-500 mb-0.5">Day Low</div>
                          <div className="text-base font-semibold text-rose-400 tabular-nums">
                            ₹{quote?.dayLow?.toLocaleString() || "—"}
                          </div>
                        </div>
                      </div>
                      
                      {/* Interactive AI Events Overlay */}
                      <div className="relative group">
                        <TradingViewChart
                          symbol={companyInfo?.tradingViewSymbol || selected.ticker}
                          exchange="BSE"
                          height={260}
                          fallbackMessage={`Chart unavailable for ${companyInfo?.companyName || selected.company}`}
                        />
                        
                        {/* Event Markers Overlay (Conceptual Fey.ai Style) */}
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
