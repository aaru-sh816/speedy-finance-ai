"use client"

import { useState } from "react"
import { Brain, ChevronDown, ChevronUp, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { type DealPrediction, getPredictionDisplay } from "@/lib/bulk-deals/aiPredictions"

function clsx(...v: (string | false | undefined)[]) { 
  return v.filter(Boolean).join(" ") 
}

interface AIPredictionBadgeProps {
  prediction: DealPrediction
  size?: "sm" | "md" | "lg"
  showDetails?: boolean
  className?: string
}

export function AIPredictionBadge({ 
  prediction, 
  size = "md", 
  showDetails = false,
  className = ""
}: AIPredictionBadgeProps) {
  const [expanded, setExpanded] = useState(false)
  const display = getPredictionDisplay(prediction)

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2"
  }

  return (
    <div className={clsx("inline-flex flex-col", className)}>
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className={clsx(
          "inline-flex items-center rounded-lg font-semibold border transition-all",
          display.bgColor,
          display.color,
          `border-${display.color.replace('text-', '')}/20`,
          sizeClasses[size],
          showDetails && "cursor-pointer hover:opacity-80"
        )}
      >
        <Brain className={clsx(
          size === "sm" ? "h-3 w-3" : size === "md" ? "h-3.5 w-3.5" : "h-4 w-4"
        )} />
        <span>{prediction.score}%</span>
        <span className="opacity-75">{display.emoji}</span>
        {showDetails && (
          expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {/* Expanded Details */}
      {showDetails && expanded && (
        <div className="mt-2 p-3 rounded-xl bg-zinc-800/80 border border-white/10 text-xs space-y-2 max-w-xs">
          {/* Score Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400">AI Score</span>
              <span className={clsx("font-bold", display.color)}>{prediction.score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
              <div 
                className={clsx(
                  "h-full rounded-full transition-all",
                  prediction.score >= 60 ? "bg-emerald-500" :
                  prediction.score >= 40 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${prediction.score}%` }}
              />
            </div>
          </div>

          {/* Recommendation */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Recommendation</span>
            <span className={clsx("font-semibold", display.color)}>{display.label}</span>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Confidence</span>
            <span className={clsx(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              prediction.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
              prediction.confidence === "medium" ? "bg-amber-500/20 text-amber-400" :
              "bg-zinc-500/20 text-zinc-400"
            )}>
              {prediction.confidence.toUpperCase()}
            </span>
          </div>

          {/* Factors */}
          {prediction.factors.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-zinc-400 text-[10px] uppercase tracking-wider">Key Factors</span>
              <div className="mt-1.5 space-y-1">
                {prediction.factors.slice(0, 3).map((factor, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={clsx(
                      "mt-0.5",
                      factor.impact === "positive" ? "text-emerald-400" :
                      factor.impact === "negative" ? "text-rose-400" : "text-zinc-400"
                    )}>
                      {factor.impact === "positive" ? "↑" : factor.impact === "negative" ? "↓" : "→"}
                    </span>
                    <span className="text-zinc-300 text-[11px]">{factor.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {prediction.reasoning && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                💡 {prediction.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AIInsightCardProps {
  title: string
  avgScore: number
  bullishCount: number
  bearishCount: number
  totalDeals: number
  topOpportunity?: string | null
  riskAlert?: string | null
}

export function AIInsightCard({
  title,
  avgScore,
  bullishCount,
  bearishCount,
  totalDeals,
  topOpportunity,
  riskAlert
}: AIInsightCardProps) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-purple-500/20">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-medium">
          AI POWERED
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Avg Score */}
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Avg Score</div>
          <div className={clsx(
            "text-xl font-bold",
            avgScore >= 60 ? "text-emerald-400" :
            avgScore >= 40 ? "text-amber-400" : "text-rose-400"
          )}>
            {avgScore.toFixed(0)}
          </div>
        </div>

        {/* Bullish */}
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Bullish</div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xl font-bold text-emerald-400">{bullishCount}</span>
          </div>
        </div>

        {/* Bearish */}
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">Bearish</div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4 text-rose-400" />
            <span className="text-xl font-bold text-rose-400">{bearishCount}</span>
          </div>
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
          <span>Market Sentiment</span>
          <span>{totalDeals} deals analyzed</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-700 overflow-hidden flex">
          <div 
            className="h-full bg-emerald-500"
            style={{ width: `${totalDeals > 0 ? (bullishCount / totalDeals) * 100 : 50}%` }}
          />
          <div 
            className="h-full bg-rose-500"
            style={{ width: `${totalDeals > 0 ? (bearishCount / totalDeals) * 100 : 50}%` }}
          />
        </div>
      </div>

      {/* Top Opportunity */}
      {topOpportunity && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Top Opportunity
          </div>
          <p className="text-[11px] text-zinc-300">{topOpportunity}</p>
        </div>
      )}

      {/* Risk Alert */}
      {riskAlert && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Risk Alert
          </div>
          <p className="text-[11px] text-zinc-300">{riskAlert}</p>
        </div>
      )}
    </div>
  )
}
