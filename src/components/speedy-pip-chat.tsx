"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { 
  Send, Bot, User, X, FileText, Mic, MicOff, Globe, Paperclip,
  Loader2, ChevronRight, Sparkles, MessageCircle, Maximize2, Minimize2,
  ExternalLink, Clock, GripVertical, Layers, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, BarChart3, Calculator, AlertCircle, Zap,
  Target, PieChart, ArrowUpRight, ArrowDownRight, Check, Copy,
  ThumbsUp, ThumbsDown, Volume2, VolumeX, Download, Share2, Calendar,
  IndianRupee, Percent, Hash, Upload, Image as ImageIcon, Activity
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
  docId?: string
  headline?: string
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
import { CitationCard } from "./citation-popover"

function EventSparkline({ data, eventIndex }: { data: { date: string; close: number; isEvent?: boolean }[]; eventIndex?: number }) {
  if (!data || data.length < 2) return null
  
  const minVal = Math.min(...data.map(d => d.close))
  const maxVal = Math.max(...data.map(d => d.close))
  const range = maxVal - minVal || 1
  const width = 140
  const height = 32
  const padding = 2
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.close - minVal) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  
  const eventIdx = data.findIndex(d => d.isEvent)
  const eventX = eventIdx >= 0 ? padding + (eventIdx / (data.length - 1)) * (width - padding * 2) : null
  
  const firstPrice = data[0]?.close || 0
  const lastPrice = data[data.length - 1]?.close || 0
  const isPositive = lastPrice >= firstPrice
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="url(#sparkGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {eventX && (
        <>
          <line x1={eventX} y1="0" x2={eventX} y2={height} stroke="#06b6d4" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
          <circle cx={eventX} cy={height - padding - ((data[eventIdx].close - minVal) / range) * (height - padding * 2)} r="3" fill="#06b6d4" />
        </>
      )}
    </svg>
  )
}

function HistoricalReactionCard({ data }: { data: any }) {
  if (!data || data.analyzedEvents === 0) return null
  
  const sentiment = data.sentiment || "Neutral"
  const sentimentColor = sentiment === "Bullish" ? "emerald" : sentiment === "Bearish" ? "rose" : "zinc"
  
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em]">Historical Reaction Analysis</p>
      </div>
      
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{data.category} Events</h3>
              <p className="text-[10px] text-zinc-500">{data.analyzedEvents} of {data.totalEvents} events analyzed</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg bg-${sentimentColor}-500/20 border border-${sentimentColor}-500/30`}>
              <span className={`text-xs font-black text-${sentimentColor}-400 uppercase tracking-wider`}>{sentiment}</span>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">T+1</p>
              <p className={`text-sm font-black ${parseFloat(data.avgReactionT1) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.avgReactionT1}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">T+5</p>
              <p className={`text-sm font-black ${parseFloat(data.avgReactionT5) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.avgReactionT5}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">T+10</p>
              <p className={`text-sm font-black ${parseFloat(data.avgReactionT10) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.avgReactionT10}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-[9px] text-cyan-400 uppercase font-bold">Win Rate</p>
              <p className="text-sm font-black text-cyan-400">{data.positiveReactionRate}</p>
            </div>
          </div>
          
          {data.reactions && data.reactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Past Events</p>
              {data.reactions.slice(0, 3).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <EventSparkline data={r.sparklineData} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-300 truncate">{r.headline}</p>
                      <p className="text-[9px] text-zinc-600">{r.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.changeT5 && (
                      <span className={`text-xs font-bold ${parseFloat(r.changeT5) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {parseFloat(r.changeT5) > 0 ? '+' : ''}{r.changeT5}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
            <p className="text-[11px] text-zinc-300 leading-relaxed italic">"{data.insight}"</p>
          </div>
        </div>
      </div>
    </div>
  )
}

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
    case "getHistoricalReaction":
      return <HistoricalReactionCard data={data} />

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

        case "compareQuarterlyResults":
          return (
            <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Quarterly Comparison</p>
                <span className="text-[10px] font-bold text-purple-400">{data.count} quarters</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-zinc-900/50">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white">{data.stockName} - Results Timeline</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{data.message}</p>
                </div>
                <div className="divide-y divide-white/5">
                  {data.quarters?.map((q: any, i: number) => (
                    <div key={i} className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-purple-400">{q.quarter}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">{q.headline?.slice(0, 50)}...</p>
                          <p className="text-[10px] text-zinc-500">{new Date(q.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      {q.pdfUrl && (
                        <a 
                          href={q.pdfUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-medium hover:bg-purple-500/30 transition-colors"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {data.quarters?.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-zinc-500">No quarterly results found for this company.</p>
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

// Generate highly context-aware follow-up questions based on actual content
function generateFollowUps(response: string, asked: string[], ticker?: string): string[] {
  const questions: string[] = []
  const lower = response.toLowerCase()
  const alreadyAsked = new Set(asked.map(a => a.toLowerCase()))
  
  const addQ = (q: string) => {
    if (!alreadyAsked.has(q.toLowerCase()) && !questions.includes(q)) {
      questions.push(q)
    }
  }
  
  // CRISIS / INCIDENT / EMERGENCY (fire, accident, disaster, remand, arrest)
  if (/fire|accident|disaster|explosion|remand|arrest|custody|investigation|incident|safety|audit/i.test(lower)) {
    addQ("Insurance coverage?")
    addQ("Production impact?")
    addQ("Recovery timeline?")
    addQ("Legal liability?")
    return questions.slice(0, 4)
  }
  
  // LEADERSHIP CHANGE (CEO, MD, interim, appointed, resigned)
  if (/ceo|managing director|interim|appointed|resigned|leadership|succession|deputy/i.test(lower)) {
    addQ("Succession plan?")
    addQ("Continuity measures?")
    addQ("Market reaction?")
    addQ("Historical precedent?")
    return questions.slice(0, 4)
  }
  
  // LEGAL / REGULATORY (SEBI, penalty, compliance, NCLT, court, litigation)
  if (/sebi|penalty|compliance|nclt|court|litigation|regulatory|violation|notice|show cause/i.test(lower)) {
    addQ("Financial penalty?")
    addQ("Appeal options?")
    addQ("Business impact?")
    addQ("Similar cases?")
    return questions.slice(0, 4)
  }
  
  // DIVIDEND / CORPORATE ACTION
  if (/dividend|bonus|split|buyback/i.test(lower)) {
    addQ("Record date?")
    addQ("Yield calculation?")
    addQ("Payout history?")
    addQ("Tax implications?")
    return questions.slice(0, 4)
  }
  
  // QUARTERLY RESULTS / EARNINGS
  if (/quarter|q[1-4]|result|earnings|pat|eps|revenue grew|profit|ebitda/i.test(lower)) {
    addQ("Beat or miss?")
    addQ("YoY comparison?")
    addQ("Guidance outlook?")
    addQ("Margin analysis?")
    return questions.slice(0, 4)
  }
  
  // M&A / ACQUISITION / STAKE
  if (/acquisition|merger|stake|buyout|takeover|amalgamation/i.test(lower)) {
    addQ("Valuation rationale?")
    addQ("Synergy targets?")
    addQ("Integration timeline?")
    addQ("Funding structure?")
    return questions.slice(0, 4)
  }
  
  // FUNDRAISE / QIP / RIGHTS ISSUE
  if (/qip|rights issue|preferential|fundraise|capital raise|equity infusion/i.test(lower)) {
    addQ("Dilution impact?")
    addQ("Use of proceeds?")
    addQ("Issue price vs CMP?")
    addQ("Investor interest?")
    return questions.slice(0, 4)
  }
  
  // EXPANSION / PROJECT / CAPEX
  if (/expansion|capex|project|capacity|plant|factory|commissioning/i.test(lower)) {
    addQ("Commissioning date?")
    addQ("Revenue potential?")
    addQ("Funding source?")
    addQ("ROI estimate?")
    return questions.slice(0, 4)
  }
  
  // ORDER WIN / CONTRACT
  if (/order|contract|awarded|tender|supply agreement/i.test(lower)) {
    addQ("Order value?")
    addQ("Execution timeline?")
    addQ("Margin profile?")
    addQ("Repeat potential?")
    return questions.slice(0, 4)
  }
  
  // WHALE / BULK DEAL / INSTITUTIONAL
  if (/whale|bulk deal|block deal|institutional|fii|dii|promoter|stake sale/i.test(lower)) {
    addQ("Cost basis?")
    addQ("Accumulation pattern?")
    addQ("Exit triggers?")
    addQ("Historical trades?")
    return questions.slice(0, 4)
  }
  
  // PRESS RELEASE / GENERAL ANNOUNCEMENT
  if (/press release|announcement|disclosure|update/i.test(lower)) {
    addQ("Key highlights?")
    addQ("Material impact?")
    addQ("Timeline details?")
    addQ("Stock impact?")
    return questions.slice(0, 4)
  }
  
  // GENERIC FALLBACK - smart contextual defaults
  const contextualDefaults = [
    "What's the impact?",
    "Next steps?",
    "Timeline?",
    "Stock outlook?"
  ]
  for (const d of contextualDefaults) {
    if (questions.length >= 4) break
    addQ(d)
  }
  
  return questions.slice(0, 4)
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

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
        id: "multi-" + generateId(),
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
    const id = generateId()
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

  // Send message with streaming
  const send = async (custom?: string) => {
    const msg = custom || input.trim()
    if (!msg || isLoading) return

    setAsked(prev => [...prev, msg])
    setMessages(prev => [...prev, {
      id: generateId(),
      role: "user",
      content: msg,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    }])
    setInput("")
    setAttachments([])
    setIsLoading(true)

    let webSources: WebSource[] = []
    const streamMsgId = generateId()
    
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

      let contextMsg = msg + extra
      if (multiDocMode && selectedDocs.length > 1) {
        contextMsg = `[Multi-document query across ${selectedDocs.length} announcements]\n\n${msg}${extra}`
      }

      setMessages(prev => [...prev, {
        id: streamMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      }])

        const res = await fetch("/api/ai/chat/stream", {
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
            history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
            stream: true,
            multiDocMode: multiDocMode && selectedDocs.length > 1,
            selectedAnnouncements: multiDocMode && selectedDocs.length > 1
              ? [activeAnnouncement, ...sameCompanyAnnouncements]
                  .filter(a => selectedDocs.includes(a.id))
                  .map(a => ({
                    id: a.id,
                    company: a.company,
                    ticker: a.ticker,
                    scripCode: a.scripCode,
                    headline: a.headline,
                    summary: a.summary,
                    category: a.category,
                    subCategory: a.subCategory,
                    time: a.time,
                    impact: a.impact,
                    pdfUrl: a.pdfUrl
                  }))
              : undefined
          })
        })

      if (!res.ok) throw new Error("Stream failed")

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""
      let receivedWidgets: any[] = []
      let receivedCitations: PdfCitation[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === "content") {
                  fullContent += data.content
                  setMessages(prev => prev.map(m => 
                    m.id === streamMsgId 
                      ? { ...m, content: fullContent }
                      : m
                  ))
                } else if (data.type === "widgets") {
                  receivedWidgets = data.widgets || []
                  setMessages(prev => prev.map(m => 
                    m.id === streamMsgId 
                      ? { ...m, widgets: receivedWidgets }
                      : m
                  ))
                } else if (data.type === "done") {
                  receivedCitations = data.citations || []
                  const followUps = generateFollowUps(fullContent, asked, activeAnnouncement.ticker)
                  const metrics = extractMetrics(fullContent)
                  const { hasTable, hasTimeline } = detectContentType(fullContent)

                  setMessages(prev => prev.map(m => 
                    m.id === streamMsgId 
                      ? { 
                          ...m, 
                          content: fullContent,
                          isStreaming: false,
                          citations: receivedCitations,
                          webSources: webSources.length > 0 ? webSources : undefined,
                          suggestedQuestions: followUps,
                          metrics: metrics.length > 0 ? metrics : undefined,
                          widgets: receivedWidgets.length > 0 ? receivedWidgets : undefined,
                          hasTable,
                          hasTimeline,
                          rating: null
                        }
                      : m
                  ))
                } else if (data.type === "error") {
                  throw new Error(data.error)
                }
              } catch (parseErr) {}
            }
          }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const existing = prev.find(m => m.id === streamMsgId)
        if (existing) {
          return prev.map(m => 
            m.id === streamMsgId 
              ? { ...m, content: "Error. Please try again.", isStreaming: false }
              : m
          )
        }
        return [...prev, {
          id: streamMsgId,
          role: "assistant" as const,
          content: "Error. Please try again.",
          timestamp: new Date()
        }]
      })
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

  // Compact PIP mode - minimal dark orb with sentiment glow
  if (!isExpanded) {
    const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop()
    const hasBullishSignal = lastAssistantMsg?.content?.toLowerCase().includes('bullish') || lastAssistantMsg?.widgets?.some((w: any) => w.data?.sentiment === 'Bullish')
    const hasBearishSignal = lastAssistantMsg?.content?.toLowerCase().includes('bearish') || lastAssistantMsg?.widgets?.some((w: any) => w.data?.sentiment === 'Bearish')
    const sentimentGlow = hasBullishSignal ? 'shadow-emerald-500/40' : hasBearishSignal ? 'shadow-rose-500/40' : 'shadow-cyan-500/30'
    const sentimentRing = hasBullishSignal ? 'from-emerald-500 to-cyan-500' : hasBearishSignal ? 'from-rose-500 to-orange-500' : 'from-cyan-500 to-blue-600'
    
    return (
      <div
        ref={containerRef}
        className="fixed z-50 cursor-pointer group"
        style={{ right: position.x, bottom: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div 
          onClick={() => setIsExpanded(true)}
          className={`relative w-12 h-12 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl ${sentimentGlow} hover:scale-110 transition-all flex items-center justify-center overflow-hidden`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${sentimentRing} opacity-20`} />
          <div className={`absolute inset-0 bg-gradient-to-br ${sentimentRing} opacity-30 blur-xl animate-pulse`} />
          <Sparkles className="relative h-5 w-5 text-white" />
          
          {messages.length > 1 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-zinc-950 rounded-full text-[9px] font-black flex items-center justify-center">
              {messages.length - 1}
            </span>
          )}
        </div>
        
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-md bg-zinc-950 border border-white/10 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
          {activeAnnouncement.ticker}
        </div>
      </div>
    )
  }

  // Expanded chat mode - ultra-minimal dark design
  return (
    <div
      ref={containerRef}
      className={`fixed z-50 flex flex-col bg-zinc-950 border border-white/5 shadow-2xl shadow-black/80 overflow-hidden transition-all ${
        isMaximized ? 'rounded-none' : 'rounded-xl'
      }`}
      style={isMaximized ? {
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999
      } : { 
        right: position.x, 
        bottom: position.y,
        width: 'min(480px, 95vw)',
        height: 'min(680px, 85vh)',
        maxHeight: '800px',
        zIndex: 9999
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Minimal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="drag-handle cursor-move p-1 rounded hover:bg-white/5">
            <GripVertical className="h-3.5 w-3.5 text-zinc-600" />
          </div>
          
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 opacity-30 blur-md" />
            <div className="relative w-full h-full rounded-lg bg-gradient-to-br from-cyan-500/80 to-blue-600/80 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {multiDocMode ? `${selectedDocs.length} Docs` : activeAnnouncement.ticker}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setWebSearch(!webSearch)}
            className={`p-1.5 rounded-md transition-colors ${webSearch ? "text-cyan-400 bg-cyan-500/10" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}
            title="Web search"
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
          
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          
          {!isMaximized && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
          
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Documents Panel */}
        <div className="border-b border-white/5">
          <button 
            onClick={() => setShowDocs(!showDocs)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Layers className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{sameCompanyAnnouncements.length + 1} docs</span>
              {multiDocMode && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] flex-shrink-0">MULTI</span>}
            </span>
            {showDocs ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />}
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

      {/* Messages - Clean minimal styling */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
              m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-cyan-500/80 to-blue-600/80"
            }`}>
              {m.role === "user" ? <User className="h-3 w-3 text-zinc-400" /> : <Sparkles className="h-3 w-3 text-white" />}
            </div>

              <div className={`max-w-[90%] ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`group relative rounded-lg px-3 py-2 ${m.role === "user" ? "bg-white/5" : "bg-transparent"}`}>
                  {m.role === "assistant" ? (
                    <>
                      {renderMarkdown(m.content)}
                      {m.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-cyan-400 animate-pulse rounded-sm" />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </p>
                  )}
                
                  {m.role === "assistant" && !m.isStreaming && (
                    <button 
                      onClick={() => copyMessage(m.content)}
                      className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                    >
                      <Copy className="h-3 w-3 text-zinc-600" />
                    </button>
                  )}
                </div>

                {/* Render Widgets */}
                {m.widgets && m.widgets.map((widget, idx) => (
                  <ChatWidgetRenderer key={idx} widget={widget} />
                ))}


              {/* PDF Citations - Enhanced Display with Popovers */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                        </div>
                        <span className="text-xs font-medium text-cyan-400">Sources from PDF{multiDocMode && m.citations.some(c => c.headline) ? 's' : ''}</span>
                        <span className="text-[10px] text-zinc-600">Click to preview</span>
                      </div>
                      <div className="grid gap-2">
                        {m.citations.map((c, i) => (
                          <CitationCard 
                            key={i} 
                            citation={c} 
                            index={i} 
                            multiDocMode={multiDocMode && m.citations!.some(c => c.headline)} 
                          />
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

              {/* Smart Keyword Tags - Minimal */}
              {m.role === "assistant" && getKeywordTags(m.content).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getKeywordTags(m.content).map(({ key, config }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] ${config.bg} ${config.border} ${config.color} border`}
                    >
                      {config.label}
                    </span>
                  ))}
                </div>
              )}

              {/* User Attachments */}
              {m.role === "user" && m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {m.attachments.map((att, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-[10px] text-zinc-400">
                      {att.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate max-w-[100px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Rating - Minimal */}
              {m.role === "assistant" && !m.isStreaming && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRateMessage(m.id, 'up')}
                      className={`p-1 rounded transition-all ${
                        m.rating === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/5 hover:text-zinc-400'
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleRateMessage(m.id, 'down')}
                      className={`p-1 rounded transition-all ${
                        m.rating === 'down' ? 'bg-rose-500/20 text-rose-400' : 'hover:bg-white/5 hover:text-zinc-400'
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => speakMessage(m.content)}
                    className={`p-1 rounded transition-all ${isSpeaking ? 'text-cyan-400' : 'hover:bg-white/5 hover:text-zinc-400'}`}
                  >
                    {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                </div>
              )}

              {/* Follow-up Questions - Minimal pills */}
              {m.role === "assistant" && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {m.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(q)}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[11px] text-zinc-500 hover:text-white hover:border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/80 to-blue-600/80 flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-white animate-spin" />
            </div>
            <div className="px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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

      {/* Input - Ultra minimal */}
      <div className="p-3 border-t border-white/5 bg-zinc-950">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/50 border border-white/5 focus-within:border-white/10 transition-all">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all"
          >
            <Paperclip className="h-4 w-4" />
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
            placeholder="Ask anything..."
            className="flex-1 px-2 py-2 bg-transparent text-white text-sm placeholder:text-zinc-600 outline-none"
            disabled={isLoading}
          />
          
          <button
            onClick={toggleVoice}
            className={`p-2 rounded-md transition-all ${isRecording ? "bg-rose-500/20 text-rose-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          
          <button
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-md bg-white text-zinc-950 disabled:opacity-20 hover:bg-zinc-200 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        
        {(webSearch || multiDocMode) && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {webSearch && (
              <span className="text-[9px] text-cyan-400/70 flex items-center gap-1 font-medium">
                <Globe className="h-2.5 w-2.5" /> Web
              </span>
            )}
            {multiDocMode && (
              <span className="text-[9px] text-purple-400/70 flex items-center gap-1 font-medium">
                <Layers className="h-2.5 w-2.5" /> {selectedDocs.length} docs
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
