'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Loader2,
  AlertTriangle,
  Target,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw
} from 'lucide-react'

interface SentimentAnalysis {
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number
  bullCase: {
    summary: string
    keyPoints: string[]
  }
  bearCase: {
    summary: string
    keyPoints: string[]
  }
  shortTermOutlook: string
  riskLevel: 'low' | 'medium' | 'high'
  catalysts: string[]
}

interface StockSentimentCardProps {
  symbol: string
  companyName: string
  currentPrice: number
  changePercent: number
  announcements?: Array<{ headline: string; date: string }>
  className?: string
  compact?: boolean
}

export function StockSentimentCard({ 
  symbol, 
  companyName, 
  currentPrice, 
  changePercent, 
  announcements = [],
  className = '',
  compact = false
}: StockSentimentCardProps) {
  const [analysis, setAnalysis] = useState<SentimentAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(!compact)

  const fetchAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/ai/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          companyName,
          currentPrice,
          changePercent,
          announcements
        })
      })

      if (!res.ok) throw new Error('Failed to fetch sentiment')
      
      const data = await res.json()
      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [symbol])

  const getSentimentIcon = () => {
    if (!analysis) return <Minus className="h-5 w-5 text-zinc-400" />
    switch (analysis.overallSentiment) {
      case 'bullish': return <TrendingUp className="h-5 w-5 text-emerald-400" />
      case 'bearish': return <TrendingDown className="h-5 w-5 text-rose-400" />
      default: return <Minus className="h-5 w-5 text-amber-400" />
    }
  }

  const getSentimentColor = () => {
    if (!analysis) return 'border-zinc-700'
    switch (analysis.overallSentiment) {
      case 'bullish': return 'border-emerald-500/30 bg-emerald-500/5'
      case 'bearish': return 'border-rose-500/30 bg-rose-500/5'
      default: return 'border-amber-500/30 bg-amber-500/5'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-emerald-400 bg-emerald-500/20'
      case 'medium': return 'text-amber-400 bg-amber-500/20'
      case 'high': return 'text-rose-400 bg-rose-500/20'
      default: return 'text-zinc-400 bg-zinc-500/20'
    }
  }

  const getScoreGradient = (score: number) => {
    if (score >= 50) return 'from-emerald-500 to-emerald-400'
    if (score >= 20) return 'from-emerald-400 to-emerald-300'
    if (score >= -20) return 'from-amber-400 to-amber-300'
    if (score >= -50) return 'from-rose-400 to-rose-300'
    return 'from-rose-500 to-rose-400'
  }

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 ${className}`}>
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span className="text-sm text-zinc-400">Analyzing {symbol}...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 ${className}`}>
        <div className="flex items-center gap-2 text-rose-400">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">Failed to analyze: {error}</span>
        </div>
        <button 
          onClick={fetchAnalysis}
          className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className={`rounded-xl border ${getSentimentColor()} transition-all ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            analysis.overallSentiment === 'bullish' ? 'bg-emerald-500/20' :
            analysis.overallSentiment === 'bearish' ? 'bg-rose-500/20' : 'bg-amber-500/20'
          }`}>
            {getSentimentIcon()}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{symbol}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                analysis.overallSentiment === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' :
                analysis.overallSentiment === 'bearish' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {analysis.overallSentiment}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Sparkles className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-zinc-500">AI Sentiment Analysis</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Sentiment Score Gauge */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getScoreGradient(analysis.sentimentScore)} transition-all`}
                style={{ width: `${Math.abs(analysis.sentimentScore)}%`, marginLeft: analysis.sentimentScore < 0 ? 'auto' : 0 }}
              />
            </div>
            <span className={`text-sm font-bold ${
              analysis.sentimentScore >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {analysis.sentimentScore >= 0 ? '+' : ''}{analysis.sentimentScore}
            </span>
          </div>
          
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-zinc-800/50">
          {/* Bull vs Bear */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bull Case */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Bull Case</span>
              </div>
              <p className="text-sm text-zinc-300 mb-3">{analysis.bullCase.summary}</p>
              <ul className="space-y-1.5">
                {analysis.bullCase.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <span className="text-emerald-500 mt-1">+</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Bear Case */}
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-rose-400" />
                <span className="text-sm font-semibold text-rose-400">Bear Case</span>
              </div>
              <p className="text-sm text-zinc-300 mb-3">{analysis.bearCase.summary}</p>
              <ul className="space-y-1.5">
                {analysis.bearCase.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <span className="text-rose-500 mt-1">−</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Short Term Outlook */}
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">Short-Term Outlook</span>
            </div>
            <p className="text-sm text-zinc-300">{analysis.shortTermOutlook}</p>
          </div>

          {/* Risk & Catalysts */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              <span className="text-xs text-zinc-500">Risk:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${getRiskColor(analysis.riskLevel)}`}>
                {analysis.riskLevel}
              </span>
            </div>

            {analysis.catalysts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-zinc-500">Catalysts:</span>
                {analysis.catalysts.map((catalyst, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px]">
                    {catalyst}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <div className="flex justify-end pt-2">
            <button
              onClick={fetchAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for watchlist
export function SentimentBadge({ 
  symbol, 
  companyName, 
  currentPrice, 
  changePercent 
}: { 
  symbol: string
  companyName: string
  currentPrice: number
  changePercent: number
}) {
  const [sentiment, setSentiment] = useState<'bullish' | 'bearish' | 'neutral' | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const res = await fetch('/api/ai/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, companyName, currentPrice, changePercent })
        })
        const data = await res.json()
        if (data.success) {
          setSentiment(data.analysis.overallSentiment)
        }
      } catch {
        // Silently fail for badge
      } finally {
        setIsLoading(false)
      }
    }
    fetchSentiment()
  }, [symbol])

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
  }

  if (!sentiment) return null

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
      sentiment === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' :
      sentiment === 'bearish' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
    }`}>
      {sentiment === 'bullish' ? '↑' : sentiment === 'bearish' ? '↓' : '→'}
    </span>
  )
}
