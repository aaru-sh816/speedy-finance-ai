"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { 
  Send, Bot, User, X, FileText, Mic, MicOff, Globe, Paperclip,
  Loader2, ChevronRight, Sparkles, MessageCircle, Maximize2, Minimize2,
  ExternalLink, Clock, GripVertical, Layers, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, BarChart3, Calculator, AlertCircle, Zap,
  Target, PieChart, ArrowUpRight, ArrowDownRight, Check, Copy,
  ThumbsUp, ThumbsDown, Volume2, VolumeX, Download, Share2, Calendar,
  IndianRupee, Percent, Hash, Upload, Image as ImageIcon
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
}

interface WebSource {
  url: string
  title: string
  domain?: string
}

interface Attachment {
  name: string
  type: string
  size: number
  url?: string
  file?: File
}

import { WhaleTimeline } from "./fey/WhaleTimeline"
import { RiskRadar } from "./risk-radar"
import { FeyCard } from "./fey/FeyCard"
import { DealPerformanceTable } from "./bulk-deals/DealPerformanceTable"
import { TradingViewChart } from "./trading-view-chart"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: PdfCitation[]
  webSources?: WebSource[]
  suggestedQuestions?: string[]
  metrics?: ExtractedMetric[]
  attachments?: Attachment[]
  widgets?: any[]
  hasTable?: boolean
  hasTimeline?: boolean
  rating?: 'up' | 'down' | null
  isStreaming?: boolean
}

// Render dynamic institutional widgets based on tool outputs
function ChatWidgetRenderer({ widget }: { widget: any }) {
  const { type, data, args } = widget
  const [selectedTicker, setSelectedTicker] = useState(data?.ticker || args?.ticker)

  switch (type) {
    case "getBulkDeals":
      return (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-[10px] font-bold text-zinc-500 mb-2 px-1 uppercase tracking-widest">
            {data.isHistorical ? "Historical Whale Deals" : "Live Bulk Deals"}
          </p>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/50 backdrop-blur-sm">
            <DealPerformanceTable deals={data.deals} />
          </div>
        </div>
      )
    
    case "getWhaleTimeline":
      return (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">3Y Whale Timeline</p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Institutional Cost Basis: {data.averageCostBasis}</span>
            </div>
          </div>
          <WhaleTimeline 
            scripCode={args.scripCode} 
            deals={data.data} 
            investorName={data.investors?.[0]} 
          />
        </div>
      )
    
    case "getRiskRadar":
      return (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-[10px] font-bold text-zinc-500 mb-2 px-1 uppercase tracking-widest">Negative Clustering Alert {data.stockName ? `• ${data.stockName}` : ''}</p>
          <RiskRadar announcements={data.events} compact />
          {data.isClustered && (
            <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <p className="text-xs text-rose-300 font-medium md:text-sm">Critical Signal: Negative Clustering Detected ({data.clusterWindow})</p>
            </div>
          )}
        </div>
      )
    
      case "getWolfPackAlerts":
        return (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Wolf Pack Signals</p>
              {data.filteredBy && (
                <span className="text-[9px] font-medium text-cyan-400/70">{data.filteredBy}</span>
              )}
            </div>
            <div className="space-y-2">
              {data.activeAlerts?.map((alert: any, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-zinc-900/80 border border-cyan-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white md:text-base">{alert.stockName || alert.company}</p>
                    <p className="text-xs text-zinc-500 md:text-sm">{(alert.involvedInvestors || alert.investors || []).join(' + ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30">
                    <Zap className="h-3 w-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">Tier-1</span>
                  </div>
                </div>
              ))}
              {(!data.activeAlerts || data.activeAlerts.length === 0) && (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 text-center">
                  <p className="text-xs text-zinc-500">No active Wolf Pack signals detected for this stock in recent 30 days.</p>
                </div>
              )}
            </div>
          </div>
        )

        case "getStockQuote":
          const isUp = (data.change || 0) >= 0
          return (
            <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-[10px] font-bold text-zinc-500 mb-2 px-1 uppercase tracking-widest">Live Quote Signal</p>
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white md:text-xl">{data.stockName}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Updated: {new Date(data.updatedAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black md:text-3xl ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{data.ltp?.toLocaleString()}
                    </div>
                      <div className={`text-xs font-bold md:text-sm ${isUp ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                        {isUp ? '+' : ''}{Number(data.change || 0).toFixed(2)} ({Number(data.pChange || 0).toFixed(2)}%)
                      </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Day High/Low</p>
                    <p className="text-sm font-medium text-zinc-200">₹{data.dayHigh} / ₹{data.dayLow}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Volume</p>
                    <p className="text-sm font-medium text-zinc-200">{data.volume?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )

        case "stockIntelligence": {
          const { quote, news, whale, ticker } = data;
          return (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-2 px-1">
                <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">Stacked Intelligence Dashboard</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left: Price & Chart (Span 7) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl group">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-black text-white">{quote.stockName}</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">{ticker} • LIVE BSE</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-black ${(quote.change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{quote.ltp?.toLocaleString()}
                        </div>
                          <div className={`text-xs font-bold opacity-80 ${(quote.change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(quote.change || 0) >= 0 ? '+' : ''}{Number(quote.change || 0).toFixed(2)} ({Number(quote.pChange || 0).toFixed(2)}%)
                          </div>
                      </div>
                    </div>
                    
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-black/20">
                      <TradingViewChart 
                        symbol={selectedTicker} 
                        height={240} 
                        theme="dark"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
                      <div>
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">High</p>
                        <p className="text-xs font-bold text-zinc-200">₹{quote.dayHigh}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Low</p>
                        <p className="text-xs font-bold text-zinc-200">₹{quote.dayLow}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Vol</p>
                        <p className="text-xs font-bold text-zinc-200">{quote.volume?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Insights (Span 5) */}
                <div className="md:col-span-5 space-y-4">
                  {/* Top Right: Recent News/Risk Radar */}
                  <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Recent Activity</p>
                      <Zap className="h-3 w-3 text-amber-500" />
                    </div>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-hide">
                      {news.events?.length > 0 ? (
                        news.events.map((event: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            <p className="text-[11px] font-bold text-zinc-300 line-clamp-2 leading-tight mb-1">{event.headline}</p>
                            <p className="text-[9px] text-zinc-600 font-medium">{event.time}</p>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">No Critical Alerts</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Right: Whale Logic */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Whale Logic</p>
                      <Layers className="h-3 w-3 text-indigo-400" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-medium">Cost Basis</span>
                        <span className="text-xs font-black text-white">{whale.averageCostBasis}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-medium">Entry Era</span>
                        <span className="text-xs font-black text-emerald-400">Golden Zone</span>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[10px] text-zinc-400 leading-relaxed font-medium italic">
                          "{whale.investors?.[0]}'s first entry at {whale.averageCostBasis} establishes a strong historical floor for current cycles."
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Institutional Deal Flow (Shared Context) */}
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 delay-300 duration-500">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Institutional Deal Flow • Click to update chart</p>
                  <span className="text-[10px] font-bold text-cyan-400/50">3Y History</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-950/50 backdrop-blur-sm">
                  <DealPerformanceTable 
                    deals={whale.data?.slice(0, 5) || []} 
                    onSelectDeal={(deal) => {
                      if (deal.scripCode) setSelectedTicker(deal.scripCode)
                    }}
                  />
                </div>
              </div>
            </div>
          )
        }


    default:
      return null
  }
}

interface ExtractedMetric {
  label: string
  value: string
  change?: number
  type: "currency" | "percentage" | "number" | "date"
}

interface SpeedyPipChatProps {
  announcement: BSEAnnouncement
  isOpen: boolean
  onClose: () => void
  companyAnnouncements?: BSEAnnouncement[]
  preSelectedDocIds?: string[] // IDs pre-selected from Recent Announcements section
  initialMaximized?: boolean // Open directly in full-screen mode
}

const KEYWORD_TAGS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  dividend: { label: "Dividend", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  bonus: { label: "Bonus", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  split: { label: "Split", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  acquisition: { label: "Acquisition", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  merger: { label: "Merger", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  buyback: { label: "Buyback", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  "rights issue": { label: "Rights Issue", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  qip: { label: "QIP", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  fpo: { label: "FPO", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  penalty: { label: "Penalty", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  order: { label: "Order", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  sebi: { label: "SEBI", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" }
}

type KeywordTagConfig = (typeof KEYWORD_TAGS)[string]

function getKeywordTags(content: string): { key: string; config: KeywordTagConfig }[] {
  const lower = content.toLowerCase()
  const tags: { key: string; config: KeywordTagConfig }[] = []

  for (const [key, config] of Object.entries(KEYWORD_TAGS)) {
    if (lower.includes(key)) {
      tags.push({ key, config })
    }
  }

  return tags
}

// Render markdown content with Grok-style formatting
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false
  let listItems: string[] = []
  let inList = false
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm md:text-base text-zinc-300 leading-relaxed">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>{highlightFinancialData(item)}</span>
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
    inList = false
  }
  
  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0]
      const dataRows = tableRows.slice(1).filter(row => !row.every(cell => /^[-:]+$/.test(cell.trim())))
      
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-white/5">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-white/10">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-300">
                      {highlightFinancialData(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
    }
    inTable = false
  }
  
  // Highlight financial data (₹, %, dates)
  const highlightFinancialData = (text: string): React.ReactNode => {
    // Match currency, percentages, and dates
    const parts = text.split(/(₹[\d,]+(?:\.\d+)?(?:\s*(?:Cr|Crore|Lakh|L|K|M|B))?|[\d.]+%|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi)
    
    return parts.map((part, i) => {
      if (/^₹/.test(part)) {
        return <span key={i} className="text-emerald-400 font-semibold">{part}</span>
      }
      if (/\d+%/.test(part)) {
        const isNegative = part.includes('-')
        return <span key={i} className={`font-semibold ${isNegative ? 'text-rose-400' : 'text-cyan-400'}`}>{part}</span>
      }
      if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(part)) {
        return <span key={i} className="text-purple-400">{part}</span>
      }
      // Bold text
      if (part.includes('**')) {
        return part.split('**').map((p, j) => 
          j % 2 === 1 ? <strong key={`${i}-${j}`} className="text-white">{p}</strong> : p
        )
      }
      return part
    })
  }
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    
    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        flushList()
        inTable = true
      }
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
      tableRows.push(cells)
      return
    } else if (inTable) {
      flushTable()
    }
    
    // List item
    if (/^[-•*]\s/.test(trimmed)) {
      if (!inList) inList = true
      listItems.push(trimmed.replace(/^[-•*]\s/, ''))
      return
    } else if (inList) {
      flushList()
    }
    
    // Section header ### 
    if (trimmed.startsWith('### ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2 pb-1 border-b border-white/10">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500" />
          <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wide">{trimmed.slice(4)}</h3>
        </div>
      )
      return
    }
    
    // Subheader ##
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-sm md:text-base font-bold text-cyan-400 mt-4 mb-1">{trimmed.slice(3)}</h2>
      )
      return
    }
    
    // Header #
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="text-base md:text-lg font-bold text-white mt-3 mb-1">{trimmed.slice(2)}</h1>
      )
      return
    }
    
    // Horizontal rule
    if (/^[-]{3,}$/.test(trimmed)) {
      elements.push(<hr key={idx} className="my-2 border-white/10" />)
      return
    }
    
    // Empty line
    if (!trimmed) {
      elements.push(<div key={idx} className="h-1" />)
      return
    }
    
    // Paragraph with refined typography
    elements.push(
      <p key={idx} className="text-sm md:text-base text-zinc-200 leading-relaxed font-sans tracking-tight">
        {highlightFinancialData(trimmed)}
      </p>
    )
  })
  
  // Flush remaining
  flushList()
  flushTable()
  
  return <div className="space-y-1.5">{elements}</div>
}

// Generate context-aware follow-up questions
function generateFollowUps(response: string, asked: string[], ticker?: string): string[] {
  const questions: string[] = []
  const lower = response.toLowerCase()
  
  if (ticker && !asked.includes(`${ticker}?`)) {
    questions.push(`${ticker}?`)
  }
  
  if (lower.includes("wolf pack")) {
    questions.push("Who are the whales?", "Past performance?")
  }
  if (lower.includes("whale") || lower.includes("institutional")) {
    questions.push("Buy/Sell trend?", "Average cost?")
  }
  if (lower.includes("risk") || lower.includes("negative")) {
    questions.push("Is it a Sell?", "Mitigation?")
  }
  if (lower.includes("mw") || lower.includes("capacity")) {
    questions.push("Timeline?", "Investment?")
  }
  if (lower.includes("crore") || lower.includes("revenue") || lower.includes("earnings")) {
    questions.push("YoY growth?", "Margins?", "Next quarter?")
  }
  if (lower.includes("board") || lower.includes("approved")) {
    questions.push("Next steps?", "Effective date?")
  }
  if (lower.includes("dividend")) questions.push("Record date?", "Yield?")
  if (lower.includes("acquisition") || lower.includes("buyback")) questions.push("Deal value?", "Premium?")
  
    // High-intelligence defaults based on general context
    if (questions.length < 3) {
      const defaults = ["Latest LTP?", "Who are the whales?", "Bull case?", "Bear case?", "Summary?"]
      for (const d of defaults) {
        if (questions.length >= 4) break
        if (!questions.includes(d)) questions.push(d)
      }
    }

  
  return questions.filter(q => !asked.includes(q)).slice(0, 4)
}

export function SpeedyPipChat({ announcement: initialAnnouncement, isOpen, onClose, companyAnnouncements = [], preSelectedDocIds = [], initialMaximized = false }: SpeedyPipChatProps) {
  // State
  const [activeAnnouncement, setActiveAnnouncement] = useState(initialAnnouncement)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [asked, setAsked] = useState<string[]>([])
  const [showDocs, setShowDocs] = useState(false)
  const [multiDocMode, setMultiDocMode] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMaximized, setIsMaximized] = useState(initialMaximized)
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false)
  
  // PIP State
  const [isExpanded, setIsExpanded] = useState(initialMaximized || false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  
  // Refs
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  
  const storageKey = `speedy-chat-${initialAnnouncement.scripCode}`

  // Stabilize preSelectedDocIds to prevent infinite loops
  const preSelectedDocIdsKey = JSON.stringify(preSelectedDocIds)

  // Same company announcements - get ALL of them
  const sameCompanyAnnouncements = companyAnnouncements.filter(
    a => a.scripCode === activeAnnouncement.scripCode && a.id !== activeAnnouncement.id
  )

  // We do not persist chat history across sessions anymore to keep each stock/session fresh
  useEffect(() => {
    setHasHydratedHistory(true)
  }, [])

  // Update state when initialMaximized or isOpen changes
  useEffect(() => {
    if (isOpen && initialMaximized) {
      setIsMaximized(true)
      setIsExpanded(true)
    }
  }, [isOpen, initialMaximized])

  // Update when initial changes or pre-selected docs change
  useEffect(() => {
    setActiveAnnouncement(initialAnnouncement)
    // Reset all chat state when announcement changes
    setMessages([])
    setInput("")
    setAsked([])
    setAttachments([])
    setMultiDocMode(false)
    setShowDocs(false)
    setWebSearch(false)
    
    // If pre-selected docs provided, use them; otherwise just the current one
    if (preSelectedDocIds.length > 0) {
      setSelectedDocs(preSelectedDocIds)
      setMultiDocMode(true)
      setShowDocs(true)
      setIsExpanded(true)
    } else {
      setSelectedDocs([initialAnnouncement.id])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnnouncement.id, preSelectedDocIdsKey])

  // Init chat - only trigger when opening and no existing history
  useEffect(() => {
    if (!isOpen || !activeAnnouncement) return
    if (!hasHydratedHistory) return
    if (messages.length > 0) return

    const docsCount = selectedDocs.length
    const welcomeMsg = multiDocMode && docsCount > 1
      ? `Analyzing **${docsCount} documents** from ${activeAnnouncement.company}`
      : `Analyzing **${activeAnnouncement.company}**\n\n${activeAnnouncement.headline.slice(0, 60)}...`
    
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: welcomeMsg,
      timestamp: new Date(),
      suggestedQuestions: ["Key numbers?", "Important dates?", "Summary?"]
    }])
    setAsked([])
  }, [isOpen, activeAnnouncement?.id, hasHydratedHistory, messages.length, multiDocMode, selectedDocs.length])

  // Scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus
  useEffect(() => {
    if (isOpen && isExpanded) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen, isExpanded])

  // Keyboard shortcuts - use ref to avoid onClose dependency
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        if (isMaximized) {
          setIsMaximized(false)
        } else {
          onCloseRef.current()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isMaximized])

  // Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        dragOffset.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      }
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = window.innerWidth - e.clientX - (containerRef.current?.offsetWidth || 0) + dragOffset.current.x
      const newY = window.innerHeight - e.clientY - (containerRef.current?.offsetHeight || 0) + dragOffset.current.y
      setPosition({
        x: Math.max(10, Math.min(newX, window.innerWidth - 100)),
        y: Math.max(10, Math.min(newY, window.innerHeight - 100))
      })
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Switch announcement
  const switchAnnouncement = (ann: BSEAnnouncement) => {
    // When switching to another stock/announcement, start with a clean chat
    setActiveAnnouncement(ann)
    setMultiDocMode(false)
    setSelectedDocs([ann.id])
    setMessages([])
    setShowDocs(false)
  }

  // Toggle document selection for multi-doc mode
  const toggleDocSelection = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    )
  }

  // Enable multi-doc mode - select ALL documents
  const enableMultiDocMode = () => {
    const allDocIds = [activeAnnouncement.id, ...sameCompanyAnnouncements.map(a => a.id)]
    setMultiDocMode(true)
    setSelectedDocs(allDocIds)
    setMessages([{
      id: "multi-" + Date.now(),
      role: "assistant",
      content: `🔗 **Multi-Document Mode**\n\nAnalyzing **${allDocIds.length} announcements** from **${activeAnnouncement.company}**.\n\nI can now compare, find patterns, and answer questions across all selected documents.`,
      timestamp: new Date(),
      suggestedQuestions: ["Compare all?", "Find patterns?", "Timeline of events?"]
    }])
    setShowDocs(true) // Keep docs panel open to show all selected
  }

  // Voice recording
  const toggleVoice = async () => {
    if (isRecording) {
      recorderRef.current?.stop()
      setIsRecording(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" })
          const fd = new FormData()
          fd.append("audio", blob)
          fd.append("action", "transcribe")
          try {
            const res = await fetch("/api/ai/voice", { method: "POST", body: fd })
            if (res.ok) {
              const { text } = await res.json()
              if (text) setInput(text)
            }
          } catch (e) { console.error(e) }
          stream.getTracks().forEach(t => t.stop())
        }
        recorder.start()
        setIsRecording(true)
      } catch (e) { console.error(e) }
    }
  }

  // Append assistant message in one shot (no typewriter effect)
  const appendAssistantMessage = (
    fullText: string,
    meta: Omit<ChatMessage, "id" | "role" | "content" | "timestamp">
  ) => {
    const id = (Date.now() + Math.random()).toString()
    const timestamp = new Date()

    setMessages(prev => [
      ...prev,
      {
        id,
        role: "assistant",
        content: fullText,
        timestamp,
        rating: null,
        isStreaming: false,
        ...meta
      }
    ])
  }

  // Send message
  const send = async (custom?: string) => {
    const msg = custom || input.trim()
    if (!msg || isLoading) return

    setAsked(prev => [...prev, msg])
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    }])
    setInput("")
    setAttachments([])
    setIsLoading(true)

    let webSources: WebSource[] = []
    
    try {
      let extra = ""
      if (webSearch) {
        try {
          const sr = await fetch("/api/ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: msg, company: activeAnnouncement.company, ticker: activeAnnouncement.ticker })
          })
          if (sr.ok) {
            const d = await sr.json()
            if (d.content) extra = `\n\nWeb: ${d.content}`
            // Extract web citations
            if (d.citations && Array.isArray(d.citations)) {
              webSources = d.citations.map((c: any) => ({
                url: c.url,
                title: c.title || new URL(c.url).hostname,
                domain: new URL(c.url).hostname.replace('www.', '')
              }))
            }
          }
        } catch (e) {}
      }

      // Build context message for multi-doc mode
      let contextMsg = msg + extra
      if (multiDocMode && selectedDocs.length > 1) {
        const selectedAnns = [activeAnnouncement, ...sameCompanyAnnouncements].filter(a => selectedDocs.includes(a.id))
        contextMsg = `[Multi-document query across ${selectedDocs.length} announcements]\n\n${msg}${extra}`
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextMsg,
          announcement: {
            id: activeAnnouncement.id,
            company: activeAnnouncement.company,
            ticker: activeAnnouncement.ticker,
            scripCode: activeAnnouncement.scripCode,
            headline: activeAnnouncement.headline,
            summary: activeAnnouncement.summary,
            category: activeAnnouncement.category,
            subCategory: activeAnnouncement.subCategory,
            time: activeAnnouncement.time,
            impact: activeAnnouncement.impact,
            pdfUrl: activeAnnouncement.pdfUrl
          },
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          includePdfAnalysis: true,
          multiDocMode: multiDocMode,
          selectedDocIds: selectedDocs,
        })
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.response || "Could not generate response."
        const followUps = generateFollowUps(text, asked, activeAnnouncement.ticker)
        const metrics = extractMetrics(text)
        const { hasTable, hasTimeline } = detectContentType(text)

          appendAssistantMessage(text, {
            citations: data.citations,
            webSources: webSources.length > 0 ? webSources : undefined,
            suggestedQuestions: followUps,
            metrics: metrics.length > 0 ? metrics : undefined,
            widgets: data.widgets,
            hasTable,
            hasTimeline
          })

      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Error. Please try again.",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments = files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      file: f
    }))
    setAttachments(prev => [...prev, ...newAttachments])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Text-to-speech using High-Fidelity Voice Alpha (OpenAI TTS-1)
  const speakMessage = async (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel() // Stop browser synth if running
      // Also stop HTML audio if running
      const audios = document.querySelectorAll('audio.voice-alpha-player')
      audios.forEach((a: any) => { a.pause(); a.remove() })
      setIsSpeaking(false)
      return
    }

    try {
      setIsSpeaking(true)
      
      const fd = new FormData()
      fd.append("action", "speak")
      fd.append("text", text)
      fd.append("voice", "nova") // High-fidelity professional voice
      
      const res = await fetch("/api/ai/voice", { method: "POST", body: fd })
      if (!res.ok) throw new Error("TTS failed")
      
      const { audio, format } = await res.json()
      const audioUrl = `data:audio/${format};base64,${audio}`
      
      const player = new Audio(audioUrl)
      player.className = 'voice-alpha-player'
      player.onended = () => setIsSpeaking(false)
      player.play()
    } catch (e) {
      console.error("Voice Alpha failed, falling back to browser:", e)
      // Fallback
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utterance)
      } else {
        setIsSpeaking(false)
      }
    }
  }

  // Detect content type for smart formatting
  const detectContentType = (content: string) => {
    const hasTable = /\|.*\|.*\|/.test(content) || /(timeline|schedule|dates|quarter)/i.test(content)
    const hasTimeline = /(timeline|roadmap|schedule|phases|milestones)/i.test(content)
    return { hasTable, hasTimeline }
  }

  // Extract metrics from response
  const extractMetrics = (content: string): ExtractedMetric[] => {
    const metrics: ExtractedMetric[] = []
    
    // Currency (₹ or Cr or crore)
    const currencyMatches = content.match(/₹?\s*([\d,]+(?:\.\d+)?)\s*(Cr|crore|crores)/gi)
    if (currencyMatches) {
      currencyMatches.slice(0, 4).forEach(match => {
        const value = match.match(/([\d,]+(?:\.\d+)?)/)?.[0] || ''
        metrics.push({ label: 'Amount', value: `₹${value} Cr`, type: 'currency' })
      })
    }
    
    // Percentages
    const percentMatches = content.match(/([\d.]+)%/g)
    if (percentMatches) {
      percentMatches.slice(0, 3).forEach(match => {
        metrics.push({ label: 'Change', value: match, type: 'percentage' })
      })
    }
    
    // Dates
    const dateMatches = content.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi)
    if (dateMatches) {
      dateMatches.slice(0, 2).forEach(match => {
        metrics.push({ label: 'Date', value: match, type: 'date' })
      })
    }
    
    return metrics
  }

  // Copy message
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleRateMessage = (id: string, rating: 'up' | 'down') => {
    setMessages(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, rating: m.rating === rating ? null : rating }
          : m
      )
    )
  }

  // Export chat
  const exportChat = () => {
    const chatText = messages.map(m => 
      `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
    ).join('\n\n')
    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${activeAnnouncement.ticker}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  // Compact PIP mode
  if (!isExpanded) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 cursor-pointer group"
        style={{ right: position.x, bottom: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div 
          onClick={() => setIsExpanded(true)}
          className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-110 transition-all flex items-center justify-center"
        >
          {/* Animated ring */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 opacity-50 animate-ping" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600" />
          
          {/* Icon */}
          <Sparkles className="relative h-6 w-6 text-white" />
          
          {/* Badge */}
          {messages.length > 1 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
              {messages.length - 1}
            </span>
          )}
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {activeAnnouncement.ticker} • Click to expand
        </div>
      </div>
    )
  }

  // Expanded chat mode
  return (
    <div
      ref={containerRef}
      className={`fixed z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden transition-all ${
        isMaximized ? 'rounded-none' : 'rounded-2xl'
      }`}
      style={isMaximized ? {
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999
      } : { 
        right: position.x, 
        bottom: position.y,
        width: 'min(500px, 95vw)',
        height: 'min(700px, 85vh)',
        maxHeight: '800px',
        zIndex: 9999
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with drag handle */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div className="drag-handle cursor-move p-1 rounded hover:bg-white/5">
            <GripVertical className="h-4 w-4 text-zinc-500" />
          </div>
          
          {/* Orb Avatar */}
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 opacity-40 blur-md animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {multiDocMode ? `${selectedDocs.length} Docs` : activeAnnouncement.ticker}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">{activeAnnouncement.company}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          {/* Export */}
          <button
            onClick={exportChat}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
            title="Export chat"
          >
            <Download className="h-4 w-4" />
          </button>
          
          {/* Web Search */}
          <button
            onClick={() => setWebSearch(!webSearch)}
            className={`p-1.5 rounded-lg transition-colors ${webSearch ? "text-cyan-400 bg-cyan-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
            title="Web search"
          >
            <Globe className="h-4 w-4" />
          </button>
          
          {/* Maximize/Restore */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          
          {/* Minimize to PIP */}
          {!isMaximized && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          
          {/* Close */}
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Documents Panel */}
      <div className="border-b border-white/5">
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {sameCompanyAnnouncements.length + 1} documents available
            {multiDocMode && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">MULTI</span>}
          </span>
          {showDocs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        
        {showDocs && (
          <div className="px-2 pb-2 space-y-1 max-h-52 overflow-y-auto">
            {/* Multi-doc mode button */}
            {!multiDocMode && (
              <button
                onClick={enableMultiDocMode}
                className="w-full p-2.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 hover:border-cyan-500/40 text-left transition-all"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <div>
                    <p className="text-xs font-medium text-cyan-400">Chat with ALL {sameCompanyAnnouncements.length + 1} documents</p>
                    <p className="text-[10px] text-zinc-500">Compare & analyze across all announcements</p>
                  </div>
                </div>
              </button>
            )}
            
            {/* Multi-doc mode header */}
            {multiDocMode && (
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-1">
                <p className="text-xs font-medium text-purple-400">
                  ✓ {selectedDocs.length} of {sameCompanyAnnouncements.length + 1} documents selected
                </p>
                <p className="text-[10px] text-zinc-500">Click to toggle selection</p>
              </div>
            )}
            
            {/* Current document - always first */}
            <button
              onClick={() => multiDocMode && toggleDocSelection(activeAnnouncement.id)}
              className={`w-full p-2.5 rounded-lg text-left transition-all ${
                selectedDocs.includes(activeAnnouncement.id)
                  ? "bg-cyan-500/10 border border-cyan-500/30"
                  : "bg-white/5 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                {multiDocMode && (
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedDocs.includes(activeAnnouncement.id) ? "bg-cyan-500 border-cyan-500" : "border-zinc-600"
                  }`}>
                    {selectedDocs.includes(activeAnnouncement.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-cyan-300 truncate">{activeAnnouncement.headline.slice(0, 50)}...</p>
                  <p className="text-[10px] text-cyan-500">Current • {activeAnnouncement.category}</p>
                </div>
              </div>
            </button>
            
            {/* Other documents */}
            {sameCompanyAnnouncements.map((a, index) => (
              <button
                key={a.id}
                onClick={() => multiDocMode ? toggleDocSelection(a.id) : switchAnnouncement(a)}
                className={`w-full p-2.5 rounded-lg text-left transition-all ${
                  selectedDocs.includes(a.id)
                    ? "bg-purple-500/10 border border-purple-500/30"
                    : "bg-white/5 hover:bg-white/10 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  {multiDocMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedDocs.includes(a.id) ? "bg-purple-500 border-purple-500" : "border-zinc-600"
                    }`}>
                      {selectedDocs.includes(a.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{a.headline.slice(0, 50)}...</p>
                    <p className="text-[10px] text-zinc-600">#{index + 2} • {a.category}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-cyan-500 to-blue-600"
            }`}>
              {m.role === "user" ? <User className="h-4 w-4 text-zinc-400" /> : <Bot className="h-4 w-4 text-white" />}
            </div>

            <div className={`max-w-[92%] ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`group relative rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-white/10" : "bg-white/5 border border-white/5"}`}>
                {/* Use markdown renderer for assistant, simple text for user */}
                {m.role === "assistant" ? (
                  renderMarkdown(m.content)
                ) : (
                  <p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>
                )}
                
                  {/* Copy button */}
                  {m.role === "assistant" && (
                    <button 
                      onClick={() => copyMessage(m.content)}
                      className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                  )}
                </div>

                {/* Render Widgets */}
                {m.widgets && m.widgets.map((widget, idx) => (
                  <ChatWidgetRenderer key={idx} widget={widget} />
                ))}


              {/* PDF Citations - Enhanced Display */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <span className="text-xs font-medium text-cyan-400">📄 Sources from PDF</span>
                  </div>
                  <div className="grid gap-2">
                    {m.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-cyan-400">P{c.page}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-normal">{c.snippet || `Content from page ${c.page}`}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Sources - Enhanced Display */}
              {m.webSources && m.webSources.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Globe className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-purple-400">🌐 Web Sources</span>
                    <span className="text-[10px] text-zinc-600">({m.webSources.length})</span>
                  </div>
                  <div className="grid gap-2">
                    {m.webSources.slice(0, 5).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-purple-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-purple-300 truncate font-medium">{s.title}</p>
                          <p className="text-[10px] text-zinc-600 truncate">{s.domain}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Metrics Cards */}
              {m.role === "assistant" && m.metrics && m.metrics.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {m.metrics.map((metric, i) => (
                    <div key={i} className="p-3 rounded-lg bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {metric.type === 'currency' && <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />}
                        {metric.type === 'percentage' && <Percent className="h-3.5 w-3.5 text-cyan-400" />}
                        {metric.type === 'date' && <Calendar className="h-3.5 w-3.5 text-purple-400" />}
                        {metric.type === 'number' && <Hash className="h-3.5 w-3.5 text-blue-400" />}
                        <span className="text-[10px] text-zinc-500">{metric.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{metric.value}</p>
                      {metric.change !== undefined && (
                        <div className={`flex items-center gap-0.5 mt-1 text-[10px] ${
                          metric.change > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {metric.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(metric.change)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Keyword Tags */}
              {m.role === "assistant" && getKeywordTags(m.content).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {getKeywordTags(m.content).map(({ key, config }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${config.bg} ${config.border} ${config.color}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{config.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* User Attachments */}
              {m.role === "user" && m.attachments && m.attachments.length > 0 && (
                <div className="mt-2.5 flex gap-2 flex-wrap">
                  {m.attachments.map((att, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[10px] text-zinc-300">
                      {att.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="truncate max-w-[120px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* TTS Button for Assistant Messages */}
              {m.role === "assistant" && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => speakMessage(m.content)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                      isSpeaking ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                    title={isSpeaking ? "Stop speaking" : "Listen to response"}
                  >
                    {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {isSpeaking ? 'Speaking...' : 'Listen to Pip'}
                  </button>
                </div>
              )}

              {/* Message Rating */}
              {m.role === "assistant" && !m.isStreaming && (
                <div className="mt-2.5 flex items-center gap-2.5 text-xs text-zinc-500 px-1">
                  <span>Was this helpful?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRateMessage(m.id, 'up')}
                      className={`p-1.5 rounded-full border flex items-center justify-center transition-all ${
                        m.rating === 'up'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                          : 'border-transparent hover:bg-white/5 hover:text-emerald-300'
                      }`}
                      title="Helpful"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRateMessage(m.id, 'down')}
                      className={`p-1.5 rounded-full border flex items-center justify-center transition-all ${
                        m.rating === 'down'
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                          : 'border-transparent hover:bg-white/5 hover:text-rose-300'
                      }`}
                      title="Not helpful"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Follow-up Questions */}
              {m.role === "assistant" && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {m.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(q)}
                      disabled={isLoading}
                      className="group/btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                    >
                      <ChevronRight className="h-3 w-3 text-cyan-500 opacity-0 group-hover/btn:opacity-100 -ml-1 transition-all" />
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2.5 border-t border-white/5 flex gap-2.5 overflow-x-auto bg-zinc-900/40">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
              {att.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 text-cyan-400" /> : <FileText className="h-3.5 w-3.5 text-cyan-400" />}
              <span className="text-[11px] text-cyan-300 max-w-[100px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-zinc-500 hover:text-white ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/60 sticky bottom-0">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950 border border-white/10 focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all shadow-inner">
          {/* File Attach Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-cyan-400 hover:bg-white/5 transition-all"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask SpeedyPip anything..."
            className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm md:text-base placeholder:text-zinc-600 outline-none"
            disabled={isLoading}
          />
          
          <button
            onClick={toggleVoice}
            className={`p-2.5 rounded-xl transition-all ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          
          <button
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-20 hover:shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        
        {/* Status */}
        <div className="flex items-center justify-center gap-3 mt-2.5">
          {webSearch && (
            <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-medium bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <Globe className="h-3 w-3" /> Web Intelligence Active
            </span>
          )}
          {multiDocMode && (
            <span className="text-[10px] text-purple-400 flex items-center gap-1 font-medium bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              <Layers className="h-3 w-3" /> {selectedDocs.length} Docs Indexed
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
