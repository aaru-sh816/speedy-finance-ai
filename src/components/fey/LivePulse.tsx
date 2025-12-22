"use client"

import { useState, useEffect } from "react"
import { 
  Zap, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  FileText, 
  Calendar,
  ChevronRight,
  Info,
  ChevronDown
} from "lucide-react"
import { FeyCard } from "./FeyCard"
import { cn } from "@/lib/utils"

interface PulseItem {
  scripCode: string
  companyName: string
  category: string
  subject: string
  time: string
  timestamp: string
  price?: number
  pChange?: number
  isHighImpact?: boolean
  pdfUrl?: string
}

export function LivePulse() {
  const [items, setItems] = useState<PulseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatest()
    const interval = setInterval(fetchLatest, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchLatest() {
    try {
      const res = await fetch("/api/bse/announcements?maxPages=1")
      const data = await res.json()
        if (data.announcements) {
              const normalized = data.announcements.map((a: any) => {
                // Extract company name with robust institutional fallbacks
                const rawCompany = a.companyName || a.company || a.scripName || a.scrip_name || a.ScripName || a.ShortName;
                let companyName = rawCompany || "BSE Listed Entity";
                
                // If still generic or unknown, try to extract from headline or use ScripCode
                if ((companyName === "Unknown" || companyName === "BSE Listed Entity") && (a.headline || a.subject)) {
                  const parts = (a.headline || a.subject).split(':');
                  if (parts.length > 1 && parts[0].length < 25) {
                    companyName = parts[0].trim();
                  } else if (a.scripCode) {
                    companyName = `Scrip: ${a.scripCode}`;
                  }
                }

                // Standardize category labeling
                const rawCategory = a.category || a.categoryName || a.category_name || a.CategoryName || "Disclosure";
                const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();

                return {
                  scripCode: a.scripCode || a.scrip_code || a.ScripCode,
                  companyName,
                  category,
                  subject: a.headline || a.subject || a.details || "Corporate Announcement",
                  time: new Date(a.time || a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  timestamp: a.time || a.date,
                  pdfUrl: a.attachmentUrl || a.pdfUrl,
                  isHighImpact: a.impact === 'high' || 
                                /result|acquisition|merger|dividend|bonus|split|order|allotment/i.test(category) ||
                                /significant|major|record date|win/i.test(a.headline || "")
                }
              })

        setItems(normalized.slice(0, 15))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-zinc-950/20 backdrop-blur-3xl rounded-3xl border border-zinc-800/30 overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2.5 h-2.5 bg-cyan-500 rounded-full animate-ping opacity-50" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tighter text-white">Live Pulse</h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Real-time Disclosure</p>
          </div>
        </div>
        
        <div className="px-3 py-1 bg-zinc-800/50 rounded-full border border-zinc-700/30">
          <span className="text-[10px] font-bold text-zinc-400">SYNCED</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-900/20 animate-pulse border border-zinc-800/10" />
          ))
        ) : (
          items.map((item, idx) => (
            <PulseCard key={`${item.scripCode}-${idx}-${item.timestamp}`} item={item} />
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/20 text-center">
        <button className="text-[10px] font-bold text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">
          View All History
        </button>
      </div>
    </div>
  )
}


interface BulkDeal {
  date: string
  clientName: string
  side: string
  quantity: number
  price: number
}

interface CorpAction {
  subject: string
  exDate: string
}

function PulseCard({ item }: { item: PulseItem }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [details, setDetails] = useState<{ bulk: BulkDeal[], corp: CorpAction[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [flashSummary, setFlashSummary] = useState<{ kpis: any, summary: string, sentiment: string } | null>(null)
  const [flashLoading, setFlashLoading] = useState(false)
  const [quote, setQuote] = useState<{ price: number, pChange: number, name?: string } | null>(null)

  useEffect(() => {
    // Fetch quote for this item
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/bse/quote?symbol=${item.scripCode}`)
        const data = await res.json()
        if (data && !data.error) {
          setQuote({
            price: Number(data.price || 0),
            pChange: Number(data.changePercent || 0),
            name: data.companyName || data.securityID
          })
        }
      } catch (e) {}
    }
    fetchQuote()
  }, [item.scripCode])

  async function loadDetails() {
    if (details) return
    setDetailLoading(true)
    try {
      // Mocking bulk deals and corp actions lookup
      // In production, these would be real API calls
      const bulkRes = await fetch(`/api/bulk-deals/history?scripCode=${item.scripCode}`)
      const bulkData = await bulkRes.json()
      
      setDetails({
        bulk: bulkData.deals?.slice(0, 2) || [],
        corp: [] // Would fetch from corporate actions API
      })
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
  }
}

async function fetchFlashSummary() {
  if (!item.pdfUrl || flashSummary) return
  setFlashLoading(true)
  try {
    const res = await fetch("/api/ai/summary/flash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfUrl: item.pdfUrl, headline: item.subject })
    })
    const data = await res.json()
    if (data.success) {
      setFlashSummary({
        kpis: data.kpis,
        summary: data.summary,
        sentiment: data.sentiment
      })
    }
  } catch (e) {
    console.error(e)
  } finally {
    setFlashLoading(false)
  }
}

const isPositive = (quote?.pChange || 0) >= 0

  return (
    <div className="relative group">
      <FeyCard 
        variant="default" 
        className="p-4 rounded-3xl hover:border-zinc-700/50 transition-all cursor-default"
      >
        <div className="flex items-center gap-4">
          {/* Category Icon */}
          <div className="w-10 h-10 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner group-hover:border-cyan-500/30 transition-colors">
            <Zap className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">{item.category}</span>
                  {item.isHighImpact && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-tighter border border-rose-500/30">
                      High Impact
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white truncate mb-1">
                {item.companyName === "Unknown" && quote?.name ? quote.name : item.companyName}
              </h3>
              <p className="text-xs text-zinc-500 line-clamp-1 group-hover:text-zinc-400 transition-colors">{item.subject}</p>
            </div>

          <div className="text-right ml-4">
            <div className="text-sm font-bold text-white">₹{quote?.price.toFixed(2) || "—"}</div>
            <div className={cn(
              "text-[10px] font-bold mt-1",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}>
              {isPositive ? "+" : ""}{quote?.pChange.toFixed(2) || "0.00"}%
            </div>
          </div>
          
          <button 
            onClick={() => {
              setShowTooltip(!showTooltip)
              loadDetails()
            }}
            className={cn(
              "ml-2 p-2 rounded-xl transition-all",
              showTooltip ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]" : "bg-zinc-900 text-zinc-500 hover:text-white"
            )}
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", showTooltip && "rotate-180")} />
          </button>
        </div>

        {/* Smart Tooltip / Drawer */}
        {showTooltip && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-300">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 py-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                Syncing intelligence...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bulk Deals Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    <FileText className="w-3 h-3 text-cyan-500" />
                    Recent Bulk Activity
                  </div>
                  {details?.bulk && details.bulk.length > 0 ? (
                    details.bulk.map((b, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-zinc-800/50 group/item">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-300 truncate">{b.clientName}</p>
                          <p className="text-[9px] text-zinc-600">{b.date}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[10px] font-bold", b.side === "BUY" ? "text-emerald-400" : "text-rose-400")}>{b.side}</p>
                          <p className="text-[9px] text-zinc-500">₹{b.price}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic">No recent bulk movement</p>
                  )}
                </div>

                {/* Corporate Actions Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    <Calendar className="w-3 h-3 text-purple-500" />
                    Upcoming Corporate Actions
                  </div>
                  {details?.corp && details.corp.length > 0 ? (
                    details.corp.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-zinc-800/50">
                        <p className="text-[10px] font-bold text-zinc-300 w-24 truncate">{c.subject}</p>
                        <p className="text-[10px] font-bold text-purple-400">{c.exDate}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic">No upcoming ex-dates</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-zinc-800/20 flex flex-col gap-4">
              {/* Flash Summary Button & KPIs */}
              {item.category?.toLowerCase().includes('result') && item.pdfUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={fetchFlashSummary}
                      disabled={flashLoading}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all",
                        flashSummary 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                      )}
                    >
                      <Zap className={cn("w-3 h-3", flashLoading && "animate-spin")} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {flashLoading ? "Analyzing..." : flashSummary ? "Summary Ready" : "Flash Summary"}
                      </span>
                    </button>
                    {flashSummary && (
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                          flashSummary.sentiment === 'positive' ? "bg-emerald-500/20 text-emerald-400" : 
                          flashSummary.sentiment === 'negative' ? "bg-rose-500/20 text-rose-400" : "bg-zinc-800 text-zinc-400"
                        )}>
                          {flashSummary.sentiment}
                        </div>
                      </div>
                    )}
                  </div>

                  {flashSummary?.kpis && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/40 p-2 rounded-xl border border-zinc-800/50">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Revenue</p>
                        <p className="text-[10px] font-bold text-white">{flashSummary.kpis.revenue || "—"}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded-xl border border-zinc-800/50">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">PAT</p>
                        <p className="text-[10px] font-bold text-white">{flashSummary.kpis.pat || "—"}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded-xl border border-zinc-800/50">
                        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Margin</p>
                        <p className="text-[10px] font-bold text-white">{flashSummary.kpis.margin || "—"}</p>
                      </div>
                    </div>
                  )}

                  {flashSummary?.summary && (
                    <p className="text-[10px] text-zinc-300 leading-relaxed italic bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                      "{flashSummary.summary.slice(0, 150)}..."
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors">
                  View Deep Data Analysis
                </button>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-tighter">Speedy Analysis Ready</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </FeyCard>
    </div>
  )
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  )
}
