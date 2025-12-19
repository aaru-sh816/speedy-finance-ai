/**
 * Investor Alert System
 * Follow investors and get notifications when they make deals
 */

const STORAGE_KEY = "speedy_followed_investors"
const ALERTS_KEY = "speedy_investor_alerts"

export interface FollowedInvestor {
  name: string
  followedAt: string
  notifyOnBuy: boolean
  notifyOnSell: boolean
  notifyOnBigDeal: boolean // >= 10 Cr
}

export interface InvestorAlert {
  id: string
  investorName: string
  type: "buy" | "sell" | "big_deal"
  stockName: string
  scripCode: string
  value: number
  price: number
  quantity: number
  date: string
  createdAt: string
  read: boolean
}

// Get followed investors from localStorage
export function getFollowedInvestors(): FollowedInvestor[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// Save followed investors to localStorage
export function saveFollowedInvestors(investors: FollowedInvestor[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(investors))
  } catch (e) {
    console.warn("Failed to save followed investors:", e)
  }
}

// Follow an investor
export function followInvestor(
  name: string,
  options: { notifyOnBuy?: boolean; notifyOnSell?: boolean; notifyOnBigDeal?: boolean } = {}
): FollowedInvestor {
  const investors = getFollowedInvestors()
  const existing = investors.find(i => i.name.toLowerCase() === name.toLowerCase())
  
  if (existing) {
    // Update existing
    existing.notifyOnBuy = options.notifyOnBuy ?? existing.notifyOnBuy
    existing.notifyOnSell = options.notifyOnSell ?? existing.notifyOnSell
    existing.notifyOnBigDeal = options.notifyOnBigDeal ?? existing.notifyOnBigDeal
    saveFollowedInvestors(investors)
    return existing
  }
  
  const newInvestor: FollowedInvestor = {
    name,
    followedAt: new Date().toISOString(),
    notifyOnBuy: options.notifyOnBuy ?? true,
    notifyOnSell: options.notifyOnSell ?? true,
    notifyOnBigDeal: options.notifyOnBigDeal ?? true,
  }
  
  investors.push(newInvestor)
  saveFollowedInvestors(investors)
  return newInvestor
}

// Unfollow an investor
export function unfollowInvestor(name: string): boolean {
  const investors = getFollowedInvestors()
  const index = investors.findIndex(i => i.name.toLowerCase() === name.toLowerCase())
  
  if (index === -1) return false
  
  investors.splice(index, 1)
  saveFollowedInvestors(investors)
  return true
}

// Check if an investor is followed
export function isFollowing(name: string): boolean {
  const investors = getFollowedInvestors()
  return investors.some(i => i.name.toLowerCase() === name.toLowerCase())
}

// Get alerts from localStorage
export function getAlerts(): InvestorAlert[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(ALERTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// Save alerts to localStorage
export function saveAlerts(alerts: InvestorAlert[]): void {
  if (typeof window === "undefined") return
  try {
    // Keep only last 100 alerts
    const trimmed = alerts.slice(-100)
    localStorage.setItem(ALERTS_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.warn("Failed to save alerts:", e)
  }
}

// Create a new alert
export function createAlert(alert: Omit<InvestorAlert, "id" | "createdAt" | "read">): InvestorAlert {
  const newAlert: InvestorAlert = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    read: false,
  }
  
  const alerts = getAlerts()
  alerts.push(newAlert)
  saveAlerts(alerts)
  
  return newAlert
}

// Mark alert as read
export function markAlertRead(alertId: string): void {
  const alerts = getAlerts()
  const alert = alerts.find(a => a.id === alertId)
  if (alert) {
    alert.read = true
    saveAlerts(alerts)
  }
}

// Mark all alerts as read
export function markAllAlertsRead(): void {
  const alerts = getAlerts()
  alerts.forEach(a => a.read = true)
  saveAlerts(alerts)
}

// Get unread alert count
export function getUnreadAlertCount(): number {
  return getAlerts().filter(a => !a.read).length
}

// Clear all alerts
export function clearAlerts(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ALERTS_KEY)
}

// Check deals against followed investors and create alerts
export function checkDealsForAlerts(deals: Array<{
  clientName: string
  securityName: string
  scripCode: string
  side: string
  quantity: number
  price: number
  date: string
}>): InvestorAlert[] {
  const followedInvestors = getFollowedInvestors()
  const existingAlerts = getAlerts()
  const newAlerts: InvestorAlert[] = []
  
  for (const deal of deals) {
    const followed = followedInvestors.find(
      i => i.name.toLowerCase() === deal.clientName.toLowerCase()
    )
    
    if (!followed) continue
    
    const value = deal.quantity * deal.price
    const isBuy = deal.side?.toUpperCase() === "BUY"
    const isBigDeal = value >= 1e8 // >= 10 Cr
    
    // Check if alert already exists for this deal
    const alertKey = `${deal.date}|${deal.scripCode}|${deal.clientName}|${deal.side}`
    const alreadyExists = existingAlerts.some(
      a => `${a.date}|${a.scripCode}|${a.investorName}|${a.type}` === alertKey
    )
    
    if (alreadyExists) continue
    
    // Create alert based on preferences
    let shouldAlert = false
    let alertType: "buy" | "sell" | "big_deal" = isBuy ? "buy" : "sell"
    
    if (isBigDeal && followed.notifyOnBigDeal) {
      shouldAlert = true
      alertType = "big_deal"
    } else if (isBuy && followed.notifyOnBuy) {
      shouldAlert = true
      alertType = "buy"
    } else if (!isBuy && followed.notifyOnSell) {
      shouldAlert = true
      alertType = "sell"
    }
    
    if (shouldAlert) {
      const alert = createAlert({
        investorName: deal.clientName,
        type: alertType,
        stockName: deal.securityName,
        scripCode: deal.scripCode,
        value,
        price: deal.price,
        quantity: deal.quantity,
        date: deal.date,
      })
      newAlerts.push(alert)
    }
  }
  
  return newAlerts
}

// Request browser notification permission
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

// Show browser notification
export function showNotification(alert: InvestorAlert): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  
  const emoji = alert.type === "big_deal" ? "🔥" : alert.type === "buy" ? "📈" : "📉"
  const action = alert.type === "big_deal" ? "BIG DEAL" : alert.type.toUpperCase()
  
  const notification = new Notification(`${emoji} ${alert.investorName}`, {
    body: `${action}: ${alert.stockName} - ₹${(alert.value / 1e7).toFixed(2)} Cr`,
    icon: "/favicon.ico",
    tag: alert.id,
  })
  
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
