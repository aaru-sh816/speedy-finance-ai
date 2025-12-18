"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { stockService, StockSuggestion, StockDetails } from "@/services/stockService"

/**
 * Debounce hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Stock Search Hook
 * Provides search functionality with debouncing, loading states, and caching
 */
export function useStockSearch(debounceMs: number = 300) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  
  const debouncedQuery = useDebounce(query, debounceMs)
  const cacheRef = useRef<Map<string, StockSuggestion[]>>(new Map())

  // Search effect
  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length < 1) {
        setSuggestions([])
        setShowDropdown(false)
        return
      }

      // Check cache first
      const cached = cacheRef.current.get(debouncedQuery.toLowerCase())
      if (cached) {
        setSuggestions(cached)
        setShowDropdown(true)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const results = await stockService.searchStocks(debouncedQuery)
        setSuggestions(results)
        setShowDropdown(true)
        
        // Cache the results
        cacheRef.current.set(debouncedQuery.toLowerCase(), results)
      } catch (err: any) {
        setError(err.message || "Search failed")
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    search()
  }, [debouncedQuery])

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [suggestions])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          return suggestions[highlightedIndex]
        }
        break
      case "Escape":
        e.preventDefault()
        setShowDropdown(false)
        break
    }
    return null
  }, [suggestions, highlightedIndex])

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery("")
    setSuggestions([])
    setShowDropdown(false)
    setHighlightedIndex(-1)
    setError(null)
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    error,
    showDropdown,
    setShowDropdown,
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    clearSearch,
  }
}

/**
 * Stock Details Hook
 * Fetches and caches stock details
 */
export function useStockDetails(symbol: string | null, scripCode?: string) {
  const [details, setDetails] = useState<StockDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const cacheRef = useRef<Map<string, StockDetails>>(new Map())

  useEffect(() => {
    if (!symbol) {
      setDetails(null)
      return
    }

    const cacheKey = scripCode || symbol
    const cached = cacheRef.current.get(cacheKey)
    
    if (cached) {
      setDetails(cached)
      return
    }

    const fetchDetails = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await stockService.getStockDetails(symbol, scripCode)
        if (data) {
          setDetails(data)
          cacheRef.current.set(cacheKey, data)
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetails()
  }, [symbol, scripCode])

  // Refresh function
  const refresh = useCallback(async () => {
    if (!symbol) return

    setIsLoading(true)
    try {
      const data = await stockService.getStockDetails(symbol, scripCode)
      if (data) {
        setDetails(data)
        const cacheKey = scripCode || symbol
        cacheRef.current.set(cacheKey, data)
      }
    } catch (err: any) {
      setError(err.message || "Failed to refresh")
    } finally {
      setIsLoading(false)
    }
  }, [symbol, scripCode])

  return { details, isLoading, error, refresh }
}

/**
 * Quote Hook
 * Fetches real-time quotes with auto-refresh
 */
export function useQuote(symbol: string | null, exchange: "BSE" | "NSE" = "BSE", autoRefreshMs?: number) {
  const [quote, setQuote] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchQuote = useCallback(async () => {
    if (!symbol) return

    setIsLoading(true)
    try {
      const data = await stockService.getQuote(symbol, exchange)
      setQuote(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to fetch quote")
    } finally {
      setIsLoading(false)
    }
  }, [symbol, exchange])

  useEffect(() => {
    if (!symbol) {
      setQuote(null)
      return
    }

    fetchQuote()

    // Set up auto-refresh
    if (autoRefreshMs && autoRefreshMs > 0) {
      intervalRef.current = setInterval(fetchQuote, autoRefreshMs)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [symbol, exchange, autoRefreshMs, fetchQuote])

  return { quote, isLoading, error, refresh: fetchQuote }
}

/**
 * Corporate Actions Hook
 */
export function useCorporateActions(scripCode: string | null) {
  const [actions, setActions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scripCode) {
      setActions([])
      return
    }

    const fetchActions = async () => {
      setIsLoading(true)
      try {
        const data = await stockService.getCorporateActions(scripCode)
        setActions(data)
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to fetch corporate actions")
      } finally {
        setIsLoading(false)
      }
    }

    fetchActions()
  }, [scripCode])

  return { actions, isLoading, error }
}

export default useStockSearch
