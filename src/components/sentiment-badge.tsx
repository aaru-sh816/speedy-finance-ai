"use client"

import { useMemo } from "react"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, AlertCircle, Zap, Shield, Flame } from "lucide-react"

export type SentimentType = "bullish" | "neutral" | "bearish"
export type RiskLevel = "critical" | "high" | "medium" | "low" | "none"

export interface SentimentAnalysis {
  sentiment: SentimentType
  confidence: number
  riskLevel: RiskLevel
  riskFlags: string[]
  signals: string[]
}

const RISK_KEYWORDS = {
  critical: [
    "fire", "explosion", "accident", "disaster", "death", "fatality",
    "remand", "arrest", "custody", "criminal", "fraud", "scam",
    "insolvency", "bankruptcy", "default", "winding up", "liquidation",
    "sebi penalty", "sebi order", "debarred", "suspended", "delisted",
    "forensic audit", "embezzlement", "misappropriation"
  ],
  high: [
    "investigation", "audit concern", "auditor resignation", "auditor resigned",
    "ceo resigned", "cfo resigned", "managing director resigned", "promoter selling",
    "significant loss", "material weakness", "going concern", "show cause",
    "penalty", "fine", "litigation", "legal proceedings", "nclt", "regulatory action"
  ],
  medium: [
    "resignation", "stepping down", "delay", "postpone", "decline", "lower",
    "warning", "downgrade", "miss", "impairment", "write-off", "loss",
    "debt concern", "liquidity issue", "challenging environment"
  ]
}

const POSITIVE_SIGNALS = [
  "record profit", "highest ever", "all-time high", "beat estimates", "exceeded expectations",
  "bonus shares", "special dividend", "interim dividend", "buyback",
  "acquisition completed", "merger approved", "strategic partnership",
  "order win", "major contract", "new order", "expansion", "capacity addition",
  "debt-free", "credit upgrade", "strong guidance", "outperform",
  "breakthrough", "regulatory approval", "patent granted"
]

const NEGATIVE_SIGNALS = [
  "loss widened", "profit declined", "revenue drop", "margin pressure",
  "order cancellation", "project delay", "cost overrun",
  "market share loss", "competition intensified", "demand weakness"
]

export function analyzeSentiment(text: string): SentimentAnalysis {
  const lower = text.toLowerCase()
  
  let positiveScore = 0
  let negativeScore = 0
  const signals: string[] = []
  const riskFlags: string[] = []
  let riskLevel: RiskLevel = "none"
  
  for (const keyword of RISK_KEYWORDS.critical) {
    if (lower.includes(keyword)) {
      riskLevel = "critical"
      riskFlags.push(keyword)
      negativeScore += 5
    }
  }
  
  if (riskLevel !== "critical") {
    for (const keyword of RISK_KEYWORDS.high) {
      if (lower.includes(keyword)) {
        riskLevel = riskLevel === "none" ? "high" : riskLevel
        riskFlags.push(keyword)
        negativeScore += 3
      }
    }
  }
  
  if (riskLevel === "none") {
    for (const keyword of RISK_KEYWORDS.medium) {
      if (lower.includes(keyword)) {
        riskLevel = "medium"
        riskFlags.push(keyword)
        negativeScore += 1
      }
    }
  }
  
  for (const signal of POSITIVE_SIGNALS) {
    if (lower.includes(signal)) {
      signals.push(signal)
      positiveScore += 2
    }
  }
  
  for (const signal of NEGATIVE_SIGNALS) {
    if (lower.includes(signal)) {
      signals.push(signal)
      negativeScore += 2
    }
  }
  
  let sentiment: SentimentType
  let confidence: number
  
  const totalScore = positiveScore - negativeScore
  
  if (riskLevel === "critical") {
    sentiment = "bearish"
    confidence = 95
  } else if (totalScore >= 4) {
    sentiment = "bullish"
    confidence = Math.min(90, 60 + totalScore * 5)
  } else if (totalScore <= -4) {
    sentiment = "bearish"
    confidence = Math.min(90, 60 + Math.abs(totalScore) * 5)
  } else {
    sentiment = "neutral"
    confidence = 50 + Math.abs(totalScore) * 5
  }
  
  if (riskLevel === "none" && negativeScore === 0 && positiveScore === 0) {
    riskLevel = "low"
  }
  
  return {
    sentiment,
    confidence,
    riskLevel,
    riskFlags: [...new Set(riskFlags)].slice(0, 3),
    signals: [...new Set(signals)].slice(0, 3)
  }
}

interface SentimentBadgeProps {
  text: string
  compact?: boolean
  showRisk?: boolean
  className?: string
}

export function SentimentBadge({ text, compact = false, showRisk = true, className = "" }: SentimentBadgeProps) {
  const analysis = useMemo(() => analyzeSentiment(text), [text])
  
  const sentimentConfig = {
    bullish: {
      icon: TrendingUp,
      label: "Bullish",
      emoji: "🟢",
      bgClass: "bg-emerald-500/15",
      borderClass: "border-emerald-500/30",
      textClass: "text-emerald-400"
    },
    neutral: {
      icon: Minus,
      label: "Neutral",
      emoji: "⚪",
      bgClass: analysis.confidence >= 80 ? "bg-cyan-500/15" : "bg-zinc-500/15",
      borderClass: analysis.confidence >= 80 ? "border-cyan-500/30" : "border-zinc-500/30",
      textClass: analysis.confidence >= 80 ? "text-cyan-400" : "text-zinc-400"
    },
    bearish: {
      icon: TrendingDown,
      label: "Bearish",
      emoji: "🔴",
      bgClass: "bg-rose-500/15",
      borderClass: "border-rose-500/30",
      textClass: "text-rose-400"
    }
  }
  
  const riskConfig = {
    critical: {
      icon: Flame,
      label: "CRITICAL RISK",
      bgClass: "bg-red-600/20",
      borderClass: "border-red-500/50",
      textClass: "text-red-400",
      pulse: true
    },
    high: {
      icon: AlertTriangle,
      label: "High Risk",
      bgClass: "bg-orange-500/15",
      borderClass: "border-orange-500/30",
      textClass: "text-orange-400",
      pulse: false
    },
    medium: {
      icon: AlertCircle,
      label: "Caution",
      bgClass: "bg-amber-500/15",
      borderClass: "border-amber-500/30",
      textClass: "text-amber-400",
      pulse: false
    },
    low: {
      icon: Shield,
      label: "Low Risk",
      bgClass: "bg-emerald-500/10",
      borderClass: "border-emerald-500/20",
      textClass: "text-emerald-400/70",
      pulse: false
    },
    none: {
      icon: Shield,
      label: "Safe",
      bgClass: "bg-zinc-500/10",
      borderClass: "border-zinc-500/20",
      textClass: "text-zinc-500",
      pulse: false
    }
  }
  
  const sConfig = sentimentConfig[analysis.sentiment]
  const rConfig = riskConfig[analysis.riskLevel]
  const SentimentIcon = sConfig.icon
  const RiskIcon = rConfig.icon
  
  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span 
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${sConfig.bgClass} ${sConfig.textClass}`}
          title={`${sConfig.label} (${analysis.confidence}% confidence)`}
        >
          {sConfig.emoji}
        </span>
        {showRisk && analysis.riskLevel !== "none" && analysis.riskLevel !== "low" && (
          <span 
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${rConfig.bgClass} ${rConfig.textClass} ${rConfig.pulse ? "animate-pulse" : ""}`}
            title={`${rConfig.label}: ${analysis.riskFlags.join(", ")}`}
          >
            <RiskIcon className="h-3 w-3" />
          </span>
        )}
      </div>
    )
  }
  
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${sConfig.bgClass} ${sConfig.borderClass}`}>
        <span className="text-base">{sConfig.emoji}</span>
        <span className={`text-xs font-semibold ${sConfig.textClass}`}>{sConfig.label}</span>
        <span className={`text-[10px] ${sConfig.textClass} opacity-70`}>{analysis.confidence}%</span>
      </div>
      
      {showRisk && analysis.riskLevel !== "none" && analysis.riskLevel !== "low" && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${rConfig.bgClass} ${rConfig.borderClass} ${rConfig.pulse ? "animate-pulse" : ""}`}>
          <RiskIcon className={`h-4 w-4 ${rConfig.textClass}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${rConfig.textClass}`}>{rConfig.label}</span>
          {analysis.riskFlags.length > 0 && (
            <span className={`text-[10px] ${rConfig.textClass} opacity-70`}>
              ({analysis.riskFlags.slice(0, 2).join(", ")})
            </span>
          )}
        </div>
      )}
      
      {analysis.signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.signals.map((signal, i) => (
            <span 
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                POSITIVE_SIGNALS.includes(signal) 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              <Zap className="h-2.5 w-2.5" />
              {signal}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function RiskAlert({ text, className = "" }: { text: string; className?: string }) {
  const analysis = useMemo(() => analyzeSentiment(text), [text])
  
  if (analysis.riskLevel === "none" || analysis.riskLevel === "low") {
    return null
  }
  
  const riskConfig = {
    critical: {
      icon: Flame,
      title: "🚨 CRITICAL RISK DETECTED",
      bgClass: "bg-red-950/50",
      borderClass: "border-red-500/50",
      textClass: "text-red-400",
      descClass: "text-red-300/80"
    },
    high: {
      icon: AlertTriangle,
      title: "⚠️ High Risk Alert",
      bgClass: "bg-orange-950/30",
      borderClass: "border-orange-500/30",
      textClass: "text-orange-400",
      descClass: "text-orange-300/80"
    },
    medium: {
      icon: AlertCircle,
      title: "⚡ Proceed with Caution",
      bgClass: "bg-amber-950/20",
      borderClass: "border-amber-500/20",
      textClass: "text-amber-400",
      descClass: "text-amber-300/70"
    }
  }
  
  const config = riskConfig[analysis.riskLevel as keyof typeof riskConfig]
  if (!config) return null
  
  const Icon = config.icon
  
  return (
    <div className={`rounded-xl p-4 border ${config.bgClass} ${config.borderClass} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bgClass}`}>
          <Icon className={`h-5 w-5 ${config.textClass} ${analysis.riskLevel === "critical" ? "animate-pulse" : ""}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold ${config.textClass}`}>{config.title}</h4>
          <p className={`text-xs mt-1 ${config.descClass}`}>
            {analysis.riskFlags.length > 0 
              ? `Detected: ${analysis.riskFlags.join(", ")}`
              : "Potential risk factors identified in this announcement."
            }
          </p>
          {analysis.riskLevel === "critical" && (
            <p className="text-[10px] text-red-400/60 mt-2 uppercase tracking-wider">
              This announcement may require immediate attention
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
