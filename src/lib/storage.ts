export const STORAGE_KEYS = {
  watchlist: 'speedy-watchlist-v2',
  notes: 'speedy-notes-v2',
  favourites: 'speedy-favourites',
  searchHistory: 'speedy-search-history',
  settings: 'speedy-settings',
  priceAlerts: 'speedy-price-alerts',
  calendarPreferences: 'speedy-calendar-preferences',
} as const

export interface WatchlistGroup {
  id: string
  name: string
  color: string
  order: number
  isCollapsed: boolean
}

export interface WatchlistItem {
  scripCode: string
  symbol: string
  name: string
  addedAt: string
  order: number
  groupId?: string
  alertPrice?: number
  alertDirection?: 'above' | 'below'
  customColor?: string
  targetPrice?: number
  stopLoss?: number
  avgBuyPrice?: number
  quantity?: number
}

export interface StockNote {
  id: string
  scripCode: string
  symbol: string
  companyName: string
  title: string
  content: string
  tags: string[]
  priceAtNote?: number
  announcementId?: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  sentiment?: 'bullish' | 'bearish' | 'neutral'
  template?: 'earnings' | 'technical' | 'fundamental' | 'news' | 'custom'
  priceTarget?: number
  stopLoss?: number
  timeframe?: 'short' | 'medium' | 'long'
  confidence?: 1 | 2 | 3 | 4 | 5
  linkedNotes?: string[]
  attachments?: { name: string; url: string }[]
}

export interface PriceAlert {
  id: string
  scripCode: string
  symbol: string
  targetPrice: number
  direction: 'above' | 'below'
  createdAt: string
  triggered: boolean
  triggeredAt?: string
  note?: string
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'system'
  watchlistPosition: 'right' | 'left' | 'bottom'
  autoRefreshInterval: number
  showMiniCharts: boolean
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getWatchlist(): WatchlistItem[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.watchlist)
    if (data) return JSON.parse(data)
    const oldFavourites = localStorage.getItem(STORAGE_KEYS.favourites)
    if (oldFavourites) {
      const favs = JSON.parse(oldFavourites) as Array<{ scripCode: string; symbol: string; name: string }>
      const migrated: WatchlistItem[] = favs.map((f, i) => ({
        scripCode: f.scripCode,
        symbol: f.symbol,
        name: f.name,
        addedAt: new Date().toISOString(),
        order: i,
      }))
      saveWatchlist(migrated)
      return migrated
    }
    return []
  } catch {
    return []
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: items }))
}

export function addToWatchlist(item: Omit<WatchlistItem, 'addedAt' | 'order'>): WatchlistItem[] {
  const current = getWatchlist()
  if (current.some(i => i.scripCode === item.scripCode)) return current
  const newItem: WatchlistItem = {
    ...item,
    addedAt: new Date().toISOString(),
    order: current.length,
  }
  const updated = [...current, newItem]
  saveWatchlist(updated)
  return updated
}

export function removeFromWatchlist(scripCode: string): WatchlistItem[] {
  const current = getWatchlist()
  const updated = current.filter(i => i.scripCode !== scripCode)
  saveWatchlist(updated)
  return updated
}

export function isInWatchlist(scripCode: string): boolean {
  return getWatchlist().some(i => i.scripCode === scripCode)
}

export function reorderWatchlist(scripCode: string, newOrder: number): WatchlistItem[] {
  const current = getWatchlist()
  const itemIndex = current.findIndex(i => i.scripCode === scripCode)
  if (itemIndex === -1) return current
  const [item] = current.splice(itemIndex, 1)
  current.splice(newOrder, 0, item)
  const updated = current.map((i, idx) => ({ ...i, order: idx }))
  saveWatchlist(updated)
  return updated
}

export function getNotes(): StockNote[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.notes)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveNotes(notes: StockNote[]): void {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes))
  window.dispatchEvent(new CustomEvent('notes-updated', { detail: notes }))
}

export function getNotesByScripCode(scripCode: string): StockNote[] {
  return getNotes().filter(n => n.scripCode === scripCode)
}

export function addNote(note: Omit<StockNote, 'id' | 'createdAt' | 'updatedAt'>): StockNote[] {
  const current = getNotes()
  const newNote: StockNote = {
    ...note,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const updated = [newNote, ...current]
  saveNotes(updated)
  return updated
}

export function updateNote(id: string, updates: Partial<Omit<StockNote, 'id' | 'createdAt'>>): StockNote[] {
  const current = getNotes()
  const updated = current.map(n => 
    n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
  )
  saveNotes(updated)
  return updated
}

export function deleteNote(id: string): StockNote[] {
  const current = getNotes()
  const updated = current.filter(n => n.id !== id)
  saveNotes(updated)
  return updated
}

export function toggleNotePin(id: string): StockNote[] {
  const current = getNotes()
  const updated = current.map(n => 
    n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
  )
  saveNotes(updated)
  return updated
}

export function getPriceAlerts(): PriceAlert[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.priceAlerts)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function savePriceAlerts(alerts: PriceAlert[]): void {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEYS.priceAlerts, JSON.stringify(alerts))
}

export function addPriceAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>): PriceAlert[] {
  const current = getPriceAlerts()
  const newAlert: PriceAlert = {
    ...alert,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    triggered: false,
  }
  const updated = [...current, newAlert]
  savePriceAlerts(updated)
  return updated
}

export function deletePriceAlert(id: string): PriceAlert[] {
  const current = getPriceAlerts()
  const updated = current.filter(a => a.id !== id)
  savePriceAlerts(updated)
  return updated
}

export function checkPriceAlerts(quotes: Record<string, { price: number }>): PriceAlert[] {
  const alerts = getPriceAlerts()
  let hasTriggered = false
  const updated = alerts.map(alert => {
    if (alert.triggered) return alert
    const quote = quotes[alert.scripCode]
    if (!quote) return alert
    const shouldTrigger = 
      (alert.direction === 'above' && quote.price >= alert.targetPrice) ||
      (alert.direction === 'below' && quote.price <= alert.targetPrice)
    if (shouldTrigger) {
      hasTriggered = true
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`Price Alert: ${alert.symbol}`, {
          body: `${alert.symbol} has ${alert.direction === 'above' ? 'risen above' : 'fallen below'} ₹${alert.targetPrice}`,
          icon: '/favicon.ico',
        })
      }
      return { ...alert, triggered: true, triggeredAt: new Date().toISOString() }
    }
    return alert
  })
  if (hasTriggered) savePriceAlerts(updated)
  return updated
}

export function exportAllData(): string {
  return JSON.stringify({
    watchlist: getWatchlist(),
    notes: getNotes(),
    priceAlerts: getPriceAlerts(),
    watchlistGroups: getWatchlistGroups(),
    calendarPreferences: getCalendarPreferences(),
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString)
    if (data.watchlist) saveWatchlist(data.watchlist)
    if (data.notes) saveNotes(data.notes)
    if (data.priceAlerts) savePriceAlerts(data.priceAlerts)
    if (data.watchlistGroups) saveWatchlistGroups(data.watchlistGroups)
    if (data.calendarPreferences) {
      localStorage.setItem(STORAGE_KEYS.calendarPreferences, JSON.stringify(data.calendarPreferences))
    }
    return true
  } catch {
    return false
  }
}

const WATCHLIST_GROUPS_KEY = 'speedy-watchlist-groups'

export function getWatchlistGroups(): WatchlistGroup[] {
  if (!isBrowser()) return []
  try {
    const data = localStorage.getItem(WATCHLIST_GROUPS_KEY)
    return data ? JSON.parse(data) : getDefaultGroups()
  } catch {
    return getDefaultGroups()
  }
}

function getDefaultGroups(): WatchlistGroup[] {
  return [
    { id: 'default', name: 'My Stocks', color: '#f59e0b', order: 0, isCollapsed: false },
  ]
}

export function saveWatchlistGroups(groups: WatchlistGroup[]): void {
  if (!isBrowser()) return
  localStorage.setItem(WATCHLIST_GROUPS_KEY, JSON.stringify(groups))
  window.dispatchEvent(new CustomEvent('watchlist-groups-updated', { detail: groups }))
}

export function createWatchlistGroup(name: string, color: string): WatchlistGroup[] {
  const current = getWatchlistGroups()
  const newGroup: WatchlistGroup = {
    id: crypto.randomUUID(),
    name,
    color,
    order: current.length,
    isCollapsed: false,
  }
  const updated = [...current, newGroup]
  saveWatchlistGroups(updated)
  return updated
}

export function updateWatchlistGroup(id: string, updates: Partial<Omit<WatchlistGroup, 'id'>>): WatchlistGroup[] {
  const current = getWatchlistGroups()
  const updated = current.map(g => g.id === id ? { ...g, ...updates } : g)
  saveWatchlistGroups(updated)
  return updated
}

export function deleteWatchlistGroup(id: string): WatchlistGroup[] {
  if (id === 'default') return getWatchlistGroups()
  const current = getWatchlistGroups()
  const updated = current.filter(g => g.id !== id)
  saveWatchlistGroups(updated)
  const watchlist = getWatchlist()
  const updatedWatchlist = watchlist.map(item => 
    item.groupId === id ? { ...item, groupId: 'default' } : item
  )
  saveWatchlist(updatedWatchlist)
  return updated
}

export function moveToGroup(scripCode: string, groupId: string): WatchlistItem[] {
  const current = getWatchlist()
  const updated = current.map(item => 
    item.scripCode === scripCode ? { ...item, groupId } : item
  )
  saveWatchlist(updated)
  return updated
}

export function updateWatchlistItem(scripCode: string, updates: Partial<Omit<WatchlistItem, 'scripCode'>>): WatchlistItem[] {
  const current = getWatchlist()
  const updated = current.map(item =>
    item.scripCode === scripCode ? { ...item, ...updates } : item
  )
  saveWatchlist(updated)
  return updated
}

// ─── Calendar preferences ─────────────────────────────────────────────────────

export interface CalendarPreferences {
  weekStartsOn: 0 | 1
  timezone: string
  calendarFilterWatchlistId: string | 'all'
}

const DEFAULT_CALENDAR_PREFS: CalendarPreferences = {
  weekStartsOn: 1,
  timezone: 'Asia/Kolkata',
  calendarFilterWatchlistId: 'all',
}

export function getCalendarPreferences(): CalendarPreferences {
  if (!isBrowser()) return DEFAULT_CALENDAR_PREFS
  try {
    const data = localStorage.getItem(STORAGE_KEYS.calendarPreferences)
    if (data) {
      const parsed = JSON.parse(data) as Partial<CalendarPreferences>
      return { ...DEFAULT_CALENDAR_PREFS, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULT_CALENDAR_PREFS
}

export function setCalendarPreferences(updates: Partial<CalendarPreferences>): void {
  if (!isBrowser()) return
  const current = getCalendarPreferences()
  const next = { ...current, ...updates }
  localStorage.setItem(STORAGE_KEYS.calendarPreferences, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('calendar-preferences-updated', { detail: next }))
}

export const NOTE_TEMPLATES = {
  earnings: {
    title: 'Q{Q} FY{FY} Earnings Analysis',
    content: `## Key Metrics
- Revenue: 
- Net Profit: 
- EPS: 
- Margins: 

## YoY Comparison
- Revenue Growth: 
- Profit Growth: 

## Management Commentary


## My Take


## Action
- [ ] Buy
- [ ] Hold
- [ ] Sell
- [ ] Watch`,
    tags: ['earnings', 'results'],
  },
  technical: {
    title: 'Technical Setup',
    content: `## Chart Pattern


## Key Levels
- Resistance: 
- Support: 
- Stop Loss: 
- Target: 

## Indicators
- RSI: 
- MACD: 
- Volume: 

## Trade Setup
- Entry: 
- Target: 
- Stop Loss: 
- Risk/Reward: `,
    tags: ['technical', 'chart'],
  },
  fundamental: {
    title: 'Fundamental Analysis',
    content: `## Business Overview


## Competitive Advantage


## Financials
- P/E: 
- P/B: 
- ROE: 
- Debt/Equity: 

## Growth Drivers


## Risks


## Valuation
- Fair Value: 
- Current Price: 
- Margin of Safety: `,
    tags: ['fundamental', 'valuation'],
  },
  news: {
    title: 'News/Event Impact',
    content: `## Event


## Impact on Business


## Market Reaction


## My Assessment


## Action Required
`,
    tags: ['news', 'event'],
  },
}
