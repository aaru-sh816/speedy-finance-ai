/**
 * AI Deal Predictions
 * ML-inspired model to predict which bulk deals will be winners
 */

export interface DealFeatures {
  // Investor features
  investorType: "individual" | "institutional" | "unknown"
  investorHistoricalWinRate: number // 0-100
  investorAvgReturn: number // percentage
  investorTotalDeals: number
  
  // Deal features
  side: "BUY" | "SELL"
  dealValue: number
  priceToMarketCap?: number
  volumeSpike?: number // vs average
  
  // Stock features
  sector?: string
  marketCap?: number
  pe?: number
  weekHigh52Distance?: number // % from 52w high
  weekLow52Distance?: number // % from 52w low
  
  // Market features
  marketTrend?: "bullish" | "bearish" | "neutral"
  sectorTrend?: "bullish" | "bearish" | "neutral"
}

export interface DealPrediction {
  score: number // 0-100 probability of success
  confidence: "high" | "medium" | "low"
  factors: PredictionFactor[]
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
  reasoning: string
}

export interface PredictionFactor {
  name: string
  impact: "positive" | "negative" | "neutral"
  weight: number // 0-1
  description: string
}

// Weights for different factors (learned from historical data patterns)
const FACTOR_WEIGHTS = {
  investorWinRate: 0.25,
  investorType: 0.15,
  dealSize: 0.10,
  pricePosition: 0.20,
  marketTrend: 0.15,
  volumeSignal: 0.15,
}

// Known successful investor patterns
const SUCCESSFUL_INVESTOR_PATTERNS = [
  { namePattern: /jhunjhunwala/i, bonusScore: 15 },
  { namePattern: /khanna/i, bonusScore: 12 },
  { namePattern: /kedia/i, bonusScore: 10 },
  { namePattern: /damani/i, bonusScore: 15 },
  { namePattern: /kacholia/i, bonusScore: 10 },
]

/**
 * Calculate prediction score for a bulk deal
 */
export function predictDealSuccess(features: DealFeatures, investorName?: string): DealPrediction {
  const factors: PredictionFactor[] = []
  let totalScore = 50 // Start at neutral
  
  // 1. Investor Win Rate Factor
  if (features.investorHistoricalWinRate > 0) {
    const winRateScore = (features.investorHistoricalWinRate - 50) * FACTOR_WEIGHTS.investorWinRate
    totalScore += winRateScore
    
    factors.push({
      name: "Investor Track Record",
      impact: features.investorHistoricalWinRate >= 60 ? "positive" : 
              features.investorHistoricalWinRate <= 40 ? "negative" : "neutral",
      weight: FACTOR_WEIGHTS.investorWinRate,
      description: `${features.investorHistoricalWinRate.toFixed(0)}% historical win rate`
    })
  }
  
  // 2. Investor Type Factor
  const investorTypeScores = {
    individual: 8, // Individual investors often have better track record
    institutional: 5,
    unknown: 0
  }
  totalScore += investorTypeScores[features.investorType] * FACTOR_WEIGHTS.investorType
  
  factors.push({
    name: "Investor Type",
    impact: features.investorType === "individual" ? "positive" : "neutral",
    weight: FACTOR_WEIGHTS.investorType,
    description: features.investorType === "individual" 
      ? "Individual investor - often indicates conviction bet"
      : "Institutional investor - may be portfolio rebalancing"
  })
  
  // 3. Deal Size Factor (Big deals often signal conviction)
  const dealSizeScore = features.dealValue >= 1e8 ? 10 : // >= 10 Cr
                        features.dealValue >= 5e7 ? 5 :  // >= 5 Cr
                        features.dealValue >= 1e7 ? 2 : 0 // >= 1 Cr
  totalScore += dealSizeScore * FACTOR_WEIGHTS.dealSize
  
  if (features.dealValue >= 5e7) {
    factors.push({
      name: "Deal Size",
      impact: "positive",
      weight: FACTOR_WEIGHTS.dealSize,
      description: `Large deal (₹${(features.dealValue / 1e7).toFixed(1)} Cr) indicates high conviction`
    })
  }
  
  // 4. Price Position Factor (Buy near 52w low is often good)
  if (features.weekLow52Distance !== undefined && features.weekHigh52Distance !== undefined) {
    const isBuy = features.side === "BUY"
    
    if (isBuy && features.weekLow52Distance <= 20) {
      // Buying near 52w low - positive signal
      totalScore += 15 * FACTOR_WEIGHTS.pricePosition
      factors.push({
        name: "Price Position",
        impact: "positive",
        weight: FACTOR_WEIGHTS.pricePosition,
        description: `Buying ${features.weekLow52Distance.toFixed(0)}% above 52-week low - value territory`
      })
    } else if (isBuy && features.weekHigh52Distance <= 10) {
      // Buying near 52w high - negative signal
      totalScore -= 10 * FACTOR_WEIGHTS.pricePosition
      factors.push({
        name: "Price Position",
        impact: "negative",
        weight: FACTOR_WEIGHTS.pricePosition,
        description: `Buying ${features.weekHigh52Distance.toFixed(0)}% below 52-week high - expensive`
      })
    }
  }
  
  // 5. Market Trend Factor
  if (features.marketTrend) {
    const trendScores = {
      bullish: features.side === "BUY" ? 10 : -5,
      bearish: features.side === "BUY" ? -5 : 10,
      neutral: 0
    }
    totalScore += trendScores[features.marketTrend] * FACTOR_WEIGHTS.marketTrend
    
    factors.push({
      name: "Market Trend",
      impact: (features.marketTrend === "bullish" && features.side === "BUY") ||
              (features.marketTrend === "bearish" && features.side === "SELL") 
              ? "positive" : "neutral",
      weight: FACTOR_WEIGHTS.marketTrend,
      description: `${features.marketTrend.charAt(0).toUpperCase() + features.marketTrend.slice(1)} market trend`
    })
  }
  
  // 6. Volume Signal Factor
  if (features.volumeSpike && features.volumeSpike > 2) {
    totalScore += 8 * FACTOR_WEIGHTS.volumeSignal
    factors.push({
      name: "Volume Signal",
      impact: "positive",
      weight: FACTOR_WEIGHTS.volumeSignal,
      description: `${features.volumeSpike.toFixed(1)}x normal volume - strong interest`
    })
  }
  
  // 7. Known Successful Investor Bonus
  if (investorName) {
    for (const pattern of SUCCESSFUL_INVESTOR_PATTERNS) {
      if (pattern.namePattern.test(investorName)) {
        totalScore += pattern.bonusScore
        factors.push({
          name: "Star Investor",
          impact: "positive",
          weight: 0.15,
          description: "Historically successful investor with proven track record"
        })
        break
      }
    }
  }
  
  // Clamp score between 0-100
  totalScore = Math.max(0, Math.min(100, totalScore))
  
  // Determine confidence based on available data
  const availableFactors = factors.length
  const confidence: "high" | "medium" | "low" = 
    availableFactors >= 5 ? "high" :
    availableFactors >= 3 ? "medium" : "low"
  
  // Determine recommendation
  const recommendation: DealPrediction["recommendation"] =
    totalScore >= 75 ? "strong_buy" :
    totalScore >= 60 ? "buy" :
    totalScore >= 40 ? "hold" :
    totalScore >= 25 ? "sell" : "strong_sell"
  
  // Generate reasoning
  const topPositive = factors.filter(f => f.impact === "positive").slice(0, 2)
  const topNegative = factors.filter(f => f.impact === "negative").slice(0, 1)
  
  let reasoning = ""
  if (topPositive.length > 0) {
    reasoning += `Bullish: ${topPositive.map(f => f.description).join("; ")}. `
  }
  if (topNegative.length > 0) {
    reasoning += `Risk: ${topNegative.map(f => f.description).join("; ")}.`
  }
  if (!reasoning) {
    reasoning = "Neutral outlook based on available data."
  }
  
  return {
    score: Math.round(totalScore),
    confidence,
    factors,
    recommendation,
    reasoning: reasoning.trim()
  }
}

/**
 * Get prediction label and color
 */
export function getPredictionDisplay(prediction: DealPrediction): {
  label: string
  color: string
  bgColor: string
  emoji: string
} {
  const displays = {
    strong_buy: { label: "Strong Buy", color: "text-emerald-400", bgColor: "bg-emerald-500/10", emoji: "🚀" },
    buy: { label: "Buy", color: "text-green-400", bgColor: "bg-green-500/10", emoji: "📈" },
    hold: { label: "Hold", color: "text-amber-400", bgColor: "bg-amber-500/10", emoji: "⏸️" },
    sell: { label: "Sell", color: "text-orange-400", bgColor: "bg-orange-500/10", emoji: "📉" },
    strong_sell: { label: "Strong Sell", color: "text-rose-400", bgColor: "bg-rose-500/10", emoji: "🔻" },
  }
  return displays[prediction.recommendation]
}

/**
 * Calculate batch predictions for multiple deals
 */
export function predictDeals(deals: Array<{
  features: DealFeatures
  investorName?: string
}>): DealPrediction[] {
  return deals.map(d => predictDealSuccess(d.features, d.investorName))
}

/**
 * Get AI insight summary for a set of predictions
 */
export function getAIInsightSummary(predictions: DealPrediction[]): {
  avgScore: number
  bullishCount: number
  bearishCount: number
  topOpportunity: string | null
  riskAlert: string | null
} {
  if (predictions.length === 0) {
    return { avgScore: 50, bullishCount: 0, bearishCount: 0, topOpportunity: null, riskAlert: null }
  }
  
  const avgScore = predictions.reduce((sum, p) => sum + p.score, 0) / predictions.length
  const bullishCount = predictions.filter(p => p.score >= 60).length
  const bearishCount = predictions.filter(p => p.score < 40).length
  
  const sorted = [...predictions].sort((a, b) => b.score - a.score)
  const topOpportunity = sorted[0]?.score >= 70 ? sorted[0].reasoning : null
  const riskAlert = sorted[sorted.length - 1]?.score < 30 ? sorted[sorted.length - 1].reasoning : null
  
  return { avgScore, bullishCount, bearishCount, topOpportunity, riskAlert }
}
