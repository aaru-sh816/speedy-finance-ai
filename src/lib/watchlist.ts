"use client"

// Watchlist management with localStorage

export interface WatchlistItem {
  scripCode: string
  symbol: string
  companyName: string
  addedAt: string
}

const WATCHLIST_KEY = "speedy-finance-watchlist"
const PRICE_ALERTS_KEY = "speedy-finance-price-alerts"

// Get watchlist from localStorage
export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(WATCHLIST_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// Add item to watchlist
export function addToWatchlist(item: Omit<WatchlistItem, "addedAt">): boolean {
  if (typeof window === "undefined") return false
  try {
    const watchlist = getWatchlist()
    if (watchlist.some((w) => w.scripCode === item.scripCode)) {
      return false // Already exists
    }
    watchlist.push({ ...item, addedAt: new Date().toISOString() })
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
    return true
  } catch {
    return false
  }
}

// Remove item from watchlist
export function removeFromWatchlist(scripCode: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const watchlist = getWatchlist()
    const filtered = watchlist.filter((w) => w.scripCode !== scripCode)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered))
    return true
  } catch {
    return false
  }
}

// Check if item is in watchlist
export function isInWatchlist(scripCode: string): boolean {
  const watchlist = getWatchlist()
  return watchlist.some((w) => w.scripCode === scripCode)
}

// Price alerts
export interface PriceAlert {
  id: string
  scripCode: string
  symbol: string
  companyName: string
  targetPrice: number
  condition: "above" | "below"
  createdAt: string
  triggered: boolean
}

export function getPriceAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(PRICE_ALERTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addPriceAlert(alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">): PriceAlert {
  const newAlert: PriceAlert = {
    ...alert,
    id: Math.random().toString(36).substring(2, 9),
    createdAt: new Date().toISOString(),
    triggered: false,
  }
  
  if (typeof window === "undefined") return newAlert
  
  try {
    const alerts = getPriceAlerts()
    alerts.push(newAlert)
    localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts))
  } catch {
    // Ignore
  }
  
  return newAlert
}

export function removePriceAlert(id: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const alerts = getPriceAlerts()
    const filtered = alerts.filter((a) => a.id !== id)
    localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(filtered))
    return true
  } catch {
    return false
  }
}

export function markAlertTriggered(id: string): void {
  if (typeof window === "undefined") return
  try {
    const alerts = getPriceAlerts()
    const alert = alerts.find((a) => a.id === id)
    if (alert) {
      alert.triggered = true
      localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts))
    }
  } catch {
    // Ignore
  }
}

// Check price alerts against current price
export function checkPriceAlerts(scripCode: string, currentPrice: number): PriceAlert[] {
  const alerts = getPriceAlerts()
  const triggered: PriceAlert[] = []
  
  alerts.forEach((alert) => {
    if (alert.scripCode === scripCode && !alert.triggered) {
      if (
        (alert.condition === "above" && currentPrice >= alert.targetPrice) ||
        (alert.condition === "below" && currentPrice <= alert.targetPrice)
      ) {
        triggered.push(alert)
        markAlertTriggered(alert.id)
      }
    }
  })
  
  return triggered
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false
  }
  
  if (Notification.permission === "granted") {
    return true
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission()
    return permission === "granted"
  }
  
  return false
}

// Send browser notification
export function sendNotification(title: string, body: string, onClick?: () => void): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "speedy-finance",
      requireInteraction: true,
    })
    
    if (onClick) {
      notification.onclick = () => {
        window.focus()
        onClick()
        notification.close()
      }
    }
  }
}
