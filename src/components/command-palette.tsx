'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Search,
  Command,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Star,
  FileText,
  BarChart3,
  Clock,
  Zap,
  Building2,
  X,
  Loader2,
  ArrowUpRight,
  Sparkles,
  Keyboard,
  Hash,
  Calendar,
  Activity,
  PieChart,
  ChevronRight,
  PenLine
} from 'lucide-react'
import { getWatchlist, addToWatchlist } from '@/lib/storage'
import { useNotes } from '@/hooks/useNotes'

interface SearchResult {
  scripCode: string
  symbol: string
  name: string
  group?: string
  sector?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { createNote, updateNote } = useNotes()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])
  const [watchlistItems, setWatchlistItems] = useState<string[]>([])

  // Quick actions
  const quickActions = [
    { id: 'portfolio', label: 'Go to Portfolio', icon: PieChart, shortcut: 'P', action: () => { router.push('/portfolio'); onClose() } },
    { id: 'watchlist', label: 'Go to Watchlist', icon: Star, shortcut: 'W', action: () => { router.push('/watchlist'); onClose() } },
    { id: 'notes', label: 'Go to Research Hub', icon: FileText, shortcut: 'N', action: () => { router.push('/apple-notes'); onClose() } },
    { id: 'bulk-deals', label: 'Bulk Deals', icon: BarChart3, shortcut: 'B', action: () => { router.push('/bulk-deals'); onClose() } },
    { id: 'market', label: 'Market Overview', icon: Activity, shortcut: 'M', action: () => { router.push('/market'); onClose() } },
    { id: 'screener', label: 'Stock Screener', icon: Search, shortcut: 'S', action: () => { router.push('/screener'); onClose() } },
  ]

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setResults([])
      setSelectedIndex(0)

      // Load recent searches
      const saved = localStorage.getItem('speedy-recent-searches')
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved).slice(0, 5))
        } catch { }
      }

      // Load watchlist items
      setWatchlistItems(getWatchlist().map(i => i.scripCode))
    }
  }, [isOpen])

  // Search stocks
  useEffect(() => {
    const searchStocks = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch(`/api/bse/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results?.slice(0, 8) || [])
        }
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(searchStocks, 200)
    return () => clearTimeout(debounce)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      // If query is present, the first item is "Create Note", so totalItems is results.length + 1
      const totalItems = query.trim()
        ? results.length + 1
        : quickActions.length + recentSearches.length

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % totalItems)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
          break
        case 'Enter':
          e.preventDefault()
          handleSelect(selectedIndex)
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, query, quickActions.length, recentSearches.length])

  const handleSelect = (index: number) => {
    if (query.trim()) {
      if (index === 0) {
        // Create Note Action
        const note = createNote(undefined, query.trim(), '')

        // Auto-tag if on a company page
        const match = pathname.match(/\/company\/(\d+)/)
        if (match) {
          const scripCode = match[1]
          updateNote(note.id, { scripCode })
        }

        router.push(`/apple-notes?noteId=${note.id}`)
        onClose()
        return
      }

      // Stock results (offset by 1 due to Create Note action)
      const stock = results[index - 1]
      if (stock) {
        saveToRecent(stock)
        router.push(`/company/${stock.scripCode}`)
        onClose()
      }
    } else {
      // Quick actions + recent
      if (index < quickActions.length) {
        quickActions[index].action()
      } else {
        const recentIndex = index - quickActions.length
        const stock = recentSearches[recentIndex]
        if (stock) {
          router.push(`/company/${stock.scripCode}`)
          onClose()
        }
      }
    }
  }

  const saveToRecent = (stock: SearchResult) => {
    const saved = localStorage.getItem('speedy-recent-searches')
    let recent: SearchResult[] = []
    if (saved) {
      try { recent = JSON.parse(saved) } catch { }
    }
    recent = [stock, ...recent.filter(r => r.scripCode !== stock.scripCode)].slice(0, 5)
    localStorage.setItem('speedy-recent-searches', JSON.stringify(recent))
  }

  const handleAddToWatchlist = (e: React.MouseEvent, stock: SearchResult) => {
    e.stopPropagation()
    addToWatchlist({
      scripCode: stock.scripCode,
      symbol: stock.symbol,
      name: stock.name,
    })
    setWatchlistItems(prev => [...prev, stock.scripCode])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-in slide-in-from-top-4 fade-in duration-300">
        {/* Main Container */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Search Input */}
          <div className="relative flex items-center border-b border-zinc-800">
            <div className="absolute left-5 flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              ) : (
                <Search className="h-5 w-5 text-zinc-500" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
              placeholder="Search stocks, navigate..."
              className="w-full bg-transparent py-5 pl-14 pr-5 text-lg text-white placeholder:text-zinc-500 outline-none"
            />
            <div className="absolute right-5 flex items-center gap-2">
              <kbd className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-500 font-mono">ESC</kbd>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.trim() ? (
              // Search Results
              <div className="p-2 space-y-1">
                {/* Always show Create Note when typing */}
                <button
                  onClick={() => handleSelect(0)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all group ${selectedIndex === 0
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : 'hover:bg-zinc-800/50 border border-transparent'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedIndex === 0 ? 'bg-cyan-500/20' : 'bg-zinc-800 group-hover:bg-cyan-500/20'
                    }`}>
                    <PenLine className={`h-6 w-6 transition-colors ${selectedIndex === 0 ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-cyan-400'
                      }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">Save to Research</span>
                      {pathname.includes('/company/') && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20">
                          Auto-tagged Context
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 truncate font-mono">"{query}"</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded-lg bg-black/50 border border-zinc-800 text-xs text-zinc-500 font-mono">
                      ↵
                    </kbd>
                  </div>
                </button>

                {results.length > 0 && <div className="h-px bg-zinc-800/50 my-2 mx-2" />}

                {results.length === 0 && !isLoading && (
                  <div className="py-8 text-center text-zinc-600">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No stocks found for "{query}"</p>
                  </div>
                )}

                {results.map((stock, i) => {
                  const isInWatchlist = watchlistItems.includes(stock.scripCode)
                  const index = i + 1 // Offset for Create Note
                  return (
                    <button
                      key={stock.scripCode}
                      onClick={() => handleSelect(index)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all group ${selectedIndex === index
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : 'hover:bg-zinc-800/50 border border-transparent'
                        }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                        <Building2 className="h-6 w-6 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-lg">{stock.symbol}</span>
                          {stock.sector && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs">
                              {stock.sector}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 truncate">{stock.name}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isInWatchlist && (
                          <button
                            onClick={(e) => handleAddToWatchlist(e, stock)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 transition-all opacity-0 group-hover:opacity-100"
                            title="Add to watchlist"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        {isInWatchlist && (
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        )}
                        <ChevronRight className={`h-5 w-5 transition-colors ${selectedIndex === index ? 'text-amber-400' : 'text-zinc-600'
                          }`} />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              // Quick Actions & Recent
              <div>
                {/* Quick Actions */}
                <div className="p-2">
                  <p className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Quick Actions</p>
                  {quickActions.map((action, index) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.id}
                        onClick={action.action}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${selectedIndex === index
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'hover:bg-zinc-800/50 border border-transparent'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedIndex === index ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="flex-1 text-white font-medium">{action.label}</span>
                        <kbd className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-500 font-mono">
                          {action.shortcut}
                        </kbd>
                      </button>
                    )
                  })}
                </div>

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="p-2 border-t border-zinc-800">
                    <p className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recent
                    </p>
                    {recentSearches.map((stock, i) => {
                      const index = quickActions.length + i
                      return (
                        <button
                          key={stock.scripCode}
                          onClick={() => handleSelect(index)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${selectedIndex === index
                              ? 'bg-amber-500/10 border border-amber-500/30'
                              : 'hover:bg-zinc-800/50 border border-transparent'
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedIndex === index ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                            }`}>
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-white">{stock.symbol}</span>
                            <p className="text-sm text-zinc-500 truncate">{stock.name}</p>
                          </div>
                          <ChevronRight className={`h-5 w-5 ${selectedIndex === index ? 'text-amber-400' : 'text-zinc-600'
                            }`} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono">↵</kbd>
                Select
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Sparkles className="h-3.5 w-3.5" />
              Speedy Finance
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Global Command Palette Provider
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    const handleOpenPalette = () => setIsOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('speedy:open-command-palette', handleOpenPalette)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('speedy:open-command-palette', handleOpenPalette)
    }
  }, [])

  return (
    <>
      {children}
      <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
