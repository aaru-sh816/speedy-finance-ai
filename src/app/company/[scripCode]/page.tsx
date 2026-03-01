"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  Search, Filter, Download, Volume2, VolumeX, RefreshCw, TrendingUp, TrendingDown, 
  FileText, Sparkles, X, ExternalLink, ChevronRight, Globe, AlertTriangle, Zap, ZapOff,
  Calendar, BarChart2, Share2, Bookmark, ChevronDown, MessageSquare, Clock, ArrowLeft, ChevronLeft,
  EyeOff, Eye, Building2
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"
import { AISummaryPanel } from "@/components/ai-summary-panel"
import { LightweightChart } from "@/components/lightweight-chart"
import { type VerdictType, type AISummary, shouldExcludeAnnouncement } from "@/lib/ai/verdict"
import { getMarketStatus } from "@/lib/bse/market-hours"
import { FilterModal, FilterState, getDefaultFilters, McapRange } from "@/components/filter-modal"
import { StockTicker, type TickerStock } from "@/components/stock-ticker"
import { SearchModal } from "@/components/search-modal"
import { SpeedyPipChat } from "@/components/speedy-pip-chat"
import { DigitalClock } from "@/components/digital-clock"
import { ShareMenu } from "@/components/share-menu"
import { RiskAlert } from "@/components/sentiment-badge"
import { DrivingEventBadge } from "@/components/driving-event-badge"
import { FallbackAvatar } from "@/components/FallbackAvatar"
import { InsiderGravity } from "@/components/insider-gravity"
import { useWhaleDeals } from "@/hooks/useWhaleDeals"
import { StockNotesPanel } from "@/components/stock-notes-panel"
import { ResearchNoteContext } from "@/components/research-note-overlay"
import { clsx } from "clsx"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { CompanyFundamentals } from "@/components/company-fundamentals"
import { ResearchNoteOverlay } from "@/components/research-note-overlay"

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

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

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
  "General": "bg-zinc-500/10 text-zinc-400",
  "Acquisition": "bg-blue-500/10 text-blue-400",
  "Board Meeting": "bg-purple-500/10 text-purple-400",
  "Outcome": "bg-emerald-500/10 text-emerald-400",
  "Financial Results": "bg-amber-500/10 text-amber-400",
  "Result": "bg-amber-500/10 text-amber-400",
  "AGM/EGM": "bg-cyan-500/10 text-cyan-400",
  "Dividend": "bg-pink-500/10 text-pink-400",
  "Analyst/Investor Meet": "bg-indigo-500/10 text-indigo-400",
  "Intimation": "bg-zinc-500/10 text-zinc-400",
  "Order": "bg-emerald-500/10 text-emerald-400",
  "Allotment": "bg-violet-500/10 text-violet-400",
  "Company Update": "bg-blue-500/10 text-blue-400",
  "Others": "bg-zinc-500/10 text-zinc-400",
}

interface CompanyData {
  scripCode: string
  symbol: string
  companyName: string
  industry?: string
  sector?: string
  group?: string
  faceValue?: number | null
  isin?: string
  lastPrice?: number | null
  tradingViewSymbol?: string | null
  restricted?: boolean
  logoUrl?: string
  logoUrlFallback?: string
}

interface Quote {
  symbol: string
  price: number | null
  previousClose?: number | null
  open?: number | null
  change?: number | null
  changePercent?: number | null
  volume?: number | null
  dayHigh?: number | null
  dayLow?: number | null
  marketCap?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
}

export default function CompanyPage() {
  const params = useParams()
  const router = useRouter()
  const scripCode = params.scripCode as string

  const { deals: whaleDeals } = useWhaleDeals(scripCode)

  const [company, setCompany] = useState<CompanyData | null>(null)
  const [announcements, setAnnouncements] = useState<BSEAnnouncement[]>([])
  const [corporateActions, setCorporateActions] = useState<any[]>([])
  const [corporateActionsError, setCorporateActionsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localSearchQuery, setLocalSearchQuery] = useState("")
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false)

  const [showChat, setShowChat] = useState(false)
  const [selectedForChat, setSelectedForChat] = useState<string[]>([])
  const [openChatMaximized, setOpenChatMaximized] = useState(false)

  const [filters, setFilters] = useState<FilterState>(getDefaultFilters())
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [query, setQuery] = useState("")
  const [excludeNoise, setExcludeNoise] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [viewMode, setViewMode] = useState<'all' | 'bookmarks' | 'history'>('all')
  const [activeTab, setActiveTab] = useState<'announcements' | 'corporate-actions' | 'fundamentals'>('announcements')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [priceAtAnnouncement, setPriceAtAnnouncement] = useState<number | null>(null)
  const [quotesCache, setQuotesCache] = useState<Map<string, { price: number; changePercent: number; marketCap: number | null }>>(new Map())
  const announcementPricesRef = useRef<Map<string, number>>(new Map())

  const [tickerStocks, setTickerStocks] = useState<TickerStock[]>([])

  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<string[]>([])

  const [enableTTS, setEnableTTS] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const spokenRef = useRef<Set<string>>(new Set())

  const [kbdIndex, setKbdIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [companyLogoSrc, setCompanyLogoSrc] = useState<string | null>(null)

    const researchContext: ResearchNoteContext | undefined = company ? {
      scripCode,
      symbol: company.symbol,
      companyName: company.companyName,
      currentPrice: quote?.price ?? undefined,
      changePercent: quote?.changePercent ?? undefined,
    } : undefined

    const [overlayOpen, setOverlayOpen] = useState(false)
    const [overlayContext, setOverlayContext] = useState<{ title?: string; content?: string; type?: "note" | "ai" }>({})

    const openOverlay = useCallback((ctx: { title?: string; content?: string; type?: "note" | "ai" }) => {
      setOverlayContext(ctx)
      setOverlayOpen(true)
    }, [])


  useEffect(() => {
    setCompanyLogoSrc(company?.logoUrl ?? null)
  }, [company?.logoUrl])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    try {
      const b = localStorage.getItem('speedy_bookmarks')
      if (b) setBookmarks(new Set(JSON.parse(b)))
      const h = localStorage.getItem('speedy_history')
      if (h) setHistory(JSON.parse(h))
      const n = localStorage.getItem('speedy_hide_irrelevant')
      if (n === 'true') setExcludeNoise(true)
      const p = localStorage.getItem('speedy_announcement_prices')
      if (p) {
        const parsed = JSON.parse(p)
        Object.entries(parsed).forEach(([id, price]) => announcementPricesRef.current.set(id, price as number))
      }
    } catch (e) {}
  }, [])

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
      setToast({ message: next.has(id) ? 'Added to bookmarks' : 'Removed from bookmarks', type: 'info' })
      return next
    })
  }, [])

  const market = useMemo(() => {
    const status = getMarketStatus()
    if (status.isWeekend) return { status: 'Closed', label: 'Weekend', color: 'text-rose-400', bg: 'bg-rose-500/20' }
    if (status.isPreMarket) return { status: 'Closed', label: 'Pre-Market', color: 'text-amber-400', bg: 'bg-amber-500/20' }
    if (status.isPostMarket) return { status: 'Closed', label: 'Post-Market', color: 'text-zinc-400', bg: 'bg-zinc-500/20' }
    return { status: 'Open', label: 'Market Open', color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
  }, [])

  const fetchCompanyData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)
      setCorporateActionsError(null)
      const res = await fetchWithTimeout(`/api/bse/company/${scripCode}`, {
        cache: "no-store",
        timeoutMs: 20000,
        signal,
      })
      if (!res.ok) throw new Error("Failed to fetch company data")
      const data = await res.json()

      setCompany({
        scripCode: data.scripCode,
        symbol: data.symbol || scripCode,
        companyName: data.companyName || `Company ${scripCode}`,
        industry: data.industry,
        sector: data.sector,
        group: data.group,
        faceValue: data.faceValue,
        isin: data.isin,
        lastPrice: data.lastPrice,
        tradingViewSymbol: data.tradingViewSymbol,
        restricted: data.restricted,
        logoUrl: data.logoUrl,
        logoUrlFallback: data.logoUrlFallback,
      })

      if (data.announcements) {
        setAnnouncements(data.announcements)
        if (!selectedId && data.announcements.length > 0) setSelectedId(data.announcements[0].id)
      }

      const corpRes = await fetchWithTimeout(`/api/bse/corporate-actions?scripCode=${scripCode}&pastDays=90&days=30`, {
        cache: "no-store",
        timeoutMs: 15000,
        signal,
      })
      if (corpRes.ok) {
        const corpData = await corpRes.json()
        setCorporateActions(corpData.actions || [])
        setCorporateActionsError(null)
      } else {
        setCorporateActions([])
        const errBody = await corpRes.json().catch(() => ({}))
        setCorporateActionsError(errBody?.error || "Failed to load corporate actions")
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") return
      setError((e as Error)?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [scripCode, selectedId])

  useEffect(() => {
    const ctrl = new AbortController()
    fetchCompanyData(ctrl.signal)
    // Fallback: stop loading after 15s so user sees page (with error if fetch failed)
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 15000)
    return () => {
      ctrl.abort()
      clearTimeout(timeoutId)
    }
  }, [fetchCompanyData])

  const fetchCurrentQuote = useCallback(async (symbol: string, annId: string, annTime: string) => {
    setQuoteLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/bse/quote?symbol=${encodeURIComponent(scripCode)}`, {
        cache: "no-store",
        timeoutMs: 10000,
      })
      const d = await res.json()
      if (!d || d.error) return

      const q: Quote = {
        symbol: d.symbol,
        price: d.price,
        previousClose: d.previousClose,
        open: d.open,
        change: d.change,
        changePercent: d.changePercent,
        volume: d.volume,
        dayHigh: d.dayHigh,
        dayLow: d.dayLow,
        marketCap: d.marketCap,
        fiftyTwoWeekHigh: d.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: d.fiftyTwoWeekLow,
      }
      setQuote(q)

      setQuotesCache(prev => new Map(prev).set(scripCode, {
        price: d.price,
        changePercent: d.changePercent ?? 0,
        marketCap: d.marketCap ?? null
      }))

      const cachedPrice = announcementPricesRef.current.get(annId)
      if (cachedPrice) {
        setPriceAtAnnouncement(cachedPrice)
      } else {
        const annDate = new Date(annTime)
        const now = new Date()
        const diffMins = Math.floor((now.getTime() - annDate.getTime()) / 60000)
        const status = getMarketStatus()
        
        if (diffMins < 5 && status.isOpen && d.price) {
          setPriceAtAnnouncement(d.price)
          announcementPricesRef.current.set(annId, d.price)
          const stored = JSON.parse(localStorage.getItem('speedy_announcement_prices') || '{}')
          stored[annId] = d.price
          localStorage.setItem('speedy_announcement_prices', JSON.stringify(stored))
        } else {
          const isSameDay = annDate.toDateString() === now.toDateString()
          if (isSameDay && d.previousClose) setPriceAtAnnouncement(d.previousClose)
          else setPriceAtAnnouncement(d.price)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setQuoteLoading(false)
    }
  }, [scripCode])

  const selected = useMemo(() => announcements.find(a => a.id === selectedId) || null, [announcements, selectedId])

  useEffect(() => {
    if (selected && company?.symbol) {
      fetchCurrentQuote(company.symbol, selected.id, selected.time)
    }
  }, [selected?.id, company?.symbol, fetchCurrentQuote])

  const filtered = useMemo(() => {
    let source = announcements
    if (viewMode === 'bookmarks') source = announcements.filter(a => bookmarks.has(a.id))
    else if (viewMode === 'history') source = history.map(id => announcements.find(a => a.id === id)).filter(Boolean) as BSEAnnouncement[]

    return source.filter(a => {
      if (excludeNoise && shouldExcludeAnnouncement(`${a.headline} ${a.summary}`)) return false
      if (query) {
        const q = query.toLowerCase()
        if (!a.headline.toLowerCase().includes(q) && !a.category.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [announcements, viewMode, bookmarks, history, excludeNoise, query])

  const filteredSidebar = useMemo(() => {
    if (!localSearchQuery) return announcements
    const q = localSearchQuery.toLowerCase()
    return announcements.filter(a => a.headline.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
  }, [announcements, localSearchQuery])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setShowSearchModal(true) }
      if (e.key === "/") { e.preventDefault(); setShowSearchModal(true) }
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
      if (e.key === "b" && selectedId) toggleBookmark(selectedId)
      if (e.key === "a" && selectedId) setShowChat(true)
      if (e.key === "f") { e.preventDefault(); setExcludeNoise(!excludeNoise) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filtered, selectedId, toggleBookmark, excludeNoise])

  useEffect(() => {
    if (!enableTTS || typeof window === "undefined" || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    for (const a of filtered.slice(0, 5)) {
      if (spokenRef.current.has(a.id)) continue
      if (a.impact !== "high") continue
      const u = new SpeechSynthesisUtterance(`${a.company}. ${a.headline}`)
      u.rate = 1.05
      synth.speak(u)
      spokenRef.current.add(a.id)
    }
  }, [filtered, enableTTS])

  const formatMcap = (mcap: number | null | undefined) => {
    if (mcap == null) return "—"
    if (mcap >= 100000) return `${(mcap / 100000).toFixed(2)}L`
    if (mcap >= 1000) return mcap.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    return mcap.toFixed(0)
  }

  if (loading && !company) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-500 text-sm font-medium tracking-widest">LOADING TERMINAL</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white flex overflow-hidden">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white shadow-xl"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <StockTicker stocks={tickerStocks} onStockClick={s => { setQuery(s); setShowSearchModal(true) }} />

        {error && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-400 text-sm" role="alert">
            {error}
          </div>
        )}

        <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-bold gradient-text truncate max-w-[200px] md:max-w-none" title={company?.companyName}>
              {company?.symbol || company?.companyName || "Company"}
            </h1>
            <DigitalClock />
          </div>

            <div className="flex items-center justify-end gap-2 flex-1">
              <span className="text-xs text-zinc-500">{filtered.length} results</span>
              {quoteLoading && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Loading quotes...
                </span>
              )}
              
              <button 
                onClick={() => setShowSearchModal(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center pointer-events-auto bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.6)] border border-white/5 hover:scale-110 active:scale-95 transition-all duration-300 group"
                title="Search (Ctrl+K)"
              >
                <Search className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" strokeWidth={1.5} />
              </button>

              <button onClick={() => setShowFilterModal(true)} className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"><Filter className="h-4 w-4" /></button>
              <button onClick={() => fetchCompanyData()} className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"><RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} /></button>
              
              <button onClick={() => setEnableTTS(!enableTTS)} className={clsx("p-2 rounded-lg border transition-all", enableTTS ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "bg-zinc-900/70 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800")}>
                {enableTTS ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-bold relative group overflow-hidden",
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

        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={clsx("hidden md:flex absolute top-1/2 -translate-y-1/2 z-40 w-1.5 h-32 items-center justify-center transition-all duration-500 group", sidebarCollapsed ? "left-0 bg-cyan-500/20" : "left-[320px] -translate-x-full bg-white/5")}><div className={clsx("w-px h-12 rounded-full transition-all", sidebarCollapsed ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-zinc-600")} /></button>

          <aside className={clsx("flex-col glass-sidebar transition-all duration-500 z-20", mobileView === 'list' ? "flex w-full" : "hidden md:flex", sidebarCollapsed ? "md:w-0 md:min-w-0 md:max-w-0 overflow-hidden opacity-0" : "md:w-[320px] opacity-100")}>
            <div className="flex items-center px-2 border-b border-white/5 bg-black/20">
              {[
                { id: 'all', label: 'LIVE', icon: Zap, color: 'cyan' },
                { id: 'bookmarks', label: 'SAVED', icon: Bookmark, color: 'amber' },
                { id: 'history', label: 'RECENT', icon: Clock, color: 'purple' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className={clsx("relative flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-black tracking-[0.2em]", viewMode === tab.id ? `text-${tab.color}-400` : "text-zinc-600 hover:text-zinc-400")}>
                  <tab.icon className={clsx("h-3.5 w-3.5", viewMode === tab.id && "animate-pulse")} />
                  {tab.label}
                  {viewMode === tab.id && <motion.div layoutId="vtab" className={clsx("absolute bottom-0 inset-x-2 h-0.5", `bg-${tab.color}-400`)} />}
                </button>
              ))}
            </div>

            <button onClick={() => setExcludeNoise(!excludeNoise)} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] group"><span className={clsx("text-[9px] font-black tracking-[0.3em] uppercase", excludeNoise ? "text-zinc-300" : "text-zinc-600")}>FOCUS MODE</span><div className={clsx("w-1.5 h-1.5 rounded-full transition-all", excludeNoise ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-800")} /></button>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filtered.map((a, idx) => {
                const isActive = selectedId === a.id
                const q = quotesCache.get(scripCode)
                const announcementTime = new Date(a.time)
                const now = new Date()
                const diffMins = Math.floor((now.getTime() - announcementTime.getTime()) / 60000)
                const isRecent = diffMins < 5
                const isJustNow = diffMins < 1
                
                return (
                  <button 
                    key={a.id} 
                    ref={el => { itemRefs.current[idx] = el }} 
                    onClick={() => { setSelectedId(a.id); setMobileView('detail') }} 
                    className={clsx(
                      "w-full text-left px-5 py-5 border-b border-white/[0.03] transition-all group relative", 
                      isActive ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                    )}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            "text-[10px] font-black tracking-[0.15em] uppercase transition-colors font-mono", 
                            isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-400"
                          )}>
                            {a.ticker}
                          </span>
                          <div className={clsx("w-1 h-1 rounded-full", a.impact === 'high' ? "bg-emerald-400" : a.impact === 'medium' ? "bg-amber-400" : "bg-zinc-700")} />
                          {isRecent && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {q?.marketCap != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-amber-400 font-bold tabular-nums flex items-baseline gap-0.5">
                                ₹{formatMcap(q.marketCap)}
                                <span className="text-[7px] font-black opacity-40 tracking-tighter uppercase ml-[1px]">CR</span>
                              </span>
                              <div className="w-0.5 h-0.5 rounded-full bg-zinc-800 mx-0.5" />
                            </div>
                          )}
                          <span className="text-[10px] text-zinc-600 font-bold tabular-nums uppercase">
                            {isJustNow ? 'JUST NOW' : timeAgo(a.time).replace(' ago', '').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <h4 className={clsx(
                        "text-[14px] leading-tight font-bold transition-colors", 
                        isActive ? "text-white" : "text-zinc-300 group-hover:text-white"
                      )}>
                        {a.headline}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] font-bold tracking-tight">
                        <div className="flex items-center gap-3">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-md border border-white/[0.05] uppercase", 
                            CATEGORY_COLORS[a.category] || "bg-zinc-900 text-zinc-500"
                          )}>
                            {a.category}
                          </span>
                          {bookmarks.has(a.id) && (
                            <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        
                        {q && q.price != null && (
                          <div className="flex items-center gap-3 tabular-nums">
                            <span className="text-zinc-500">₹{q.price.toLocaleString()}</span>
                            <span className={clsx(
                              q.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[4px_0_12px_rgba(6,182,212,0.4)]" />}
                  </button>
                )
              })}
            </div>
          </aside>

          <main className={clsx("flex-1 overflow-y-auto scrollbar-thin transition-all duration-300", mobileView === 'detail' ? "flex" : "hidden md:flex")}>
            {selected ? (
                <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                  <button onClick={() => setMobileView('list')} className="md:hidden flex items-center gap-2 text-cyan-400 text-xs font-bold mb-4 uppercase"><ArrowLeft className="h-3 w-3" /> BACK TO LIST</button>

                  {company?.restricted && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Trading Restricted (GSM)</h3>
                        <p className="text-xs text-rose-300/70 mt-1">
                          This security is currently under Graded Surveillance Measure (GSM) or other trading restrictions. 
                          Live quote data may be unavailable or limited.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Main Header Card */}
                <div className="glass-card rounded-3xl p-6 border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px]" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] text-zinc-500 font-black uppercase tracking-widest">{company?.industry || "EQUITY"}</span>
                          <span className="text-zinc-800">•</span>
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">BSE:{scripCode}</span>
                          <div className={clsx("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", market.bg, market.color)}>{market.label}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 w-14 h-14 -translate-x-1 -translate-y-1 bg-cyan-500/10 blur-xl rounded-full" aria-hidden />
                            {companyLogoSrc ? (
                            <div className="relative flex-shrink-0 rounded-full overflow-hidden border border-white/10 bg-zinc-800 hover:ring-1 hover:ring-white/20 transition-shadow w-12 h-12">
                              <img
                                src={companyLogoSrc}
                                alt=""
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={() => {
                                  setCompanyLogoSrc((prev) =>
                                    company?.logoUrlFallback && prev === company.logoUrl
                                      ? company.logoUrlFallback
                                      : null
                                  )
                                }}
                              />
                            </div>
                          ) : (
                            <FallbackAvatar
                              initial={company?.symbol || company?.companyName || scripCode}
                              size={48}
                            />
                          )}
                            </div>
                          <div className="space-y-1 min-w-0 flex-1">
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white">{company?.symbol}</h1>
                            <p className="text-sm text-zinc-500 font-medium">{company?.companyName}</p>
                          </div>
                        </div>
                        
                        {/* Quote Info Row */}
                        {quote && quote.price != null && (
                          <div className="flex items-center gap-3 pt-2">
                            <span className="text-2xl font-black text-white tabular-nums">₹{quote.price.toLocaleString()}</span>
                            {quote.changePercent != null && (
                              <span className={clsx("text-sm font-bold tabular-nums flex items-center gap-1", quote.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {quote.changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                              </span>
                            )}
                            {quote.marketCap != null && (
                              <span className="text-xs text-zinc-500 font-medium">
                                MCap: <span className="text-amber-400 font-bold">₹{formatMcap(quote.marketCap)} Cr</span>
                              </span>
                            )}
                            <button
                              onClick={() => selected && fetchCurrentQuote(scripCode, selected.id, selected.time)}
                              disabled={quoteLoading}
                              className={clsx("p-1.5 rounded-md hover:bg-white/5 text-zinc-600 hover:text-cyan-400 transition-all", quoteLoading && "opacity-50")}
                            >
                              <RefreshCw className={clsx("h-3 w-3", quoteLoading && "animate-spin")} />
                            </button>
                          </div>
                        )}
                        
                        {quote?.changePercent != null && <DrivingEventBadge symbol={company?.symbol || scripCode} scripCode={scripCode} changePercent={quote.changePercent} announcements={announcements} />}
                      </div>
                    </div>

                    {/* Links Row */}
                    <div className="flex items-center gap-1.5 pt-3 border-t border-white/5 flex-wrap">
                      <a href={`https://www.bseindia.com/stock-share-price/x/${company?.symbol?.toLowerCase()}/${scripCode}/`} target="_blank" className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-zinc-400 hover:text-white transition-all">
                        <Globe className="h-3 w-3" /> BSE <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </a>
                      <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${company?.symbol}`} target="_blank" className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-zinc-400 hover:text-white transition-all">
                        <Globe className="h-3 w-3" /> NSE <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </a>
                      <a href={`https://www.screener.in/company/${scripCode}/`} target="_blank" className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.06] text-[10px] font-medium text-amber-400/70 hover:text-amber-400 transition-all">
                        <BarChart2 className="h-3 w-3" /> Screener <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </a>
                      <div className="flex-1" />
                      <ShareMenu url={typeof window !== 'undefined' ? window.location.href : ''} title={company?.companyName} />
                      <button onClick={() => toggleBookmark(selected.id)} className={clsx("p-1.5 rounded-md transition-colors", bookmarks.has(selected.id) ? "bg-amber-500/10 text-amber-400" : "hover:bg-white/5 text-zinc-500 hover:text-white")}>
                        <Bookmark className={clsx("h-4 w-4", bookmarks.has(selected.id) && "fill-amber-400")} />
                      </button>
                    </div>

                    {/* News Summary Bar - EXACT match to announcements page */}
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
                </div>

                <div className="flex items-center gap-2 border-b border-white/5">
                  {['announcements', 'corporate-actions', 'fundamentals'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={clsx("relative px-6 py-3 text-[10px] font-black tracking-[0.2em] uppercase transition-all", activeTab === tab ? "text-cyan-400" : "text-zinc-600 hover:text-zinc-400")}>
                      {tab.replace('-', ' ')}
                      {activeTab === tab && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                    </button>
                  ))}
                </div>

                    {activeTab === 'fundamentals' ? (
                      <div className="space-y-12">
                        <CompanyFundamentals 
                          scripCode={scripCode} 
                          marketCapFallback={quote?.marketCap} 
                          onNoteAction={openOverlay}
                        />

                      </div>
                    ) : activeTab === 'announcements' ? (


                  <>
                    <RiskAlert text={selected.headline} />
                    <AISummaryPanel 
                      headline={selected.headline} 
                      summary={selected.summary} 
                      category={selected.category} 
                      subCategory={selected.subCategory} 
                      announcementId={selected.id} 
                      pdfUrl={selected.pdfUrl} 
                      time={selected.time} 
                      ticker={selected.ticker} 
                      scripCode={scripCode} 
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
                        alphaSinceAnnouncement: priceAtAnnouncement && quote.price ? ((quote.price - priceAtAnnouncement) / priceAtAnnouncement) * 100 : null 
                      } : undefined} 
                    />

                    {/* Recent Announcements - EXACT match to announcements page */}
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
                            {filteredSidebar.length}
                          </span>
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
                      
                      {filteredSidebar.length > 0 && (
                        <div className="px-4 pb-2 flex items-center gap-2">
                          {selectedForChat.length === 0 ? (
                            <button
                              onClick={() => {
                                setSelectedForChat(filteredSidebar.map(a => a.id))
                                setShowChat(true)
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-[10px] text-cyan-400 font-medium transition-all"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Chat with All {filteredSidebar.length} {localSearchQuery ? 'Filtered' : ''}
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
                        {filteredSidebar.map((a, idx) => (
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
                                {selectedForChat.includes(a.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </button>
                              
                              <button 
                                onClick={() => setSelectedId(a.id)} 
                                className="flex-1 text-left min-w-0"
                              >
                                <p className="text-sm font-semibold text-white truncate">
                                  <HighlightText text={a.headline} query={localSearchQuery} />
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">{formatDate(a.time)} · {a.category}</p>
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-auto md:ml-0">
                              {a.pdfUrl && (
                                <a
                                  href={a.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>PDF</span>
                                </a>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
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
                      </div>
                    </details>

                    {/* Price Performance Section */}
                    <details className="glass-card rounded-2xl border-white/10" open>
                      <summary className="p-4 cursor-pointer flex items-center justify-between">
                        <h3 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                          <Zap className="h-4 w-4 text-cyan-400" /> PRICE PERFORMANCE
                        </h3>
                        <div className={clsx("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", market.bg, market.color)}>{market.label}</div>
                      </summary>
                      <div className="px-4 pb-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Price at News</p>
                                <Clock className="h-2.5 w-2.5 text-zinc-600" />
                              </div>
                              <p className="text-xl font-black text-white tabular-nums">
                                {priceAtAnnouncement ? `₹${priceAtAnnouncement.toLocaleString('en-IN')}` : "—"}
                              </p>
                              <div className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-cyan-400" />
                                {(() => {
                                  const annDate = new Date(selected.time)
                                  const isPostMarket = annDate.getHours() >= 15 || annDate.getHours() < 9
                                  return isPostMarket ? "Post Market" : "During Market"
                                })()}
                              </div>
                            </div>
                            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Alpha Since</p>
                                <TrendingUp className="h-2.5 w-2.5 text-zinc-600" />
                              </div>
                              {priceAtAnnouncement && quote?.price ? (
                                <>
                                  <div className="flex items-baseline gap-1">
                                    <p className={clsx("text-xl font-black tabular-nums", (quote.price - priceAtAnnouncement) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                      {((quote.price - priceAtAnnouncement) / priceAtAnnouncement * 100).toPrecision(3)}%
                                    </p>
                                  </div>
                                  <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                      className={clsx(
                                        "h-full transition-all duration-1000",
                                        (quote.price - priceAtAnnouncement) >= 0 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]"
                                      )}
                                      style={{ width: `${Math.min(Math.abs((quote.price - priceAtAnnouncement) / priceAtAnnouncement * 100) * 10, 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={clsx(
                                      "px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1",
                                      (quote.price - priceAtAnnouncement) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                      <div className={clsx("w-1 h-1 rounded-full animate-pulse", (quote.price - priceAtAnnouncement) >= 0 ? "bg-emerald-400" : "bg-rose-400")} />
                                      {(() => {
                                        const alpha = (quote.price - priceAtAnnouncement) / priceAtAnnouncement * 100
                                        if (alpha >= 5) return "Explosive Growth"
                                        if (alpha >= 2) return "Strong Momentum"
                                        if (alpha >= 0) return "Positive Drift"
                                        if (alpha <= -5) return "Sharp Rejection"
                                        if (alpha <= -2) return "Bearish Pressure"
                                        return "Neutral / Steady"
                                      })()}
                                    </span>
                                  </div>
                                </>
                              ) : <p className="text-xl font-black text-zinc-700">—</p>}
                            </div>
                            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <p className="text-[10px] font-black text-zinc-600 tracking-widest mb-1 uppercase">Market Cap</p>
                              <p className="text-xl font-black text-amber-500 tabular-nums">
                                {quote?.marketCap ? <>₹{formatMcap(quote.marketCap)}<span className="text-xs ml-1 opacity-50 font-black">CR</span></> : "—"}
                              </p>
                            </div>
                            <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <p className="text-[10px] font-black text-zinc-600 tracking-widest mb-1 uppercase">Volume</p>
                              <p className="text-xl font-black text-white tabular-nums">{quote?.volume ? quote.volume.toLocaleString('en-IN') : "—"}</p>
                            </div>

                            <div className="col-span-2 bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Day Range</p>
                                <p className="text-[10px] font-bold text-zinc-400 tabular-nums">
                                  ₹{quote?.dayLow?.toLocaleString('en-IN') || "—"} - ₹{quote?.dayHigh?.toLocaleString('en-IN') || "—"}
                                </p>
                              </div>
                              <div className="relative h-1.5 w-full bg-white/5 rounded-full mt-2">
                                {quote?.dayLow && quote?.dayHigh && quote?.price && (
                                  <div 
                                    className="absolute h-full bg-cyan-500/30 rounded-full"
                                    style={{ 
                                      left: '0%', 
                                      right: '0%' 
                                    }}
                                  />
                                )}
                                {quote?.dayLow && quote?.dayHigh && quote?.price && (
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-white border border-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)] rounded-full transition-all duration-500"
                                    style={{ left: `${((quote.price - quote.dayLow) / (quote.dayHigh - quote.dayLow)) * 100}%` }}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between mt-2">
                                <span className="text-[8px] font-black text-zinc-700 uppercase">L</span>
                                <span className="text-[8px] font-black text-white uppercase tabular-nums">₹{quote?.price?.toLocaleString('en-IN') || "—"}</span>
                                <span className="text-[8px] font-black text-zinc-700 uppercase">H</span>
                              </div>
                            </div>

                            <div className="col-span-2 bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">52 Week Range</p>
                                <p className="text-[10px] font-bold text-zinc-400 tabular-nums">
                                  ₹{quote?.fiftyTwoWeekLow?.toLocaleString('en-IN') || "—"} - ₹{quote?.fiftyTwoWeekHigh?.toLocaleString('en-IN') || "—"}
                                </p>
                              </div>
                              <div className="relative h-1.5 w-full bg-white/5 rounded-full mt-2">
                                {quote?.fiftyTwoWeekLow && quote?.fiftyTwoWeekHigh && quote?.price && (
                                  <div 
                                    className="absolute h-full bg-emerald-500/20 rounded-full"
                                    style={{ 
                                      left: '0%', 
                                      right: '0%' 
                                    }}
                                  />
                                )}
                                {quote?.fiftyTwoWeekLow && quote?.fiftyTwoWeekHigh && quote?.price && (
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-white border border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)] rounded-full transition-all duration-500"
                                    style={{ left: `${((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100}%` }}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between mt-2">
                                <span className="text-[8px] font-black text-zinc-700 uppercase">52W L</span>
                                <span className="text-[8px] font-black text-zinc-500 uppercase tabular-nums">Range: {quote?.fiftyTwoWeekLow && quote?.fiftyTwoWeekHigh ? ((quote.fiftyTwoWeekHigh / quote.fiftyTwoWeekLow - 1) * 100).toFixed(0) + "%" : "—"}</span>
                                <span className="text-[8px] font-black text-zinc-700 uppercase">52W H</span>
                              </div>
                            </div>

                        </div>
                          <div className="relative rounded-2xl overflow-hidden border border-white/5 h-[400px]">
                            <LightweightChart symbol={company?.symbol || ""} scripCode={scripCode} exchange="BSE" height={400} targetDate={selected.time} type="area" announcements={announcements} whaleDeals={whaleDeals} highlightedAnnouncementId={selectedId} />
                          </div>
                        </div>
                      </details>

                      <InsiderGravity scripCode={scripCode} ticker={company?.symbol} currentPrice={quote?.price ?? undefined} initialDeals={whaleDeals} />

                      <StockNotesPanel 
                        scripCode={scripCode} 
                        symbol={company?.symbol || scripCode} 
                        companyName={company?.companyName || ''} 
                        currentPrice={quote?.price ?? undefined}
                        changePercent={quote?.changePercent ?? undefined}
                      />

                      {/* Company Profile */}
                    <details className="glass-card rounded-2xl border-white/10" open>
                      <summary className="p-4 cursor-pointer flex items-center justify-between">
                        <h3 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-400" /> COMPANY PROFILE
                        </h3>
                      </summary>
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">ISIN</p>
                            <p className="text-xs font-bold text-zinc-300">{company?.isin || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Face Value</p>
                            <p className="text-xs font-bold text-zinc-300">{company?.faceValue ? `₹${company.faceValue}` : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Group</p>
                            <p className="text-xs font-bold text-zinc-300">{company?.group || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Industry</p>
                            <p className="text-xs font-bold text-zinc-300 truncate">{company?.industry || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Sector</p>
                            <p className="text-xs font-bold text-zinc-300 truncate">{company?.sector || "—"}</p>
                          </div>
                        </div>
                      </div>
                    </details>
                  </>
                ) : (
                  <div className="space-y-4">
                    {corporateActionsError ? (
                      <div className="glass-card rounded-2xl p-6 text-center border border-amber-500/20 bg-amber-500/5">
                        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-400" />
                        <p className="text-sm font-semibold text-amber-200 mb-1">Could not load corporate actions</p>
                        <p className="text-xs text-zinc-400">{corporateActionsError}</p>
                      </div>
                    ) : corporateActions.length === 0 ? (
                      <div className="glass-card rounded-2xl p-12 text-center text-zinc-600">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">NO ACTIONS FOUND</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {corporateActions.map((action, i) => (
                          <div key={i} className="glass-card rounded-2xl p-5 border-white/5 hover:border-white/10 transition-all space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest">ACTION</div>
                              <span className="text-[10px] text-zinc-600 font-bold uppercase">{action.Ex_date || action.exDate}</span>
                            </div>
                            <h4 className="text-sm font-bold text-white leading-tight">{action.Purpose || action.purpose}</h4>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                              <div>
                                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Record Date</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums">{action.Record_date || action.recordDate || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">BC Start</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums">{action.BC_Start || action.bcStartDate || '—'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-800">
                <div className="text-center space-y-4">
                  <Zap className="h-16 w-16 mx-auto opacity-10" />
                  <p className="text-sm font-black tracking-[0.3em] uppercase">NO ANNOUNCEMENT SELECTED</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <FilterModal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} onApply={setFilters} initialFilters={filters} />
      <SearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} onSelectStock={s => { router.push(`/company/${s.scripCode}`); setShowSearchModal(false) }} />
      {selected && <SpeedyPipChat announcement={selected} isOpen={showChat} onClose={() => { setShowChat(false); setSelectedForChat([]); setOpenChatMaximized(false) }} companyAnnouncements={announcements} preSelectedDocIds={selectedForChat} initialMaximized={openChatMaximized} />}
      
        <ResearchNoteOverlay 
          isOpen={overlayOpen}
          onClose={() => { setOverlayOpen(false); setOverlayContext({}) }}
          context={researchContext}
          initialTitle={overlayContext.title}
          initialContent={overlayContext.content}
        />

    </div>
  )
}
