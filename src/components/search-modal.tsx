"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Plus, Star, TrendingUp, TrendingDown, Building2, Sparkles, ExternalLink, ArrowRight, Clock, FileText, Calendar, Newspaper, Landmark, Trash2, Megaphone, Filter, ChevronDown, Coins, Gift, Scissors, Users, Briefcase } from "lucide-react"
import clsx from "clsx"

interface SearchResult {
  symbol: string
  name: string
  exchange: "BSE" | "NSE" | "Both"
  type: "stock" | "etf" | "mf"
  scripCode?: string
  industry?: string
  sector?: string
  price?: number
  changePercent?: number
  instrumentToken?: number
  exchangeToken?: number
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectStock: (stock: SearchResult) => void
}

interface CorporateAction {
  id: string
  scripCode: string
  shortName: string
  longName: string
  purpose: string
  purposeType: string // dividend, bonus, split, rights, buyback, delisting
  exDate: string
  recordDate?: string
  dividendAmount?: number
  ratio?: string
}

// Event type filters for corporate actions
const EVENT_TYPES = [
  { id: 'all', label: 'All Events', icon: Calendar, color: 'text-zinc-400' },
  { id: 'dividend', label: 'Dividend', icon: Coins, color: 'text-blue-400' },
  { id: 'bonus', label: 'Bonus', icon: Gift, color: 'text-emerald-400' },
  { id: 'split', label: 'Split', icon: Scissors, color: 'text-amber-400' },
  { id: 'rights', label: 'Rights', icon: Users, color: 'text-purple-400' },
  { id: 'buyback', label: 'Buyback', icon: Briefcase, color: 'text-rose-400' },
]

// BSE Sectors with ISIN codes (from constants.py)
const BSE_SECTORS = [
  { name: 'Automobile', isin: 'IN020102001', label: 'Auto & Auto Components' },
  { name: 'Capital Goods', isin: 'IN070205008', label: 'Capital Goods' },
  { name: 'Chemicals', isin: 'IN010101001', label: 'Chemicals' },
  { name: 'Construction', isin: 'IN070101001', label: 'Construction' },
  { name: 'Construction Materials', isin: 'IN010203001', label: 'Construction Materials' },
  { name: 'Consumer Durables', isin: 'IN020201003', label: 'Consumer Durables' },
  { name: 'Consumer Services', isin: 'IN020601001', label: 'Consumer Services' },
  { name: 'Diversified', isin: 'IN120101001', label: 'Diversified' },
  { name: 'FMCG', isin: 'IN040101003', label: 'FMCG' },
  { name: 'Financial Services', isin: 'IN050103006', label: 'Financial Services' },
  { name: 'Healthcare', isin: 'IN060101001', label: 'Healthcare' },
  { name: 'IT', isin: 'IN080102001', label: 'Information Technology' },
  { name: 'Media', isin: 'IN020401001', label: 'Media & Entertainment' },
  { name: 'Metals', isin: 'IN010301001', label: 'Metals & Mining' },
  { name: 'Oil & Gas', isin: 'IN030103001', label: 'Oil, Gas & Fuels' },
  { name: 'Power', isin: 'IN110101002', label: 'Power' },
  { name: 'Realty', isin: 'IN020501001', label: 'Realty' },
  { name: 'Services', isin: 'IN090104002', label: 'Services' },
  { name: 'Telecom', isin: 'IN100101003', label: 'Telecommunication' },
  { name: 'Textiles', isin: 'IN020301002', label: 'Textiles' },
  { name: 'Utilities', isin: 'IN110201005', label: 'Utilities' },
]

interface Announcement {
  id: string
  scripCode: string
  company: string
  headline: string
  category: string
  subCategory?: string
  time: string
}

const TABS = [
  { id: "all", label: "All", icon: Search },
  { id: "stocks", label: "Stocks", icon: Building2 },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "corporate", label: "Corp Actions", icon: Calendar },
  { id: "favourites", label: "Favourites", icon: Star },
  { id: "news", label: "News", icon: Newspaper },
  { id: "mf", label: "Mutual Funds", icon: Landmark },
  { id: "history", label: "History", icon: Clock },
]

const SEARCH_HISTORY_KEY = "speedy-search-history"
const MAX_HISTORY = 10

// Popular stocks for quick suggestions (fallback when API fails)
const POPULAR_STOCKS: SearchResult[] = [
  { symbol: "RELIANCE", name: "RELIANCE INDUSTRIES LTD.", exchange: "Both", type: "stock", scripCode: "500325" },
  { symbol: "TCS", name: "TATA CONSULTANCY SERVICES LTD", exchange: "Both", type: "stock", scripCode: "532540" },
  { symbol: "INFY", name: "INFOSYS LIMITED", exchange: "Both", type: "stock", scripCode: "500209" },
  { symbol: "HDFCBANK", name: "HDFC BANK LTD", exchange: "Both", type: "stock", scripCode: "500180" },
  { symbol: "ICICIBANK", name: "ICICI BANK LTD", exchange: "Both", type: "stock", scripCode: "532174" },
  { symbol: "SBIN", name: "STATE BANK OF INDIA", exchange: "Both", type: "stock", scripCode: "500112" },
]

export function SearchModal({ isOpen, onClose, onSelectStock }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  
  // Additional data for tabs
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [corporateActions, setCorporateActions] = useState<CorporateAction[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [favourites, setFavourites] = useState<SearchResult[]>([])
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [showEventDropdown, setShowEventDropdown] = useState(false)
  
  // Load search history and favourites from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (history) {
        try {
          setSearchHistory(JSON.parse(history))
        } catch (e) {
          console.error('Failed to parse search history')
        }
      }
      const favs = localStorage.getItem('speedy-favourites')
      if (favs) {
        try {
          setFavourites(JSON.parse(favs))
        } catch (e) {
          console.error('Failed to parse favourites')
        }
      }
    }
  }, [isOpen])
  
  // Add to search history
  const addToHistory = useCallback((term: string) => {
    if (!term.trim()) return
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.toLowerCase() !== term.toLowerCase())
      const updated = [term, ...filtered].slice(0, MAX_HISTORY)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])
  
  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }, [])
  
  // Toggle favourite
  const toggleFavourite = useCallback((stock: SearchResult) => {
    setFavourites(prev => {
      const exists = prev.find(f => f.scripCode === stock.scripCode)
      let updated: SearchResult[]
      if (exists) {
        updated = prev.filter(f => f.scripCode !== stock.scripCode)
      } else {
        updated = [...prev, stock]
      }
      localStorage.setItem('speedy-favourites', JSON.stringify(updated))
      return updated
    })
  }, [])
  
  // Check if stock is favourite
  const isFavourite = useCallback((scripCode?: string) => {
    if (!scripCode) return false
    return favourites.some(f => f.scripCode === scripCode)
  }, [favourites])

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (results.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          const stock = results[highlightedIndex]
          if (stock.scripCode) {
            handleNavigateToCompany(stock.scripCode, query)
          }
        }
        break
      case "Escape":
        e.preventDefault()
        onClose()
        break
    }
  }, [results, highlightedIndex, onClose, query])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-result-item]')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex])

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [results])

  // Navigate to company page
  const handleNavigateToCompany = (scripCode: string, searchTerm?: string) => {
    if (searchTerm) addToHistory(searchTerm)
    onClose()
    setQuery("")
    router.push(`/company/${scripCode}`)
  }
  
  // Fetch recent announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await fetch('/api/bse/announcements')
      if (response.ok) {
        const data = await response.json()
        setAnnouncements((data.announcements || []).slice(0, 20))
      }
    } catch (e) {
      console.error('Failed to fetch announcements')
    }
  }, [])
  
  // Fetch corporate actions
  const fetchCorporateActions = useCallback(async () => {
    try {
      const response = await fetch('/api/bse/corporate-actions?days=30')
      if (response.ok) {
        const data = await response.json()
        setCorporateActions((data.actions || []).slice(0, 20))
      }
    } catch (e) {
      console.error('Failed to fetch corporate actions')
    }
  }, [])
  
  // Load data when tab changes
  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'announcements' && announcements.length === 0) {
      fetchAnnouncements()
    } else if (activeTab === 'corporate' && corporateActions.length === 0) {
      fetchCorporateActions()
    }
  }, [activeTab, isOpen, announcements.length, corporateActions.length, fetchAnnouncements, fetchCorporateActions])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Dynamic search using BSE API
  const searchStocks = useCallback(async (searchQuery: string): Promise<SearchResult[]> => {
    const q = searchQuery.trim()
    if (!q) {
      setError(null)
      return []
    }
    
    try {
      setError(null)
      console.log(`[Search] Searching for: ${q}`)
      
      // Call BSE search API
      const response = await fetch(`/api/bse/search?q=${encodeURIComponent(q)}`)
      
      if (!response.ok) {
        setError(`Search failed (${response.status}). Please try again.`)
        throw new Error(`API returned ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`[Search] Got ${data.results?.length || 0} results`)
      
      if (data.error) {
        setError(data.error)
      }
      
      if (data.results && data.results.length > 0) {
        // Map BSE API response to our SearchResult format
        return data.results.map((r: any) => ({
          symbol: r.symbol,
          name: r.name || r.symbol,
          exchange: r.exchange || "BSE",
          type: r.type || "stock",
          scripCode: r.scripCode
        }))
      }
      
      // Fallback to local popular stocks filter
      const localResults = POPULAR_STOCKS.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q.toLowerCase()) ||
          s.name.toLowerCase().includes(q.toLowerCase())
      )
      
      if (localResults.length > 0) {
        return localResults
      }
      
      // Return empty - BSE API found nothing
      return []
      
    } catch (error: any) {
      console.error("[Search] Error:", error)
      setError(error.message || "Search failed. Showing local results.")
      // Fallback to local popular stocks on error
      return POPULAR_STOCKS.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q.toLowerCase()) ||
          s.name.toLowerCase().includes(q.toLowerCase())
      )
    }
  }, [])

  useEffect(() => {
    if (query.length >= 1) {
      setIsLoading(true)
      const timer = setTimeout(async () => {
        const searchResults = await searchStocks(query)
        setResults(searchResults)
        setIsLoading(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setResults([])
    }
  }, [query, searchStocks])

  if (!isOpen) return null

  const handleSelect = (stock: SearchResult) => {
    onSelectStock(stock)
    onClose()
    setQuery("")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl mx-4 rounded-2xl glass-card overflow-hidden shadow-2xl">
        {/* Search Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search companies, scrip codes, announcements…"
              aria-label="Search companies, scrip codes, announcements"
              className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-cyan-500/30 focus:border-transparent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Clear
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-white/5">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const count = tab.id === 'announcements' ? announcements.length : 
                          tab.id === 'corporate' ? corporateActions.length :
                          tab.id === 'favourites' ? favourites.length :
                          tab.id === 'history' ? searchHistory.length : 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  activeTab === tab.id 
                    ? "bg-white/10 text-white" 
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-96 overflow-y-auto scrollbar-thin">
          {isLoading && results.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-4 my-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {!isLoading && query.length > 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p>No results found for "{query}"</p>
              <p className="text-xs mt-2 text-zinc-500">Try searching by company name or BSE scrip code</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="divide-y divide-white/5">
              {results.map((stock, index) => (
                <div
                  key={`${stock.symbol}-${index}`}
                  data-result-item
                  className={clsx(
                    "flex items-center justify-between p-4 transition-all duration-200 group cursor-pointer",
                    index === highlightedIndex 
                      ? "bg-cyan-500/10 border-l-2 border-l-cyan-500" 
                      : "hover:bg-white/5 border-l-2 border-l-transparent"
                  )}
                  onClick={() => stock.scripCode && handleNavigateToCompany(stock.scripCode, query)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Clickable main area - navigates to company page */}
                  <div className="flex items-center gap-4 flex-1">
                    {/* Stock Icon */}
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold transition-transform",
                      index === highlightedIndex 
                        ? "bg-gradient-to-br from-cyan-400 to-purple-400 scale-110" 
                        : "bg-gradient-to-br from-cyan-500/80 to-purple-500/80"
                    )}>
                      {stock.symbol.charAt(0)}
                    </div>
                    
                    {/* Stock Info */}
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          "font-semibold transition-colors",
                          index === highlightedIndex ? "text-cyan-400" : "text-white group-hover:text-cyan-400"
                        )}>
                          {stock.symbol}
                        </span>
                        {stock.scripCode && (
                          <span className="text-zinc-500 text-xs bg-white/5 px-1.5 py-0.5 rounded">({stock.scripCode})</span>
                        )}
                      </div>
                      <p className="text-zinc-400 text-sm line-clamp-1 truncate">{stock.name}</p>
                      {/* Industry & Sector */}
                      {(stock.industry || stock.sector) && (
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {stock.industry}{stock.industry && stock.sector && " • "}{stock.sector}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Price Display */}
                    {stock.price != null && (
                      <div className="text-right mr-2">
                        <div className="font-semibold text-white tabular-nums">
                          ₹{stock.price.toLocaleString()}
                        </div>
                        {stock.changePercent != null && (
                          <div className={clsx(
                            "flex items-center justify-end gap-1 text-xs font-medium",
                            stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {stock.changePercent >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Exchange Badges */}
                    <div className="flex flex-col gap-1">
                      {(stock.exchange === "BSE" || stock.exchange === "Both") && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-semibold">
                          BSE
                        </span>
                      )}
                      {(stock.exchange === "NSE" || stock.exchange === "Both") && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-[10px] font-semibold">
                          NSE
                        </span>
                      )}
                    </div>
                    
                    {/* Add to Watchlist */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavourite(stock)
                      }}
                      className={clsx(
                        "p-2 rounded-lg transition-all",
                        isFavourite(stock.scripCode)
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-white/5 text-zinc-400 hover:bg-amber-500/10 hover:text-amber-400"
                      )}
                      title={isFavourite(stock.scripCode) ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {isFavourite(stock.scripCode) ? <Star className="h-4 w-4 fill-current" /> : <Plus className="h-4 w-4" />}
                    </button>
                    
                    {/* Navigate Arrow */}
                    <div className={clsx(
                      "p-2 rounded-lg transition-all",
                      index === highlightedIndex 
                        ? "bg-cyan-500/20 text-cyan-400" 
                        : "bg-white/5 text-zinc-400 group-hover:bg-cyan-500/10 group-hover:text-cyan-400"
                    )}>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab-Specific Content */}
          {!isLoading && query.length === 0 && (activeTab === 'all' || activeTab === 'stocks') && (
            <div className="p-6 space-y-5">
              {/* Trending Stocks */}
              <div>
                <div className="text-sm text-zinc-400 font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Trending Stocks
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {POPULAR_STOCKS.slice(0, 6).map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => stock.scripCode && handleNavigateToCompany(stock.scripCode, stock.symbol)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/50 to-purple-500/50 flex items-center justify-center text-white font-bold text-sm">
                        {stock.symbol.charAt(0)}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-medium text-white text-sm group-hover:text-cyan-400 transition-colors truncate">
                          {stock.symbol}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">{stock.name.split(" ").slice(0, 2).join(" ")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Quick Search */}
              <div>
                <div className="text-sm text-zinc-400 font-medium mb-3">Quick Search</div>
                <div className="flex flex-wrap gap-2">
                  {["RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN", "TATAMOTORS"].map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setQuery(symbol)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-zinc-300 text-sm hover:bg-cyan-500/10 hover:text-cyan-400 transition-all"
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* BSE Sectors */}
              <div>
                <div className="text-sm text-zinc-400 font-medium mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  Browse by Sector
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BSE_SECTORS.slice(0, 12).map((sector) => (
                    <button
                      key={sector.isin}
                      onClick={() => setQuery(sector.name)}
                      className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 transition-all group"
                    >
                      <p className="font-medium text-white text-xs group-hover:text-purple-400 transition-colors truncate">
                        {sector.label}
                      </p>
                      <p className="text-[9px] text-zinc-500 mt-0.5 truncate">ISIN: {sector.isin}</p>
                    </button>
                  ))}
                </div>
                {BSE_SECTORS.length > 12 && (
                  <button 
                    className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    onClick={() => {/* Could expand to show all sectors */}}
                  >
                    View all {BSE_SECTORS.length} sectors →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <div className="p-4 space-y-2">
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Megaphone className="h-12 w-12 mb-3 opacity-50" />
                  <p>Loading announcements...</p>
                </div>
              ) : (
                announcements.map((ann) => {
                  const h = (ann.headline || '').toLowerCase()
                  const tags: { key: string; label: string; cls: string }[] = []
                  const add = (key: string, label: string, cls: string) => {
                    if (!tags.find(t => t.key === key)) tags.push({ key, label, cls })
                  }
                  if (/order|directions?|penalty|fine|sebi/.test(h)) add('order', 'Order', 'text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold')
                  if (/appoint/.test(h)) add('appointment', 'Appointment', 'text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400')
                  if (/resign/.test(h)) add('resignation', 'Resignation', 'text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400')
                  if (/allot|preferential|warrant|qip/.test(h)) add('allotment', 'Allotment', 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400')
                  return (
                    <button
                      key={ann.id}
                      onClick={() => handleNavigateToCompany(ann.scripCode, ann.company)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                          {ann.category}
                        </span>
                        {ann.subCategory && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-medium">
                            {ann.subCategory}
                          </span>
                        )}
                        {tags.map(t => (
                          <span key={t.key} className={t.cls}>{t.label}</span>
                        ))}
                        <span className="text-[10px] text-zinc-500 ml-auto">
                          {new Date(ann.time).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <p className="text-sm text-white line-clamp-1">{ann.headline}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">{ann.company}</p>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {/* Corporate Actions Tab */}
          {activeTab === 'corporate' && (
            <div className="p-4 space-y-3">
              {/* Header with Event Type Filter */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Recent Corporate Events</h3>
                
                {/* Event Type Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowEventDropdown(!showEventDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {EVENT_TYPES.find(e => e.id === eventTypeFilter)?.label || 'All Events'}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  
                  {showEventDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-xl overflow-hidden">
                      {EVENT_TYPES.map((type) => {
                        const Icon = type.icon
                        return (
                          <button
                            key={type.id}
                            onClick={() => {
                              setEventTypeFilter(type.id)
                              setShowEventDropdown(false)
                            }}
                            className={clsx(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                              eventTypeFilter === type.id 
                                ? "bg-cyan-500/20 text-cyan-400" 
                                : "text-zinc-300 hover:bg-white/5"
                            )}
                          >
                            <Icon className={clsx("h-4 w-4", type.color)} />
                            {type.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Corporate Actions List */}
              {corporateActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Calendar className="h-12 w-12 mb-3 opacity-50" />
                  <p>Loading corporate actions...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {corporateActions
                    .filter(a => eventTypeFilter === 'all' || a.purposeType === eventTypeFilter)
                    .map((action) => {
                      const typeConfig = EVENT_TYPES.find(t => t.id === action.purposeType) || EVENT_TYPES[0]
                      const Icon = typeConfig.icon
                      const bgColor = action.purposeType === 'dividend' ? 'bg-blue-500/10' : 
                                      action.purposeType === 'bonus' ? 'bg-emerald-500/10' : 
                                      action.purposeType === 'split' ? 'bg-amber-500/10' : 
                                      action.purposeType === 'rights' ? 'bg-purple-500/10' : 
                                      action.purposeType === 'buyback' ? 'bg-rose-500/10' : 'bg-white/5'
                      
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleNavigateToCompany(action.scripCode, action.shortName)}
                          className={clsx(
                            "w-full text-left p-3 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-all",
                            bgColor
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar with Initial */}
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm flex-shrink-0">
                              {action.shortName?.charAt(0) || '?'}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {/* Company Name & Date */}
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-white text-sm">{action.shortName}</span>
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {action.exDate}
                                </span>
                              </div>
                              
                              {/* Company Long Name */}
                              <p className="text-[10px] text-zinc-400 mb-1.5 line-clamp-1">{action.longName}</p>
                              
                              {/* Purpose */}
                              <p className="text-xs text-zinc-300">{action.purpose}</p>
                              
                              {/* Metadata Row */}
                              <div className="flex items-center gap-2 mt-2">
                                {/* Type Badge */}
                                <span className={clsx(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium",
                                  typeConfig.color,
                                  action.purposeType === 'dividend' ? 'bg-blue-500/20' : 
                                  action.purposeType === 'bonus' ? 'bg-emerald-500/20' : 
                                  action.purposeType === 'split' ? 'bg-amber-500/20' : 
                                  action.purposeType === 'rights' ? 'bg-purple-500/20' : 
                                  action.purposeType === 'buyback' ? 'bg-rose-500/20' : 'bg-zinc-500/20'
                                )}>
                                  <Icon className="h-3 w-3" />
                                  {action.purposeType.charAt(0).toUpperCase() + action.purposeType.slice(1)}
                                </span>
                                
                                {/* Dividend Amount */}
                                {action.dividendAmount && (
                                  <span className="text-[10px] text-blue-400 font-medium">₹{action.dividendAmount}</span>
                                )}
                                
                                {/* Ratio */}
                                {action.ratio && (
                                  <span className="text-[10px] text-emerald-400 font-medium">{action.ratio}</span>
                                )}
                                
                                {/* Record Date */}
                                {action.recordDate && (
                                  <span className="text-[10px] text-zinc-500">Record: {action.recordDate}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  }
                  
                  {/* No results for filter */}
                  {corporateActions.filter(a => eventTypeFilter === 'all' || a.purposeType === eventTypeFilter).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                      <Calendar className="h-10 w-10 mb-2 opacity-50" />
                      <p className="text-sm">No {eventTypeFilter} events found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Favourites Tab */}
          {activeTab === 'favourites' && (
            <div className="p-4">
              {favourites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Star className="h-12 w-12 mb-3 opacity-50" />
                  <p>No favourites yet</p>
                  <p className="text-xs mt-1">Click the + button on any stock to add it</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {favourites.map((stock) => (
                    <div
                      key={stock.scripCode}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 transition-all cursor-pointer"
                      onClick={() => stock.scripCode && handleNavigateToCompany(stock.scripCode)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/50 to-orange-500/50 flex items-center justify-center text-white font-bold text-sm">
                          {stock.symbol.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{stock.symbol}</p>
                          <p className="text-[10px] text-zinc-500">{stock.name}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavourite(stock)
                        }}
                        className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
                      >
                        <Star className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-4">
              {searchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Clock className="h-12 w-12 mb-3 opacity-50" />
                  <p>No search history yet</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-zinc-400">Recent Searches</span>
                    <button
                      onClick={clearHistory}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term)
                          setActiveTab('all')
                        }}
                        className="px-3 py-2 rounded-lg bg-white/5 text-zinc-300 text-sm hover:bg-cyan-500/10 hover:text-cyan-400 transition-all flex items-center gap-2"
                      >
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {term}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* News Tab - Coming Soon */}
          {activeTab === 'news' && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <Newspaper className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">News Coming Soon</p>
              <p className="text-xs mt-1">Real-time market news will be available here</p>
            </div>
          )}

          {/* Mutual Funds Tab - Coming Soon */}
          {activeTab === 'mf' && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <Landmark className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">Mutual Funds Coming Soon</p>
              <p className="text-xs mt-1">Search and track mutual funds here</p>
            </div>
          )}
        </div>
        
        {/* Keyboard Shortcuts Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">Esc</kbd>
              Close
            </span>
          </div>
          <span className="text-zinc-400">Speedy Stox AI</span>
        </div>
      </div>
    </div>
  )
}
