'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  WatchlistItem,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  reorderWatchlist,
  checkPriceAlerts,
} from '@/lib/storage'

export interface WatchlistQuote {
  scripCode: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  lastUpdated: string
  isLoading: boolean
  error?: string
}

export interface UseWatchlistReturn {
  items: WatchlistItem[]
  quotes: Record<string, WatchlistQuote>
  isLoading: boolean
  add: (item: Omit<WatchlistItem, 'addedAt' | 'order'>) => void
  remove: (scripCode: string) => void
  reorder: (scripCode: string, newOrder: number) => void
  isInList: (scripCode: string) => boolean
  refresh: () => Promise<void>
}

export function useWatchlist(autoRefreshInterval = 30000): UseWatchlistReturn {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({})
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadWatchlist = useCallback(() => {
    const watchlist = getWatchlist()
    setItems(watchlist.sort((a, b) => a.order - b.order))
    return watchlist
  }, [])

  const fetchQuotes = useCallback(async (watchlistItems: WatchlistItem[]) => {
    if (watchlistItems.length === 0) {
      setIsLoading(false)
      return
    }

    const scripCodes = watchlistItems.map(i => i.scripCode)
    
    setQuotes(prev => {
      const updated = { ...prev }
      scripCodes.forEach(code => {
        if (!updated[code]) {
          const item = watchlistItems.find(i => i.scripCode === code)
          updated[code] = {
            scripCode: code,
            symbol: item?.symbol || '',
            name: item?.name || '',
            price: 0,
            change: 0,
            changePercent: 0,
            high: 0,
            low: 0,
            volume: 0,
            lastUpdated: '',
            isLoading: true,
          }
        } else {
          updated[code] = { ...updated[code], isLoading: true }
        }
      })
      return updated
    })

    try {
        const response = await fetch('/api/bse/quotes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: scripCodes }),
        })

        if (!response.ok) throw new Error('Failed to fetch quotes')

        const data = await response.json()
        const quotesArray = data.quotes || []
        
        setQuotes(prev => {
          const updated = { ...prev }
          
          for (const quote of quotesArray) {
            const q = quote as {
              symbol?: string
              price?: number | null
              change?: number | null
              changePercent?: number | null
              dayHigh?: number | null
              dayLow?: number | null
              volume?: number | null
              error?: string
            }
            const scripCode = q.symbol || ''
            const item = watchlistItems.find(i => i.scripCode === scripCode)
            
            if (q.error) {
              updated[scripCode] = {
                ...updated[scripCode],
                scripCode,
                symbol: item?.symbol || '',
                name: item?.name || '',
                isLoading: false,
                error: q.error,
              }
            } else {
              updated[scripCode] = {
                scripCode,
                symbol: item?.symbol || '',
                name: item?.name || '',
                price: q.price || 0,
                change: q.change || 0,
                changePercent: q.changePercent || 0,
                high: q.dayHigh || 0,
                low: q.dayLow || 0,
                volume: q.volume || 0,
                lastUpdated: new Date().toISOString(),
                isLoading: false,
              }
            }
          }

          for (const code of scripCodes) {
            if (!updated[code] || updated[code].isLoading) {
              updated[code] = {
                ...updated[code],
                scripCode: code,
                symbol: watchlistItems.find(i => i.scripCode === code)?.symbol || '',
                name: watchlistItems.find(i => i.scripCode === code)?.name || '',
                isLoading: false,
                error: 'Quote not available',
              }
            }
          }

          return updated
        })

        const priceMap: Record<string, { price: number }> = {}
        for (const quote of quotesArray) {
          const q = quote as { symbol?: string; price?: number | null }
          if (q.symbol && q.price) priceMap[q.symbol] = { price: q.price }
        }
        checkPriceAlerts(priceMap)

    } catch (error) {
      setQuotes(prev => {
        const updated = { ...prev }
        scripCodes.forEach(code => {
          updated[code] = {
            ...updated[code],
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch',
          }
        })
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    const watchlist = loadWatchlist()
    await fetchQuotes(watchlist)
  }, [loadWatchlist, fetchQuotes])

  const add = useCallback((item: Omit<WatchlistItem, 'addedAt' | 'order'>) => {
    const updated = addToWatchlist(item)
    setItems(updated)
    fetchQuotes(updated)
  }, [fetchQuotes])

  const remove = useCallback((scripCode: string) => {
    const updated = removeFromWatchlist(scripCode)
    setItems(updated)
    setQuotes(prev => {
      const { [scripCode]: _, ...rest } = prev
      return rest
    })
  }, [])

  const reorder = useCallback((scripCode: string, newOrder: number) => {
    const updated = reorderWatchlist(scripCode, newOrder)
    setItems(updated)
  }, [])

  const isInList = useCallback((scripCode: string) => {
    return isInWatchlist(scripCode)
  }, [])

  useEffect(() => {
    const watchlist = loadWatchlist()
    fetchQuotes(watchlist)

    const handleStorageChange = () => {
      const updated = loadWatchlist()
      fetchQuotes(updated)
    }

    window.addEventListener('watchlist-updated', handleStorageChange)
    window.addEventListener('storage', (e) => {
      if (e.key === 'speedy-watchlist-v2') handleStorageChange()
    })

    return () => {
      window.removeEventListener('watchlist-updated', handleStorageChange)
    }
  }, [loadWatchlist, fetchQuotes])

  useEffect(() => {
    if (autoRefreshInterval > 0 && items.length > 0) {
      intervalRef.current = setInterval(() => {
        fetchQuotes(items)
      }, autoRefreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefreshInterval, items, fetchQuotes])

  return {
    items,
    quotes,
    isLoading,
    add,
    remove,
    reorder,
    isInList,
    refresh,
  }
}
