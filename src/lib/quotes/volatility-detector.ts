import { BSEAnnouncement } from "../bse/types";

interface PricePoint {
  price: number;
  timestamp: string;
}

export interface VolatilityDetection {
  symbol: string;
  isVolatile: boolean;
  changePercent: number;
  period: '15m' | '1h' | '1d';
  drivingAnnouncement?: BSEAnnouncement;
}

/**
 * Detects if a price change is significant enough to be considered volatile
 */
export function detectVolatility(
  currentPrice: number,
  previousPrice: number,
  threshold: number = 2.0
): { isVolatile: boolean; changePercent: number } {
  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  return {
    isVolatile: Math.abs(changePercent) >= threshold,
    changePercent
  };
}

/**
 * Correlates price volatility with recent announcements to find a "Driving Event"
 */
export function findDrivingEvent(
  volatility: { changePercent: number; timestamp: string },
  announcements: BSEAnnouncement[],
  timeWindowMs: number = 4 * 60 * 60 * 1000 // 4 hours
): BSEAnnouncement | undefined {
  const volatileTime = new Date(volatility.timestamp).getTime();
  
  // Filter announcements within the time window
  const relevantAnnouncements = announcements.filter(ann => {
    const annTime = new Date(ann.time).getTime();
    const timeDiff = Math.abs(volatileTime - annTime);
    return timeDiff <= timeWindowMs;
  });

  if (relevantAnnouncements.length === 0) return undefined;

  // Prioritize announcements by impact and relevance to price move direction
  // For now, return the latest high-impact announcement or just the most recent one
  const highImpact = relevantAnnouncements.find(ann => ann.impact === 'high');
  if (highImpact) return highImpact;

  const mediumImpact = relevantAnnouncements.find(ann => ann.impact === 'medium');
  if (mediumImpact) return mediumImpact;

  return relevantAnnouncements[0];
}

/**
 * Generates a "Why" summary for a price move
 */
export async function generateWhySummary(
  symbol: string,
  changePercent: number,
  announcement: BSEAnnouncement
): Promise<string> {
  // This would ideally call an AI service, but for now we can generate a headline-based one
  // or use the AI summary if available.
  const direction = changePercent > 0 ? "spike" : "drop";
  const amount = Math.abs(changePercent).toFixed(1);
  
  // Basic logic to extract core reason from headline
  let reason = announcement.headline;
  if (announcement.summary && announcement.summary.length < 100) {
    reason = announcement.summary;
  }
  
  // Summarize for the badge (e.g., "Reliance acquisition of X")
  // In a real implementation, we'd use LLM here.
  return `₹${amount}% ${direction} caused by ${reason.slice(0, 50)}...`;
}
