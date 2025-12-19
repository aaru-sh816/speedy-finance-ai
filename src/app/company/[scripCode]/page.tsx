"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, ExternalLink, Globe, TrendingUp, TrendingDown, 
  FileText, Calendar, Building2, BarChart2, Sparkles, RefreshCw,
  ChevronDown, ChevronUp, MessageSquare, Share2, Bookmark, Download
} from "lucide-react"
import clsx from "clsx"
import type { BSEAnnouncement } from "@/lib/bse/types"
import { SidebarNav } from "@/components/sidebar-nav"
import { AISummaryPanel } from "@/components/ai-summary-panel"
import { SpeedyPipChat } from "@/components/speedy-pip-chat"
import { TradingViewChart, ChartPlaceholder } from "@/components/trading-view-chart"
import { FeyEnhancedQuote } from "@/components/fey/FeyEnhancedQuote"

interface CompanyData {
  scripCode: string
  symbol: string
  companyName: string
  industry?: string
  sector?: string
  group?: string
  faceValue?: number
  isin?: string
  lastPrice?: number | null
  tradingViewSymbol?: string | null // Validated symbol for TradingView charts
}

interface Quote {
  price: number | null
  change: number | null
  changePercent: number | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  open?: number | null
  prevClose?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
}

export default function CompanyPage() {
  const params = useParams()
  const router = useRouter()
  const scripCode = params.scripCode as string

  // State
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [announcements, setAnnouncements] = useState<BSEAnnouncement[]>([])
  const [corporateActions, setCorporateActions] = useState<any[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<BSEAnnouncement | null>(null)
  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [openChatMaximized, setOpenChatMaximized] = useState(false)
  const [activeTab, setActiveTab] = useState<'announcements' | 'corporate-actions'>('announcements')
  const [expandedSection, setExpandedSection] = useState<string>("announcements")

  const displayPrice = useMemo(() => {
    const live = quote?.price ?? null
    const bse = company?.lastPrice ?? null
    if (live != null && bse != null) {
      const diff = Math.abs(live - bse) / (bse === 0 ? 1 : bse)
      // If live deviates more than 20% from BSE header, trust BSE
      return diff > 0.2 ? bse : live
    }
    return live ?? bse ?? null
  }, [quote?.price, company?.lastPrice])

  // Resolve a valid TradingView symbol from multiple sources
  const isValidSymbol = (s?: string | null) => !!(s && /^[A-Z0-9&-]+$/i.test(s) && !/^\d+$/.test(s))
  const chartSymbol = useMemo(() => {
    if (isValidSymbol(company?.tradingViewSymbol)) return company!.tradingViewSymbol!
    if (isValidSymbol(company?.symbol)) return company!.symbol!
    const t1 = (selectedAnnouncement as any)?.ticker as string | undefined
    if (isValidSymbol(t1)) return t1!
    const t2 = announcements.find((a: any) => isValidSymbol(a?.ticker))?.ticker as string | undefined
    if (isValidSymbol(t2)) return t2!
    return null
  }, [company?.tradingViewSymbol, company?.symbol, selectedAnnouncement, announcements])

  // Fetch company data
  useEffect(() => {
    async function fetchCompanyData() {
      setLoading(true)
      try {
        // Fetch company info + announcements from company API
        console.log(`[Company Page] Fetching data for scripCode: ${scripCode}`)
        const companyRes = await fetch(`/api/bse/company/${scripCode}`)
        
        if (companyRes.ok) {
          const data = await companyRes.json()
          console.log(`[Company Page] Got company data:`, data.symbol, data.companyName)
          
          // Set company info
          setCompany({
            scripCode: data.scripCode,
            symbol: data.symbol || scripCode,
            companyName: data.companyName || `Company ${scripCode}`,
            industry: data.industry,
            sector: data.sector,
            group: data.group,
            faceValue: data.faceValue,
            isin: data.isin,
            lastPrice: data.lastPrice ?? null,
            tradingViewSymbol: data.tradingViewSymbol || null,
          })
          
          // Set announcements from same response (company API returns them)
          if (data.announcements && data.announcements.length > 0) {
            console.log(`[Company Page] Got ${data.announcements.length} announcements`)
            setAnnouncements(data.announcements)
            setSelectedAnnouncement(data.announcements[0])
            // If company name is missing, use the announcement company as fallback
            if (!data.companyName || data.companyName === `Company ${scripCode}`) {
              const fallbackName = data.announcements[0]?.company
              if (fallbackName) {
                setCompany(prev => prev ? { ...prev, companyName: fallbackName } : prev)
              }
            }
          }
          
          // Fetch quote for the symbol
          fetchQuote(data.symbol || scripCode)
          
          // Fetch corporate actions
          fetchCorporateActions(scripCode)
        } else {
          console.error(`[Company Page] Failed to fetch: ${companyRes.status}`)
        }
      } catch (e) {
        console.error("[Company Page] Error:", e)
      } finally {
        setLoading(false)
      }
    }

    if (scripCode) {
      fetchCompanyData()
    }
  }, [scripCode])

  // Fetch corporate actions
  const fetchCorporateActions = async (code: string) => {
    try {
      const res = await fetch(`/api/bse/corporate-actions?scripCode=${code}&allowMock=false`)
      if (res.ok) {
        const data = await res.json()
        console.log(`[Company Page] Got ${data.actions?.length || 0} corporate actions`)
        setCorporateActions(data.actions || [])
      }
    } catch (e) {
      console.error("Failed to fetch corporate actions:", e)
    }
  }

  // Fetch quote
  const fetchQuote = async (symbol: string) => {
    setQuoteLoading(true)
    try {
      const res = await fetch(`/api/bse/quote?symbol=${symbol}`)
      if (res.ok) {
        const data = await res.json()
        // Transform BSE quote response to match Quote interface
        const transformedQuote = {
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          dayHigh: data.dayHigh,
          dayLow: data.dayLow,
          volume: data.volume,
          open: data.open,
          prevClose: data.previousClose,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.fiftyTwoWeekLow
        }
        setQuote(transformedQuote)
      }
    } catch (e) {
      console.error("Failed to fetch quote:", e)
    } finally {
      setQuoteLoading(false)
    }
  }

  // Format helpers
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  }

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex">
        <SidebarNav activeId="documents" />
        <div className="flex-1 ml-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400">Loading company data...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen bg-zinc-950 text-white flex overflow-hidden">
      <SidebarNav activeId="documents" />

      <div className="flex-1 ml-16 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 z-30 glass-panel border-b border-white/5">
          <div className="flex items-center justify-between h-14 px-6">
            {/* Back & Company Info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    {(company?.companyName || company?.symbol || scripCode).charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {company?.companyName || `Company ${scripCode}`}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 text-xs">
                        {company?.symbol || scripCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 text-xs">
                        BSE: {scripCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & Actions */}
            <div className="flex items-center gap-4">
              {displayPrice != null && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white tabular-nums">
                    ₹{Number(displayPrice).toLocaleString()}
                  </span>
                  {typeof quote?.changePercent === "number" && (
                    <span className={clsx(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold",
                      quote.changePercent >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {quote.changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
              {quoteLoading && <span className="text-xs text-zinc-500 animate-pulse">Loading price...</span>}

              {/* External Links */}
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.bseindia.com/stock-share-price/x/${(chartSymbol || company?.symbol || '').toLowerCase()}/${scripCode}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  title="BSE India"
                >
                  <Globe className="h-4 w-4" />
                </a>
                <a
                  href={`https://www.screener.in/company/${scripCode}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  title="Screener.in"
                >
                  <BarChart2 className="h-4 w-4" />
                </a>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Tab Bar - Only visible on mobile */}
        <div className="md:hidden flex border-b border-white/5 bg-zinc-900/80 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('announcements')}
            className={clsx(
              "flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === 'announcements'
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
                : "text-zinc-400"
            )}
          >
            <FileText className="h-4 w-4" />
            Announcements
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
              {announcements.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('corporate-actions')}
            className={clsx(
              "flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === 'corporate-actions'
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                : "text-zinc-400"
            )}
          >
            <Calendar className="h-4 w-4" />
            Actions
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
              {corporateActions.length}
            </span>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel - Announcements/Corporate Actions (Desktop only) */}
          <aside className="hidden md:flex md:w-[320px] md:min-w-[280px] border-r border-white/5 flex-col glass-panel">
            {/* Tab Buttons */}
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setActiveTab('announcements')}
                className={clsx(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
                  activeTab === 'announcements'
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                <FileText className="h-4 w-4" />
                Announcements
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                  {announcements.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('corporate-actions')}
                className={clsx(
                  "flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
                  activeTab === 'corporate-actions'
                    ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Calendar className="h-4 w-4" />
                Actions
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  {corporateActions.length}
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Announcements Tab */}
              {activeTab === 'announcements' && (
                <>
                  {announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                      <FileText className="h-12 w-12 mb-3 opacity-50" />
                      <p>No announcements found</p>
                    </div>
                  ) : (
                    announcements.map((ann, idx) => (
                      <button
                        key={ann.id}
                        onClick={() => setSelectedAnnouncement(ann)}
                        className={clsx(
                          "w-full text-left p-4 border-b border-white/5 transition-all",
                          selectedAnnouncement?.id === ann.id 
                            ? "bg-cyan-500/10 border-l-2 border-l-cyan-500" 
                            : "hover:bg-white/5",
                          idx === 0 && "bg-gradient-to-r from-amber-500/10 to-transparent border-l-2 border-l-amber-500"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-zinc-500">
                            {formatDate(ann.time)} • {formatTime(ann.time)}
                          </span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-semibold">
                              LATEST
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-2">{ann.headline}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                            {ann.category}
                          </span>
                          {ann.subCategory && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              {ann.subCategory}
                            </span>
                          )}
                          {(() => {
                            const h = (ann.headline || "").toLowerCase()
                            const tags: { key: string; label: string; cls: string }[] = []
                            const add = (key: string, label: string, cls: string) => {
                              if (!tags.find(t => t.key === key)) tags.push({ key, label, cls })
                            }
                            if (/order|directions?|penalty|fine|sebi/.test(h)) add("order", "Order", "text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold")
                            if (/appoint/.test(h)) add("appointment", "Appointment", "text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400")
                            if (/resign/.test(h)) add("resignation", "Resignation", "text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400")
                            if (/allot|preferential|warrant|qip/.test(h)) add("allotment", "Allotment", "text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400")
                            if (/dividend|bonus|split|rights?/.test(h)) add("corpaction", "Corp. Action", "text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400")
                            return tags.map(t => (
                              <span key={t.key} className={t.cls}>{t.label}</span>
                            ))
                          })()}
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}

              {/* Corporate Actions Tab */}
              {activeTab === 'corporate-actions' && (
                <>
                  {corporateActions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                      <Calendar className="h-12 w-12 mb-3 opacity-50" />
                      <p>No corporate actions found</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {/* Action Type Legend */}
                      <div className="flex flex-wrap gap-2 p-3 border-b border-white/5 mb-2">
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Dividend
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Bonus
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span> Split
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span> Rights
                        </span>
                      </div>
                      
                      {/* Actions List */}
                      {corporateActions.map((action, idx) => {
                        const purposeLower = (action.Purpose || action.purpose || '').toLowerCase()
                        const isDiv = purposeLower.includes('dividend')
                        const isBonus = purposeLower.includes('bonus')
                        const isSplit = purposeLower.includes('split')
                        const isRights = purposeLower.includes('right')
                        
                        const dotColor = isDiv ? 'bg-blue-500' : isBonus ? 'bg-emerald-500' : isSplit ? 'bg-amber-500' : isRights ? 'bg-purple-500' : 'bg-zinc-500'
                        const bgColor = isDiv ? 'bg-blue-500/5' : isBonus ? 'bg-emerald-500/5' : isSplit ? 'bg-amber-500/5' : isRights ? 'bg-purple-500/5' : 'bg-white/5'
                        
                        return (
                          <div key={idx} className={clsx("p-3 rounded-lg mb-2 border border-white/5", bgColor)}>
                            <div className="flex items-start gap-2">
                              <span className={clsx("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", dotColor)}></span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium line-clamp-2">
                                  {action.Purpose || action.purpose}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                  <div>
                                    <span className="text-zinc-500">Ex Date: </span>
                                    <span className="text-zinc-300">{action.Ex_date || action.exDate || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">Record: </span>
                                    <span className="text-zinc-300">{action.Record_date || action.recordDate || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">BC Start: </span>
                                    <span className="text-zinc-300">{action.BC_Start || action.bcStartDate || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500">BC End: </span>
                                    <span className="text-zinc-300">{action.BC_End || action.bcEndDate || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Right Panel - Content based on tab (mobile shows based on tab, desktop always shows announcement) */}
          <main className="flex-1 overflow-hidden">
            {/* Mobile: Corporate Actions View */}
            {activeTab === 'corporate-actions' && (
              <div className="md:hidden h-full overflow-y-auto scrollbar-thin p-4 pb-24 space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  Corporate Actions
                </h3>
                {corporateActions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                    <Calendar className="h-12 w-12 mb-3 opacity-50" />
                    <p>No corporate actions found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Action Type Legend */}
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Dividend
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Bonus
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> Split
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span> Rights
                      </span>
                    </div>
                    
                    {corporateActions.map((action, idx) => {
                      const purposeLower = (action.Purpose || action.purpose || '').toLowerCase()
                      const isDiv = purposeLower.includes('dividend')
                      const isBonus = purposeLower.includes('bonus')
                      const isSplit = purposeLower.includes('split')
                      const isRights = purposeLower.includes('right')
                      
                      const dotColor = isDiv ? 'bg-blue-500' : isBonus ? 'bg-emerald-500' : isSplit ? 'bg-amber-500' : isRights ? 'bg-purple-500' : 'bg-zinc-500'
                      const bgColor = isDiv ? 'bg-blue-500/5' : isBonus ? 'bg-emerald-500/5' : isSplit ? 'bg-amber-500/5' : isRights ? 'bg-purple-500/5' : 'bg-white/5'
                      
                      return (
                        <div key={idx} className={clsx("p-4 rounded-xl border border-white/5", bgColor)}>
                          <div className="flex items-start gap-3">
                            <span className={clsx("w-3 h-3 rounded-full mt-1 flex-shrink-0", dotColor)}></span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium mb-2">
                                {action.Purpose || action.purpose}
                              </p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <div>
                                  <span className="text-zinc-500">Ex Date: </span>
                                  <span className="text-zinc-300 font-medium">{action.Ex_date || action.exDate || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500">Record: </span>
                                  <span className="text-zinc-300 font-medium">{action.Record_date || action.recordDate || '-'}</span>
                                </div>
                                {(action.BC_Start || action.bcStartDate) && (
                                  <div>
                                    <span className="text-zinc-500">BC Start: </span>
                                    <span className="text-zinc-300">{action.BC_Start || action.bcStartDate}</span>
                                  </div>
                                )}
                                {(action.BC_End || action.bcEndDate) && (
                                  <div>
                                    <span className="text-zinc-500">BC End: </span>
                                    <span className="text-zinc-300">{action.BC_End || action.bcEndDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Desktop: Always show announcement detail / Mobile: Only when announcements tab active */}
            <div className={clsx(
              activeTab === 'corporate-actions' ? 'hidden md:block' : 'block',
              'h-full'
            )}>
            {selectedAnnouncement ? (
              <div className="h-full overflow-y-auto scrollbar-thin p-6 space-y-4">
                {/* Enhanced Quote Display */}
                <FeyEnhancedQuote scripCode={scripCode as string} />
                
                {/* Announcement Card - Fey-style update */}
                <div className="glass-card rounded-3xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/80 to-emerald-500/80 flex items-center justify-center text-xs font-semibold text-white">
                        {selectedAnnouncement.ticker.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-zinc-400">{selectedAnnouncement.company}</span>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-zinc-200">
                            {selectedAnnouncement.ticker}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-medium">
                            {selectedAnnouncement.category}
                            {selectedAnnouncement.subCategory && ` · ${selectedAnnouncement.subCategory}`}
                          </span>
                          {/* Keyword tags derived from headline */}
                          {(() => {
                            const h = (selectedAnnouncement.headline || "").toLowerCase()
                            const tags: { key: string; label: string; cls: string }[] = []
                            const add = (key: string, label: string, cls: string) => {
                              if (!tags.find(t => t.key === key)) tags.push({ key, label, cls })
                            }
                            if (/order|directions?|penalty|fine|sebi/.test(h)) add("order", "Order", "px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-semibold")
                            if (/appoint/.test(h)) add("appointment", "Appointment", "px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[11px]")
                            if (/resign/.test(h)) add("resignation", "Resignation", "px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[11px]")
                            if (/allot|preferential|warrant|qip/.test(h)) add("allotment", "Allotment", "px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px]")
                            if (/dividend|bonus|split|rights?/.test(h)) add("corpaction", "Corp. Action", "px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[11px]")
                            return tags.map(t => (
                              <span key={t.key} className={t.cls}>{t.label}</span>
                            ))
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-[11px] text-zinc-500">
                      <span className="font-medium">{formatDate(selectedAnnouncement.time)}</span>
                      <span>{formatTime(selectedAnnouncement.time)}</span>
                    </div>
                  </div>

                  <div className="text-sm md:text-base text-zinc-100 leading-relaxed">
                    {selectedAnnouncement.summary && selectedAnnouncement.summary !== selectedAnnouncement.headline
                      ? selectedAnnouncement.summary
                      : selectedAnnouncement.headline}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-3 md:px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-zinc-300" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {selectedAnnouncement.headline}
                        </span>
                        <span className="text-xs text-zinc-400 truncate max-w-[220px] md:max-w-[260px]">
                          {selectedAnnouncement.category}
                          {selectedAnnouncement.subCategory && ` · ${selectedAnnouncement.subCategory}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selectedAnnouncement.pdfUrl && (
                        <a
                          href={selectedAnnouncement.pdfUrl}
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
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-[11px] text-white font-medium hover:opacity-90 transition-opacity shadow-md shadow-cyan-500/25"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Analyze with Speedy AI</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span>BSE Corporate Filings</span>
                    <a
                      href={selectedAnnouncement.bseUrl || `https://www.bseindia.com/stock-share-price/x/${selectedAnnouncement.ticker.toLowerCase()}/${selectedAnnouncement.scripCode}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                    >
                      <span>View on BSE</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* AI Summary */}
                <AISummaryPanel
                  headline={selectedAnnouncement.headline}
                  summary={selectedAnnouncement.summary}
                  category={selectedAnnouncement.category}
                  subCategory={selectedAnnouncement.subCategory}
                  announcementId={selectedAnnouncement.id}
                  pdfUrl={selectedAnnouncement.pdfUrl}
                  time={selectedAnnouncement.time}
                  ticker={selectedAnnouncement.ticker}
                  company={selectedAnnouncement.company}
                  impact={selectedAnnouncement.impact}
                  onFullScreenChat={() => {
                    setOpenChatMaximized(true)
                    setShowChat(true)
                  }}
                />

                {/* Stock Chart */}
                <details open className="glass-card rounded-2xl overflow-hidden">
                  <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-cyan-400" />
                      Price Chart
                    </span>
                  </summary>
                  <div className="p-4 pt-0">
                    {/* Interactive TradingView chart (area) - use derived chartSymbol */}
                    <TradingViewChart 
                      symbol={chartSymbol}
                      exchange="BSE"
                      height={260}
                      fallbackMessage={`Chart unavailable for ${company?.companyName || 'this stock'}`}
                    />
                  </div>
                </details>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <FileText className="h-16 w-16 mb-4 opacity-30" />
                <p>Select an announcement to view details</p>
              </div>
            )}
            </div>
          </main>
        </div>
      </div>

      {/* Speedy AI Chat - Advanced PIP Mode */}
      {selectedAnnouncement && (
        <SpeedyPipChat
          announcement={selectedAnnouncement}
          isOpen={showChat}
          onClose={() => {
            setShowChat(false)
            setOpenChatMaximized(false)
          }}
          companyAnnouncements={announcements}
          initialMaximized={openChatMaximized}
        />
      )}
    </div>
  )
}
