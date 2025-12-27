"use client"

import { useState, useEffect, useRef } from "react"
import { 
  type VerdictType, 
  type AISummary, 
  getVerdictColor, 
  getVerdictLabel, 
  getVerdictIcon,
  getVerdictBgColor,
} from "@/lib/ai/verdict"
import { getCategoryEmoji, getKeywordEmoji } from "@/lib/ai/summaryFormatter"
import type { BSEImpact } from "@/lib/bse/types"
import { RefreshCw, FileText, Sparkles, CheckCircle, XCircle, Loader2, Maximize2 } from "lucide-react"

interface Quote {
  currentPrice: number | null
  previousClose?: number | null
  change?: number | null
  changePercent?: number | null
  priceAtAnnouncement?: number | null
  alphaSinceAnnouncement?: number | null
}

interface AISummaryPanelProps {
  headline: string
  summary: string
  category: string
  subCategory?: string
  announcementId: string
  pdfUrl?: string | null
  onVerdictGenerated?: (verdict: VerdictType) => void
  time?: string
  ticker?: string
  company?: string
  impact?: BSEImpact
  onFullScreenChat?: () => void
  quote?: Quote
}

type AnalysisStatus = "idle" | "fetching_pdf" | "analyzing" | "complete" | "failed"

const IMPACT_META: Record<BSEImpact, { label: string; description: string; pillClass: string; barClass: string; filledBars: number }> = {
  high: {
    label: "High impact",
    description: "Likely to move the stock and closely watched by investors.",
    pillClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    barClass: "bg-emerald-400",
    filledBars: 9,
  },
  medium: {
    label: "Moderate impact",
    description: "Important development but not necessarily a major price mover.",
    pillClass: "bg-amber-500/10 text-amber-300 border-amber-500/40",
    barClass: "bg-amber-400",
    filledBars: 6,
  },
  low: {
    label: "Low impact",
    description: "Incremental or routine update with limited price impact.",
    pillClass: "bg-zinc-700/60 text-zinc-300 border-zinc-500/40",
    barClass: "bg-zinc-400",
    filledBars: 3,
  },
}

export function AISummaryPanel({
  headline,
  summary,
  category,
  subCategory,
  announcementId,
  pdfUrl,
  onVerdictGenerated,
  time,
  ticker,
  company,
  impact,
  onFullScreenChat,
  quote,
}: AISummaryPanelProps) {
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [pdfUsed, setPdfUsed] = useState(false)
  const [pdfAnalyzed, setPdfAnalyzed] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle")
  const [source, setSource] = useState<string>("")
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const streamRef = useRef<EventSource | null>(null)

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;")

  const mdToHtml = (s: string) => {
    let t = escapeHtml(s || "")
    
    // Handle markdown tables
    const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g
    t = t.replace(tableRegex, (match, header, body) => {
      const headers = header.split('|').map((h: string) => h.trim()).filter(Boolean)
      const rows = body.trim().split('\n').map((row: string) => 
        row.split('|').map((cell: string) => cell.trim()).filter(Boolean)
      )
      
      let table = '<div class="overflow-x-auto my-3"><table class="w-full text-xs border-collapse">'
      table += '<thead><tr class="border-b border-white/10">'
      headers.forEach((h: string) => {
        table += `<th class="px-3 py-2 text-left text-zinc-400 font-medium">${h}</th>`
      })
      table += '</tr></thead><tbody>'
      rows.forEach((row: string[]) => {
        table += '<tr class="border-b border-white/5 hover:bg-white/5">'
        row.forEach((cell: string) => {
          // Highlight positive/negative values
          let cellClass = "px-3 py-2 text-zinc-300"
          if (cell.includes('+') || cell.toLowerCase().includes('positive') || cell.toLowerCase().includes('strong')) {
            cellClass += " text-emerald-400"
          } else if (cell.includes('-') && !cell.includes('Not') || cell.toLowerCase().includes('negative') || cell.toLowerCase().includes('weak')) {
            cellClass += " text-rose-400"
          }
          table += `<td class="${cellClass}">${cell}</td>`
        })
        table += '</tr>'
      })
      table += '</tbody></table></div>'
      return table
    })
    
    // Handle headers
    t = t.replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-white mt-4 mb-2">$1</h4>')
    t = t.replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
    
    // Handle emoji headers like 📊 **TITLE**:
    t = t.replace(/([\u{1F300}-\u{1F9FF}])\s*\*\*([^*]+)\*\*:?/gu, '<div class="flex items-center gap-2 mt-4 mb-2"><span class="text-lg">$1</span><span class="text-sm font-semibold text-white">$2</span></div>')
    
    // Handle bullet points
    t = t.replace(/^- \*\*([^*]+)\*\*:?\s*(.*)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-cyan-400 mt-1">•</span><span><strong class="text-zinc-200">$1:</strong> <span class="text-zinc-400">$2</span></span></div>')
    t = t.replace(/^- (.+)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-zinc-500 mt-1">•</span><span class="text-zinc-300">$1</span></div>')
    
    // Standard markdown
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>')
    t = t.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-cyan-400 text-xs">$1</code>')
    
    // Handle line breaks (but not inside tables)
    t = t.replace(/\n\n/g, '<br/><br/>')
    t = t.replace(/\n/g, '<br/>')
    
    return t
  }

  useEffect(() => {
    generateSummary(false)
    return () => {
      try { streamRef.current?.close() } catch {}
      streamRef.current = null
    }
  }, [announcementId, headline])

  const generateSummary = async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      setIsReanalyzing(true)
    }
    setLoading(true)
    setAnalysisStatus(pdfUrl ? "fetching_pdf" : "analyzing")
    
    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          summary,
          category,
          subCategory,
          pdfUrl,
          announcementId,
          forceRefresh,
        }),
      })

      if (response.ok) {
        const enhanced = await response.json()
        const merged: AISummary = {
          verdict: enhanced.verdict,
          simpleSummary: enhanced.simpleSummary,
          keyInsights: enhanced.keyInsights || [],
          analystCommentary: enhanced.analystCommentary || "",
          riskFactors: enhanced.riskFactors || [],
          opportunities: enhanced.opportunities || [],
        }
        setAiSummary(merged)
        setGeneratedAt(new Date())
        setPdfAnalyzed(enhanced.pdfAnalyzed || false)
        setPdfUsed(enhanced.pdfAnalyzed || false)
        setSource(enhanced.source || "rule-based")
        setAnalysisStatus(enhanced.pdfAnalyzed ? "complete" : (enhanced.pdfExtractionAttempted ? "failed" : "complete"))
        
        if (enhanced.verdict?.type) {
          onVerdictGenerated?.(enhanced.verdict.type)
        }
      } else {
        setAnalysisStatus("failed")
      }
    } catch (e) {
      console.error("Summary generation failed:", e)
      setAnalysisStatus("failed")
    } finally {
      setLoading(false)
      setIsReanalyzing(false)
    }
  }

  const handleReanalyze = () => {
    generateSummary(true)
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        {/* Analysis Progress Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center relative">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            <div className="absolute inset-0 rounded-xl border-2 border-cyan-500/50 border-t-transparent animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Speedy AI
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-medium">ANALYZING</span>
            </h3>
            <p className="text-xs text-zinc-500">Processing announcement...</p>
          </div>
        </div>

        {/* Analysis Steps */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${analysisStatus === "fetching_pdf" ? "bg-cyan-500/20" : "bg-emerald-500/20"}`}>
              {analysisStatus === "fetching_pdf" ? (
                <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3 text-emerald-400" />
              )}
            </div>
            <span className={analysisStatus === "fetching_pdf" ? "text-cyan-400" : "text-zinc-400"}>
              {pdfUrl ? "Fetching PDF document..." : "Reading headline..."}
            </span>
          </div>
          
          {pdfUrl && (
            <div className="flex items-center gap-3 text-xs">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${analysisStatus === "analyzing" ? "bg-purple-500/20" : "bg-zinc-700"}`}>
                {analysisStatus === "analyzing" ? (
                  <Loader2 className="h-3 w-3 text-purple-400 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3 text-zinc-500" />
                )}
              </div>
              <span className={analysisStatus === "analyzing" ? "text-purple-400" : "text-zinc-500"}>
                Extracting text from PDF...
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-3 text-xs">
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-zinc-700">
              <Sparkles className="h-3 w-3 text-zinc-500" />
            </div>
            <span className="text-zinc-500">Generating AI insights with GPT-4...</span>
          </div>
        </div>

        {/* Skeleton */}
        <div className="space-y-2 pt-2">
          <div className="h-3 bg-white/5 rounded w-full animate-pulse"></div>
          <div className="h-3 bg-white/5 rounded w-4/5 animate-pulse"></div>
          <div className="h-3 bg-white/5 rounded w-3/5 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!aiSummary) return null

  const verdictColor = getVerdictColor(aiSummary.verdict.type)
  const verdictLabel = getVerdictLabel(aiSummary.verdict.type)
  const verdictIcon = getVerdictIcon(aiSummary.verdict.type)
  const verdictBg = getVerdictBgColor(aiSummary.verdict.type)

  const generatedLabel = generatedAt
    ? generatedAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null

  const impactMeta = impact ? IMPACT_META[impact] : null

  return (
    <div className="space-y-4">
      {/* Header with status and re-analyze button */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">Generated by Speedy AI</span>
          {source && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
              source === "openai+pdf" ? "bg-emerald-500/20 text-emerald-400" :
              source === "openai" ? "bg-cyan-500/20 text-cyan-400" :
              "bg-zinc-700 text-zinc-400"
            }`}>
              {source === "openai+pdf" ? "📄 PDF Analyzed" : 
               source === "openai" ? "✨ AI Enhanced" : 
               "📝 Basic"}
            </span>
          )}
          {pdfUrl && !pdfAnalyzed && analysisStatus === "failed" && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-medium flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5" />
              PDF Failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generatedLabel && (
            <span className="text-[11px] text-zinc-500">{generatedLabel}</span>
          )}
          {/* Re-analyze Button */}
          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-400 hover:text-white transition-all disabled:opacity-50"
            title="Re-analyze with fresh PDF extraction"
          >
            <RefreshCw className={`h-3 w-3 ${isReanalyzing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isReanalyzing ? "Analyzing..." : "Re-analyze"}</span>
          </button>
        </div>
      </div>
      {/* Verdict Badge */}
      <div className="glass-card rounded-2xl p-5" style={{ borderColor: `${verdictColor}30` }}>
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${verdictColor}15` }}
          >
            {verdictIcon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-zinc-400">Verdict :</span>
              <span 
                className="font-bold text-lg"
                style={{ color: verdictColor }}
              >
                {verdictLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {aiSummary.verdict.reasoning}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Confidence</div>
            <div className="text-lg font-semibold" style={{ color: verdictColor }}>
              {aiSummary.verdict.confidence}%
            </div>
          </div>
        </div>
      </div>

      {/* News Summary */}
      <div className="glass-card rounded-2xl p-5">
        {(ticker || company) && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {ticker && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-200">
                  {ticker}
                </span>
              )}
              {company && (
                <span className="text-xs text-zinc-500 truncate max-w-[180px] md:max-w-xs">
                  {company}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="text-lg">📝</span>
            <span>News summary</span>
          </h4>
          <div className="flex items-center gap-2">
            {/* Gap Up Alert */}
              {quote?.previousClose && quote.currentPrice && quote.currentPrice > quote.previousClose && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-medium text-emerald-400">
                  <span>↑ Gap Up</span>
                  <span>+{((quote.currentPrice - quote.previousClose) / quote.previousClose * 100).toFixed(1)}%</span>
                </div>
              )}
              {/* Price at Announcement Alpha */}
              {quote?.priceAtAnnouncement && quote?.alphaSinceAnnouncement != null && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${
                  quote.alphaSinceAnnouncement >= 0 
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
                    : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                }`}>
                  <span>Since News:</span>
                  <span>{quote.alphaSinceAnnouncement >= 0 ? '+' : ''}{quote.alphaSinceAnnouncement.toFixed(1)}%</span>
                </div>
              )}
            {pdfUsed && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">
                Based on PDF
              </span>
            )}
            <span className="text-xs text-zinc-500 hidden sm:inline">What This Means for Investors</span>
            {onFullScreenChat && (
              <button
                onClick={onFullScreenChat}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all"
                title="Open Full-Screen AI Chat"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {time && (
          <p className="text-xs text-zinc-500 mb-2">
            {new Date(time).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
        <div
          className="text-sm text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: mdToHtml(aiSummary.simpleSummary) }}
        />
        {impactMeta && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-[11px]">
            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 border ${impactMeta.pillClass}`}>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-1.5 rounded-sm ${i < impactMeta.filledBars ? impactMeta.barClass : "bg-zinc-700"}`}
                  />
                ))}
              </div>
              <span>{impactMeta.label}</span>
            </div>
            <span className="text-zinc-500">
              {impactMeta.description}
            </span>
          </div>
        )}
      </div>

      {/* Key Insights */}
      {aiSummary.keyInsights.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="text-lg">💡</span>
              <span>Key Insights</span>
            </h4>
            <span className="text-xs text-zinc-500">Main Takeaways at a Glance</span>
          </div>
          <ul className="space-y-3">
            {aiSummary.keyInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Factors */}
      {aiSummary.riskFactors && aiSummary.riskFactors.length > 0 && (
        <div className="rounded-2xl p-5 bg-rose-500/5 border border-rose-500/20">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-400 mb-3">
            <span className="text-lg">⚠️</span>
            <span>Risk Factors</span>
          </h4>
          <ul className="space-y-2">
            {aiSummary.riskFactors.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-rose-300/80">
                <span className="text-rose-500 mt-0.5">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Opportunities */}
      {aiSummary.opportunities && aiSummary.opportunities.length > 0 && (
        <div className="rounded-2xl p-5 bg-emerald-500/5 border border-emerald-500/20">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-3">
            <span className="text-lg">🚀</span>
            <span>Opportunities</span>
          </h4>
          <ul className="space-y-2">
            {aiSummary.opportunities.map((opp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-300/80">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{opp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <span className="text-amber-500 text-sm">⚠</span>
        <span className="text-[10px] text-amber-400/80">
          Speedy AI-generated content may contain inaccuracies. Always verify with additional sources.
        </span>
      </div>
    </div>
  )
}

/**
 * Compact verdict badge for list views
 */
export function VerdictBadge({ verdict }: { verdict: VerdictType }) {
  const color = getVerdictColor(verdict)
  const label = getVerdictLabel(verdict)
  const icon = getVerdictIcon(verdict)

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ 
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * Verdict filter component
 */
export function VerdictFilter({
  selected,
  onChange,
}: {
  selected: VerdictType[]
  onChange: (verdicts: VerdictType[]) => void
}) {
  const allVerdicts: VerdictType[] = [
    "strong_positive",
    "positive",
    "neutral",
    "mixed",
    "negative",
    "strong_negative",
  ]

  const toggleVerdict = (verdict: VerdictType) => {
    if (selected.includes(verdict)) {
      onChange(selected.filter((v) => v !== verdict))
    } else {
      onChange([...selected, verdict])
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <span>📢</span>
        <span>AI Verdict</span>
      </h4>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
          <input
            type="checkbox"
            checked={selected.length === 0}
            onChange={() => onChange([])}
            className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
          />
          <span>All</span>
        </label>
        {allVerdicts.map((verdict) => (
          <label
            key={verdict}
            className="flex items-center justify-between text-sm text-zinc-400 cursor-pointer hover:text-zinc-300"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(verdict)}
                onChange={() => toggleVerdict(verdict)}
                className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span>{getVerdictLabel(verdict)}</span>
            </div>
            <span>{getVerdictIcon(verdict)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
