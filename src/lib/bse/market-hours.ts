/**
 * Utility to check Indian Stock Market (BSE/NSE) hours.
 * Market Hours: Monday to Friday, 09:15 AM to 03:30 PM IST.
 */

export interface MarketStatus {
  isOpen: boolean;
  isWeekend: boolean;
  isPreMarket: boolean;
  isPostMarket: boolean;
  serverTimeIST: string;
}

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
  const totalMinutes = hour * 60 + minute;
  const startMinutes = 9 * 60 + 15; // 09:15
  const endMinutes = 15 * 60 + 30;  // 15:30

  const isOpen = !isWeekend && totalMinutes >= startMinutes && totalMinutes <= endMinutes;
  const isPreMarket = !isWeekend && totalMinutes < startMinutes;
  const isPostMarket = !isWeekend && totalMinutes > endMinutes;

  return {
    isOpen,
    isWeekend,
    isPreMarket,
    isPostMarket,
    serverTimeIST: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
  };
}

/**
 * Hook-friendly version of market status check
 */
export function isMarketOpen(): boolean {
  return getMarketStatus().isOpen;
}
