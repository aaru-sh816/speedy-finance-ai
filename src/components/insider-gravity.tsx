"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { TrendingUp, TrendingDown, Waves, ChevronDown, Calendar, DollarSign, Users, Sparkles, X, Loader2, Brain, Target, Zap, Activity, ArrowUpRight, ArrowDownRight, User } from "lucide-react"
import { clsx } from "clsx"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

type ViewMode = 'summary' | 'timeline' | 'clients'
type TimeFilter = 'all' | '1y' | '6m' | '90d' | '30d'

type InsiderStats = {
  buyValue: number
  sellValue: number
  buyQty: number
  sellQty: number
  score: number
  sentiment: 'accumulation' | 'distribution' | 'neutral' | 'aggressive_buying' | 'aggressive_selling'
  topClients: Array<{
    name: string
    buy: number
    sell: number
    deals: number
    avgBuyPrice: number
    avgSellPrice: number
    buyQty: number
    sellQty: number
    net: number
    pnl: number | null
  }>
  yearlyStats: Array<{ year: string; buy: number; sell: number; deals: BulkDeal[] }>
  total: number
  netFlow: number
  highestDeal: BulkDeal | null
}

interface BulkDeal {
  date: string
  clientName: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  securityName: string
  exchange: string
}

interface InsiderGravityProps {
  scripCode?: string
  ticker?: string
  currentPrice?: number
  initialDeals?: BulkDeal[]
  onDealHover?: (deal: BulkDeal | null) => void
}

export function InsiderGravity({ scripCode, ticker, currentPrice, initialDeals, onDealHover }: InsiderGravityProps) {
  const [deals, setDeals] = useState<BulkDeal[]>(initialDeals || [])
  const [loading, setLoading] = useState(!initialDeals)
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [expandedYear, setExpandedYear] = useState<string | null>(null)
  const [hoveredDealIndex, setHoveredDealIndex] = useState<number | null>(null)
  
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStreaming, setAiStreaming] = useState(false)
  
  const gaugeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchBulkDeals() {
      if (initialDeals) return
      if (!scripCode && !ticker) {
        setLoading(false)
        return
      }

      try {
        const query = scripCode ? `scripCode=${scripCode}` : `ticker=${ticker}`
        const res = await fetch(`/api/bulk-deals/history?${query}&days=4745`)
        if (res.ok) {
          const json = await res.json()
          const data = json.data || []
          
          const parsedDeals: BulkDeal[] = data.map((d: any) => ({
            date: d.date || d.deal_date,
            clientName: d.clientName || d.client_name,
            side: (d.side || d.deal_type || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
            quantity: d.quantity,
            price: d.price || d.trade_price,
            securityName: d.securityName || d.security_name,
            exchange: d.exchange || 'BSE'
          }))

          setDeals(parsedDeals)
        }
      } catch (e) {
        console.error("Failed to fetch bulk deals:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchBulkDeals()
  }, [scripCode, ticker])

  const filteredDeals = useMemo(() => {
    if (timeFilter === 'all') return deals
    const now = new Date()
    const cutoff = new Date()
    switch (timeFilter) {
      case '1y': cutoff.setFullYear(now.getFullYear() - 1); break
      case '6m': cutoff.setMonth(now.getMonth() - 6); break
      case '90d': cutoff.setDate(now.getDate() - 90); break
      case '30d': cutoff.setDate(now.getDate() - 30); break
    }
    return deals.filter(d => new Date(d.date) >= cutoff)
  }, [deals, timeFilter])

  const stats = useMemo<InsiderStats>(() => {
    let buyValue = 0, sellValue = 0, buyQty = 0, sellQty = 0
    const clientMap = new Map<string, { buy: number; sell: number; deals: number; avgBuyPrice: number; avgSellPrice: number; buyQty: number; sellQty: number }>()
    const yearlyData = new Map<string, { buy: number; sell: number; deals: BulkDeal[] }>()
    let highestDealValue = 0
    let highestDeal: BulkDeal | null = null

    filteredDeals.forEach(d => {
      const val = d.quantity * d.price
      const year = d.date.substring(0, 4)
      
      if (val > highestDealValue) {
        highestDealValue = val
        highestDeal = d
      }
      
      if (d.side === 'BUY') {
        buyValue += val
        buyQty += d.quantity
      } else {
        sellValue += val
        sellQty += d.quantity
      }

      const client = clientMap.get(d.clientName) || { buy: 0, sell: 0, deals: 0, avgBuyPrice: 0, avgSellPrice: 0, buyQty: 0, sellQty: 0 }
      if (d.side === 'BUY') {
        client.buy += val
        client.buyQty += d.quantity
        client.avgBuyPrice = client.buy / client.buyQty
      } else {
        client.sell += val
        client.sellQty += d.quantity
        client.avgSellPrice = client.sell / client.sellQty
      }
      client.deals++
      clientMap.set(d.clientName, client)

      const yearData = yearlyData.get(year) || { buy: 0, sell: 0, deals: [] }
      if (d.side === 'BUY') yearData.buy += val
      else yearData.sell += val
      yearData.deals.push(d)
      yearlyData.set(year, yearData)
    })

    const total = buyValue + sellValue
    const netFlow = buyValue - sellValue
    const score = total > 0 ? ((buyValue - sellValue) / total) * 100 : 0
    
    let sentiment: 'accumulation' | 'distribution' | 'neutral' | 'aggressive_buying' | 'aggressive_selling'
    if (score > 20) sentiment = 'aggressive_buying'
    else if (score > 5) sentiment = 'accumulation'
    else if (score < -20) sentiment = 'aggressive_selling'
    else if (score < -5) sentiment = 'distribution'
    else sentiment = 'neutral'

    const topClients = Array.from(clientMap.entries())
      .map(([name, data]) => ({ 
        name, 
        ...data, 
        net: data.buy - data.sell,
        pnl: currentPrice && data.buyQty > 0 ? ((currentPrice - data.avgBuyPrice) / data.avgBuyPrice) * 100 : null
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 10)

    const yearlyStats = Array.from(yearlyData.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, data]) => ({ year, ...data }))

    return { buyValue, sellValue, buyQty, sellQty, score, sentiment, topClients, yearlyStats, total, netFlow, highestDeal }
  }, [filteredDeals, currentPrice])

  const analyzeWithAI = useCallback(async () => {
    if (aiLoading || filteredDeals.length === 0) return
    
    setShowAIAnalysis(true)
    setAiLoading(true)
    setAiAnalysis("")
    setAiStreaming(true)

    const dealsContext = filteredDeals.slice(0, 30).map(d => 
      `${d.date}: ${d.clientName} ${d.side} ${d.quantity.toLocaleString()} shares @ ₹${d.price} (₹${((d.quantity * d.price) / 10000000).toFixed(2)} Cr)`
    ).join('\n')

    const prompt = `Analyze these institutional bulk/block deals for ${ticker || scripCode}:

DEAL HISTORY:
${dealsContext}

STATISTICS:
- Net Flow: ₹${(stats.netFlow / 10000000).toFixed(2)} Cr (${stats.netFlow >= 0 ? 'INFLOW' : 'OUTFLOW'})
- Total Buy Value: ₹${(stats.buyValue / 10000000).toFixed(2)} Cr
- Total Sell Value: ₹${(stats.sellValue / 10000000).toFixed(2)} Cr
- Sentiment Score: ${stats.score.toFixed(1)}% (${stats.sentiment.replace('_', ' ').toUpperCase()})
- Top Whale: ${stats.topClients[0]?.name || 'N/A'}
${currentPrice ? `- Current Price: ₹${currentPrice}` : ''}`

    try {
      const res = await fetch('/api/bulk-deals/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          ticker: ticker || scripCode,
          scripCode
        })
      })

      if (!res.ok) throw new Error('AI analysis failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  setAiAnalysis(prev => prev + parsed.content)
                }
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      setAiAnalysis("Unable to generate AI analysis. Please try again.")
    } finally {
      setAiLoading(false)
      setAiStreaming(false)
    }
  }, [filteredDeals, stats, ticker, scripCode, aiLoading, currentPrice])

  const formatValue = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
    return `₹${val.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    } catch {
      return dateStr
    }
  }

  const getSentimentConfig = () => {
    switch (stats.sentiment) {
      case 'aggressive_buying':
        return { label: 'AGGRESSIVE ACCUMULATION', color: 'emerald', icon: Zap, description: 'Whales are heavily buying' }
      case 'accumulation':
        return { label: 'ACCUMULATION', color: 'emerald', icon: TrendingUp, description: 'Institutional inflow detected' }
      case 'aggressive_selling':
        return { label: 'AGGRESSIVE DISTRIBUTION', color: 'rose', icon: Zap, description: 'Whales are heavily selling' }
      case 'distribution':
        return { label: 'DISTRIBUTION', color: 'rose', icon: TrendingDown, description: 'Institutional outflow detected' }
      default:
        return { label: 'BALANCED', color: 'zinc', icon: Activity, description: 'Mixed institutional activity' }
    }
  }

  const sentimentConfig = getSentimentConfig()

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 animate-pulse h-64 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Waves className="h-8 w-8 text-cyan-500/30 animate-bounce" />
          <span className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Loading Whale Data...</span>
        </div>
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-500/20 flex items-center justify-center">
            <Waves className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-wide text-white">WHALE GRAVITY</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Bulk & Block Deal Activity</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-xs text-zinc-500">No institutional deals detected in our database.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-[60px] pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/20">
                <Waves className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 flex items-center justify-center">
                <div className={clsx(
                  "w-2 h-2 rounded-full animate-pulse",
                  sentimentConfig.color === 'emerald' ? "bg-emerald-400" : 
                  sentimentConfig.color === 'rose' ? "bg-rose-400" : "bg-zinc-400"
                )} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                WHALE GRAVITY
                <span className="text-[9px] font-bold text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">BETA</span>
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{filteredDeals.length} Institutional Deals</p>
            </div>
          </div>
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={clsx(
              "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border",
              sentimentConfig.color === 'emerald' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              sentimentConfig.color === 'rose' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
              "bg-zinc-800 text-zinc-400 border-zinc-700"
            )}
          >
            <sentimentConfig.icon className="h-3.5 w-3.5" />
            {sentimentConfig.label}
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 rounded-2xl p-4 border border-white/5 overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">NET FLOW</p>
            <p className={clsx(
              "text-xl font-black tabular-nums",
              stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {stats.netFlow >= 0 ? '+' : ''}{formatValue(Math.abs(stats.netFlow))}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {stats.netFlow >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-rose-500" />
              )}
              <span className="text-[9px] text-zinc-500 font-medium">
                {stats.netFlow >= 0 ? 'Inflow' : 'Outflow'}
              </span>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10"
          >
            <p className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">BOUGHT</p>
            <p className="text-lg font-black text-emerald-400 tabular-nums">{formatValue(stats.buyValue)}</p>
            <p className="text-[9px] text-emerald-500/50 mt-1">{stats.buyQty.toLocaleString()} shares</p>
          </motion.div>
          
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-rose-500/5 rounded-2xl p-4 border border-rose-500/10"
          >
            <p className="text-[9px] font-black text-rose-500/70 uppercase tracking-widest mb-1">SOLD</p>
            <p className="text-lg font-black text-rose-400 tabular-nums">{formatValue(stats.sellValue)}</p>
            <p className="text-[9px] text-rose-500/50 mt-1">{stats.sellQty.toLocaleString()} shares</p>
          </motion.div>
        </div>

        <div className="flex gap-1 mb-4">
          {(['all', '1y', '6m', '90d', '30d'] as TimeFilter[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                timeFilter === tf 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]" 
                  : "bg-white/5 text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10"
              )}
            >
              {tf === 'all' ? 'ALL' : tf.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mb-6" ref={gaugeRef}>
          <div className="relative">
            <div className="relative h-8 bg-zinc-900/80 rounded-full overflow-hidden border border-white/5">
              <div className="absolute inset-0 flex">
                <div className="w-1/2 bg-gradient-to-r from-rose-500/20 to-transparent" />
                <div className="w-1/2 bg-gradient-to-l from-emerald-500/20 to-transparent" />
              </div>
              
              <motion.div 
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.min(Math.abs(stats.score) / 2, 50)}%`,
                  left: stats.score >= 0 ? '50%' : `${50 - Math.min(Math.abs(stats.score) / 2, 50)}%`
                }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={clsx(
                  "absolute inset-y-0 transition-all duration-1000",
                  stats.score >= 0 
                    ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]" 
                    : "bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.4)]"
                )}
                style={{ 
                  left: stats.score >= 0 ? '50%' : `${50 - Math.min(Math.abs(stats.score) / 2, 50)}%`
                }}
              />
              
              <div className="absolute inset-y-0 left-1/2 w-1 bg-white/40 -translate-x-1/2 z-10" />
              
              <motion.div 
                initial={{ left: '50%' }}
                animate={{ left: `${50 + stats.score / 2}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-zinc-900 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-20"
              />
            </div>
            
            <div className="flex justify-between mt-2 text-[9px] font-black tracking-widest">
              <span className="text-rose-500 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> DISTRIBUTION
              </span>
              <motion.span 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={clsx(
                  "px-2 py-0.5 rounded-md text-[10px] font-black",
                  stats.score >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}
              >
                {stats.score >= 0 ? '+' : ''}{stats.score.toFixed(1)}%
              </motion.span>
              <span className="text-emerald-500 flex items-center gap-1">
                ACCUMULATION <TrendingUp className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>

        <motion.button
          onClick={analyzeWithAI}
          disabled={aiLoading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={clsx(
            "w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all duration-500 relative overflow-hidden group",
            aiLoading 
              ? "bg-zinc-900 text-zinc-500 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {aiLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing Institutional Intent...</span>
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              <span>Analyze Whale Intent with AI</span>
              <Sparkles className="h-3 w-3 opacity-50" />
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {showAIAnalysis && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 overflow-hidden"
            >
              <div className="relative bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 rounded-2xl p-4 border border-cyan-500/20">
                <button
                  onClick={() => setShowAIAnalysis(false)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Brain className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">Speedy AI Analysis</span>
                  {aiStreaming && (
                    <span className="flex h-1.5 w-1.5 ml-1">
                      <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                  {aiAnalysis || (
                    <div className="flex items-center gap-2 text-zinc-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating analysis...</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {([
            { id: 'summary', label: 'YEARLY', icon: Calendar },
            { id: 'timeline', label: 'DEALS', icon: DollarSign },
            { id: 'clients', label: 'WHALES', icon: Users }
          ] as { id: ViewMode; label: string; icon: any }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden",
                viewMode === tab.id 
                  ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" 
                  : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
              )}
            >
              {viewMode === tab.id && (
                <motion.div 
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"
                  transition={{ duration: 0.2 }}
                />
              )}
              <tab.icon className="h-3 w-3 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          <AnimatePresence mode="wait">
            {viewMode === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {stats.yearlyStats.map(({ year, buy, sell, deals: yearDeals }) => (
                  <div key={year} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors">
                    <button
                      onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-white tabular-nums">{year}</span>
                        <span className="text-[9px] text-zinc-600 font-bold px-2 py-0.5 rounded bg-white/5">{yearDeals.length} deals</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={clsx(
                            "text-sm font-black tabular-nums",
                            buy > sell ? "text-emerald-400" : buy < sell ? "text-rose-400" : "text-zinc-400"
                          )}>
                            {buy > sell ? '+' : ''}{formatValue(buy - sell)}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: expandedYear === year ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </motion.div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedYear === year && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="text-[10px] flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-zinc-500">Buy:</span>
                                <span className="text-emerald-400 font-bold">{formatValue(buy)}</span>
                              </div>
                              <div className="text-[10px] flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                                <span className="text-zinc-500">Sell:</span>
                                <span className="text-rose-400 font-bold">{formatValue(sell)}</span>
                              </div>
                            </div>
                            {yearDeals.slice(0, 10).map((deal, i) => (
                              <motion.div 
                                key={i} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-black/60 transition-colors group cursor-pointer"
                                onMouseEnter={() => onDealHover?.(deal)}
                                onMouseLeave={() => onDealHover?.(null)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className={clsx(
                                    "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                    deal.side === 'BUY' ? "bg-emerald-500/20" : "bg-rose-500/20"
                                  )}>
                                    {deal.side === 'BUY' ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
                                  </div>
                                    <div className="min-w-0 flex-1">
                                      <Link 
                                        href={`/bulk-deals/person/${encodeURIComponent(deal.clientName)}`}
                                        className="text-[10px] font-bold text-zinc-300 truncate hover:text-cyan-400 transition-colors block"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {deal.clientName}
                                      </Link>
                                      <p className="text-[8px] text-zinc-600">{formatDate(deal.date)} • ₹{deal.price.toLocaleString()}</p>
                                    </div>
                                </div>
                                <span className={clsx(
                                  "text-[10px] font-black tabular-nums",
                                  deal.side === 'BUY' ? "text-emerald-400" : "text-rose-400"
                                )}>{formatValue(deal.quantity * deal.price)}</span>
                              </motion.div>
                            ))}
                            {yearDeals.length > 10 && (
                              <p className="text-[9px] text-zinc-600 text-center py-2">+{yearDeals.length - 10} more deals</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            )}

            {viewMode === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {filteredDeals.slice(0, 50).map((deal, i) => {
                  const isHovered = hoveredDealIndex === i
                  return (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onMouseEnter={() => { setHoveredDealIndex(i); onDealHover?.(deal) }}
                      onMouseLeave={() => { setHoveredDealIndex(null); onDealHover?.(null) }}
                      className={clsx(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-300 cursor-pointer",
                        isHovered 
                          ? "bg-white/[0.05] border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
                          deal.side === 'BUY' ? "bg-emerald-500/20" : "bg-rose-500/20",
                          isHovered && "scale-110 shadow-lg"
                        )}>
                          {deal.side === 'BUY' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}
                        </div>
                          <div className="min-w-0 flex-1">
                            <Link 
                              href={`/bulk-deals/person/${encodeURIComponent(deal.clientName)}`}
                              className={clsx(
                                "text-[12px] font-bold truncate transition-colors hover:text-cyan-400 block",
                                isHovered ? "text-white" : "text-zinc-300"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {deal.clientName}
                            </Link>
                            <div className="flex items-center gap-2 text-[9px] text-zinc-500 mt-0.5">
                              <span>{formatDate(deal.date)}</span>
                              <span>•</span>
                              <span>{deal.exchange}</span>
                              <span>•</span>
                              <span className="text-zinc-400">₹{deal.price.toLocaleString()}</span>
                            </div>
                          </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={clsx(
                          "text-[12px] font-black tabular-nums",
                          deal.side === 'BUY' ? "text-emerald-400" : "text-rose-400"
                        )}>{deal.side === 'BUY' ? '+' : '-'}{formatValue(deal.quantity * deal.price)}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{deal.quantity.toLocaleString()} qty</p>
                      </div>
                    </motion.div>
                  )
                })}
                {filteredDeals.length > 50 && (
                  <p className="text-[10px] text-zinc-600 text-center py-3">Showing 50 of {filteredDeals.length} deals</p>
                )}
              </motion.div>
            )}

            {viewMode === 'clients' && (
              <motion.div
                key="clients"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {stats.topClients.map((client, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <Link 
                            href={`/bulk-deals/person/${encodeURIComponent(client.name)}`}
                            className="text-[11px] font-bold text-white truncate hover:text-cyan-400 transition-colors block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {client.name}
                          </Link>
                          <p className="text-[9px] text-zinc-600">{client.deals} deals</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.pnl !== null && (
                          <span className={clsx(
                            "text-[9px] font-bold px-2 py-0.5 rounded",
                            client.pnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          )}>
                            {client.pnl >= 0 ? '+' : ''}{client.pnl.toFixed(1)}% P&L
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(client.buy / (client.buy + client.sell)) * 100}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                        />
                      </div>
                      <span className={clsx(
                        "text-[10px] font-black tabular-nums min-w-[70px] text-right",
                        client.net >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {client.net >= 0 ? '+' : ''}{formatValue(Math.abs(client.net))}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-[9px] text-zinc-600">
                      <span className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Buy: {formatValue(client.buy)}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Sell: {formatValue(client.sell)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 pt-4 border-t border-white/5">
          <div className={clsx(
            "flex items-start gap-3 p-3 rounded-xl",
            stats.sentiment.includes('aggressive') ? "bg-amber-500/5 border border-amber-500/20" : "bg-white/[0.02]"
          )}>
            <Target className={clsx(
              "h-4 w-4 flex-shrink-0 mt-0.5",
              stats.sentiment.includes('aggressive') ? "text-amber-400" : "text-cyan-400"
            )} />
            <div>
              <p className="text-[10px] font-bold text-zinc-300 mb-1">
                {stats.sentiment === 'aggressive_buying' && "Strong institutional accumulation detected. Net inflow indicates sustained buying pressure."}
                {stats.sentiment === 'accumulation' && "Gradual institutional accumulation. Whales are building positions systematically."}
                {stats.sentiment === 'aggressive_selling' && "Heavy institutional distribution. Exercise caution - professional money is exiting."}
                {stats.sentiment === 'distribution' && "Institutional distribution phase. Net outflow suggests profit-taking or repositioning."}
                {stats.sentiment === 'neutral' && "Mixed institutional activity. No clear directional bias from whale trades."}
              </p>
              {stats.highestDeal && (
                <p className="text-[9px] text-zinc-500">
                  Largest deal: {formatValue(stats.highestDeal.quantity * stats.highestDeal.price)} by {stats.highestDeal.clientName} on {formatDate(stats.highestDeal.date)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
