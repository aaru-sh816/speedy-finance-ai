'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { 
  Star, 
  ChevronDown, 
  ChevronUp, 
  X, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  FileText,
  ExternalLink,
  GripVertical,
  Plus,
  Settings2,
  LayoutGrid,
  List,
  ChevronRight,
  Trash2,
  Columns,
  Grid3X3,
  Search,
  Command,
  Zap,
  Activity,
  AlertTriangle,
  Calendar,
  Volume2,
  Flame,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  BarChart2,
  Eye
} from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { 
  getNotesByScripCode, 
  getWatchlistGroups, 
  createWatchlistGroup, 
  updateWatchlistGroup, 
  deleteWatchlistGroup,
  moveToGroup,
  type WatchlistGroup,
  type WatchlistItem 
} from '@/lib/storage'
import { Sparkline, PriceTargetProgress } from '@/components/ui/sparkline'

type ViewMode = 'compact' | 'detailed' | 'cards' | 'table'

interface GroupedWatchlist {
  group: WatchlistGroup
  items: (WatchlistItem & { quote?: ReturnType<typeof useWatchlist>['quotes'][string] })[]
}

interface StockSignal {
  type: 'high_vol' | 'new_high' | 'new_low' | 'result_today' | 'breakout' | 'breakdown' | '52w_high' | '52w_low'
  label: string
  color: string
  icon: React.ReactNode
}

function getStockSignals(item: WatchlistItem, quote: ReturnType<typeof useWatchlist>['quotes'][string] | undefined): StockSignal[] {
  const signals: StockSignal[] = []
  if (!quote) return signals

  const changePercent = quote.changePercent || 0
  const volume = quote.volume || 0

  // High volume (simplified - in production you'd compare to average)
  if (volume > 1000000) {
    signals.push({
      type: 'high_vol',
      label: 'High Vol',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      icon: <Volume2 className="h-2.5 w-2.5" />
    })
  }

  // Big mover
  if (Math.abs(changePercent) > 3) {
    signals.push({
      type: changePercent > 0 ? 'breakout' : 'breakdown',
      label: changePercent > 0 ? 'Breaking Out' : 'Breaking Down',
      color: changePercent > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      icon: changePercent > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />
    })
  }

  // Near day high/low
  if (quote.high && quote.price) {
    const pctFromHigh = ((quote.high - quote.price) / quote.high) * 100
    if (pctFromHigh < 0.5) {
      signals.push({
        type: 'new_high',
        label: 'Day High',
        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: <Flame className="h-2.5 w-2.5" />
      })
    }
  }

  if (quote.low && quote.price) {
    const pctFromLow = ((quote.price - quote.low) / quote.low) * 100
    if (pctFromLow < 0.5) {
      signals.push({
        type: 'new_low',
        label: 'Day Low',
        color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        icon: <AlertTriangle className="h-2.5 w-2.5" />
      })
    }
  }

  return signals
}

export function WatchlistPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('detailed')
  const [groups, setGroups] = useState<WatchlistGroup[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({})
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({})
  const previousPrices = useRef<Record<string, number>>({})
  
  const { items, quotes, isLoading, remove, refresh } = useWatchlist(30000)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('speedy-watchlist-panel-open')
    if (saved === 'true') setIsOpen(true)
    const savedView = localStorage.getItem('speedy-watchlist-view-mode') as ViewMode
    if (savedView) setViewMode(savedView)
    setGroups(getWatchlistGroups())
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('speedy-watchlist-panel-open', String(isOpen))
    }
  }, [isOpen, mounted])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('speedy-watchlist-view-mode', viewMode)
    }
  }, [viewMode, mounted])

  // Price flash animation
  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down' | null> = {}
    
    Object.entries(quotes).forEach(([scripCode, quote]) => {
      const prevPrice = previousPrices.current[scripCode]
      const currentPrice = quote.price
      
      if (prevPrice && currentPrice && prevPrice !== currentPrice) {
        newFlashes[scripCode] = currentPrice > prevPrice ? 'up' : 'down'
      }
      
      if (currentPrice) {
        previousPrices.current[scripCode] = currentPrice
      }
    })
    
    if (Object.keys(newFlashes).length > 0) {
      setPriceFlash(prev => ({ ...prev, ...newFlashes }))
      
      // Clear flash after animation
      setTimeout(() => {
        setPriceFlash(prev => {
          const updated = { ...prev }
          Object.keys(newFlashes).forEach(key => {
            updated[key] = null
          })
          return updated
        })
      }, 600)
    }
  }, [quotes])

  // Fetch sparkline data for all items
  useEffect(() => {
    const fetchSparklines = async () => {
      const data: Record<string, number[]> = {}
      for (const item of items) {
        try {
          const res = await fetch(`/api/bse/history?scripCode=${item.scripCode}&days=7`)
          if (res.ok) {
            const json = await res.json()
            if (json.data?.length > 0) {
              data[item.scripCode] = json.data.map((d: { close: number }) => d.close)
            }
          }
        } catch {
          // Ignore errors
        }
      }
      setSparklineData(data)
    }
    if (items.length > 0 && mounted) {
      fetchSparklines()
    }
  }, [items, mounted])

  // Listen for keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'w' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444']
      const randomColor = colors[Math.floor(Math.random() * colors.length)]
      createWatchlistGroup(newGroupName.trim(), randomColor)
      setGroups(getWatchlistGroups())
      setNewGroupName('')
    }
  }

  const handleDeleteGroup = (groupId: string) => {
    deleteWatchlistGroup(groupId)
    setGroups(getWatchlistGroups())
  }

  const handleToggleGroupCollapse = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (group) {
      updateWatchlistGroup(groupId, { isCollapsed: !group.isCollapsed })
      setGroups(getWatchlistGroups())
    }
  }

  const handleDragStart = (scripCode: string) => {
    setDraggedItem(scripCode)
  }

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    setDragOverGroup(groupId)
  }

  const handleDrop = (groupId: string) => {
    if (draggedItem) {
      moveToGroup(draggedItem, groupId)
      setDraggedItem(null)
      setDragOverGroup(null)
    }
  }

  const groupedItems: GroupedWatchlist[] = groups.map(group => ({
    group,
    items: items
      .filter(item => (item.groupId || 'default') === group.id)
      .map(item => ({ ...item, quote: quotes[item.scripCode] }))
  }))

  const avgChange = items.length > 0 
    ? Object.values(quotes).reduce((sum, q) => sum + (q.changePercent || 0), 0) / items.length 
    : 0
  const gainers = Object.values(quotes).filter(q => (q.changePercent || 0) > 0).length
  const losers = Object.values(quotes).filter(q => (q.changePercent || 0) < 0).length

  if (!mounted) return null

  return (
    <>
      {/* UNIFIED FLOATING DOCK - LEFT SIDE (to avoid AI button on right) */}
      <div 
        className={`fixed z-50 transition-all duration-500 ease-out ${
          isOpen 
            ? 'bottom-[440px] left-4' 
            : 'bottom-6 left-6'
        }`}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group relative"
        >
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-2xl blur-xl transition-all duration-300 ${
            isOpen 
              ? 'bg-amber-500/30 scale-110' 
              : 'bg-amber-500/20 group-hover:bg-amber-500/30 group-hover:scale-110'
          }`} />
          
          {/* Main button */}
          <div className={`relative flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300 ${
            isOpen
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-2xl shadow-orange-500/40'
              : 'bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 hover:border-amber-500/50 shadow-2xl shadow-black/50'
          }`}>
            {/* Animated icon */}
            <div className={`relative transition-transform duration-300 ${isOpen ? 'rotate-12' : 'group-hover:rotate-12'}`}>
              <Star className={`h-5 w-5 transition-all ${isOpen ? 'fill-white text-white' : 'text-amber-400 fill-amber-400'}`} />
              {items.length > 0 && !isOpen && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              )}
            </div>
            
            <div className="flex flex-col items-start">
              <span className={`text-sm font-semibold transition-colors ${isOpen ? 'text-white' : 'text-zinc-200'}`}>
                Watchlist
              </span>
              {items.length > 0 && (
                <span className={`text-[10px] transition-colors ${isOpen ? 'text-white/70' : 'text-zinc-500'}`}>
                  {gainers}↑ {losers}↓ • {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
                </span>
              )}
            </div>
            
            {/* Count badge */}
            {items.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                isOpen ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {items.length}
              </span>
            )}
            
            {/* Keyboard hint */}
            <kbd className={`hidden group-hover:inline px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
              isOpen ? 'bg-white/20 text-white/70' : 'bg-zinc-800 text-zinc-500'
            }`}>
              W
            </kbd>
            
            {/* Chevron */}
            <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
              <ChevronUp className={`h-4 w-4 ${isOpen ? 'text-white/70' : 'text-zinc-500'}`} />
            </div>
          </div>
        </button>
      </div>

      {/* Main Panel - Slides up from bottom */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-500 ease-out ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* Glassmorphism Panel */}
        <div className="h-[440px] bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-800/50 shadow-2xl">
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Star className="h-5 w-5 text-white fill-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">My Watchlist</h2>
                  <p className="text-xs text-zinc-500">
                    {items.length} stocks • Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              {/* Live Stats */}
              {items.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <Activity className="h-3.5 w-3.5 text-zinc-500" />
                    <span className={`text-sm font-semibold ${avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="flex items-center gap-1 text-emerald-400 text-sm">
                      <TrendingUp className="h-3.5 w-3.5" /> {gainers}
                    </span>
                    <span className="text-zinc-700">/</span>
                    <span className="flex items-center gap-1 text-rose-400 text-sm">
                      <TrendingDown className="h-3.5 w-3.5" /> {losers}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                {[
                  { mode: 'compact' as ViewMode, icon: List, label: 'Compact' },
                  { mode: 'detailed' as ViewMode, icon: LayoutGrid, label: 'Detailed' },
                  { mode: 'cards' as ViewMode, icon: Grid3X3, label: 'Cards' },
                  { mode: 'table' as ViewMode, icon: Columns, label: 'Table' },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === mode 
                        ? 'bg-amber-500/20 text-amber-400' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-zinc-800 mx-2" />

              <button
                onClick={() => refresh()}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                title="Refresh prices"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showSettings 
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                    : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                }`}
                title="Settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              
              <Link
                href="/watchlist"
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
                title="Full watchlist page"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
              
              <button
                onClick={() => setIsOpen(false)}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-rose-500/20 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute top-20 right-6 w-80 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="font-semibold text-white">Watchlist Groups</h3>
                <p className="text-xs text-zinc-500 mt-1">Organize stocks into folders</p>
              </div>
              <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
                {groups.map(group => (
                  <div key={group.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: group.color }} />
                      <span className="text-sm text-white">{group.name}</span>
                    </div>
                    {group.id !== 'default' && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-zinc-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New group name..."
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                    className="flex-1 bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none border border-zinc-700 focus:border-amber-500/50 transition-colors"
                  />
                  <button
                    onClick={handleCreateGroup}
                    className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="h-[calc(100%-80px)] overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <EmptyState />
            ) : viewMode === 'table' ? (
              <TableView items={items} quotes={quotes} sparklineData={sparklineData} onRemove={remove} priceFlash={priceFlash} />
            ) : viewMode === 'compact' ? (
              <CompactView 
                groupedItems={groupedItems} 
                onToggleCollapse={handleToggleGroupCollapse}
                onRemove={remove}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                dragOverGroup={dragOverGroup}
                sparklineData={sparklineData}
                priceFlash={priceFlash}
              />
            ) : viewMode === 'cards' ? (
              <CardsView 
                groupedItems={groupedItems}
                onToggleCollapse={handleToggleGroupCollapse}
                onRemove={remove}
                sparklineData={sparklineData}
                priceFlash={priceFlash}
              />
            ) : (
              <DetailedView 
                groupedItems={groupedItems}
                onToggleCollapse={handleToggleGroupCollapse}
                onRemove={remove}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                dragOverGroup={dragOverGroup}
                sparklineData={sparklineData}
                priceFlash={priceFlash}
              />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes flash-up {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(16, 185, 129, 0.3); }
        }
        @keyframes flash-down {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.3); }
        }
        .flash-up {
          animation: flash-up 0.6s ease-out;
        }
        .flash-down {
          animation: flash-down 0.6s ease-out;
        }
      `}</style>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
      <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
        <Star className="h-10 w-10 opacity-20" />
      </div>
      <p className="text-base font-medium text-zinc-400">No stocks in watchlist</p>
      <p className="text-sm mt-2 text-zinc-600">Press <kbd className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-mono text-xs">Ctrl+K</kbd> to search and add stocks</p>
      <Link 
        href="/watchlist" 
        className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">Add Stocks</span>
      </Link>
    </div>
  )
}

interface ViewProps {
  groupedItems: GroupedWatchlist[]
  onToggleCollapse: (groupId: string) => void
  onRemove: (scripCode: string) => void
  onDragStart?: (scripCode: string) => void
  onDragOver?: (e: React.DragEvent, groupId: string) => void
  onDrop?: (groupId: string) => void
  dragOverGroup?: string | null
  sparklineData: Record<string, number[]>
  priceFlash: Record<string, 'up' | 'down' | null>
}

function SignalBadges({ item, quote }: { item: WatchlistItem; quote: ReturnType<typeof useWatchlist>['quotes'][string] | undefined }) {
  const signals = getStockSignals(item, quote)
  if (signals.length === 0) return null
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {signals.slice(0, 2).map((signal, i) => (
        <span 
          key={i}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${signal.color}`}
        >
          {signal.icon}
          {signal.label}
        </span>
      ))}
    </div>
  )
}

function CompactView({ groupedItems, onToggleCollapse, onRemove, onDragStart, onDragOver, onDrop, dragOverGroup, sparklineData, priceFlash }: ViewProps) {
  return (
    <div className="p-4">
      {groupedItems.map(({ group, items }) => (
        <div key={group.id} className="mb-3">
          <button
            onClick={() => onToggleCollapse(group.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <span>{group.name}</span>
            <span className="text-zinc-600 font-normal">({items.length})</span>
            <ChevronRight className={`h-3.5 w-3.5 ml-auto transition-transform ${group.isCollapsed ? '' : 'rotate-90'}`} />
          </button>
          
          {!group.isCollapsed && (
            <div 
              className={`mt-1 rounded-xl ${dragOverGroup === group.id ? 'bg-amber-500/10 border border-amber-500/30' : ''}`}
              onDragOver={(e) => onDragOver?.(e, group.id)}
              onDrop={() => onDrop?.(group.id)}
            >
              {items.map(item => {
                const isPositive = (item.quote?.changePercent || 0) >= 0
                const flash = priceFlash[item.scripCode]
                return (
                  <div
                    key={item.scripCode}
                    draggable
                    onDragStart={() => onDragStart?.(item.scripCode)}
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/50 rounded-xl cursor-move group transition-all ${
                      flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Link href={`/company/${item.scripCode}`} className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <span className="font-semibold text-white text-sm block truncate">{item.symbol}</span>
                        <SignalBadges item={item} quote={item.quote} />
                      </div>
                      <Sparkline data={sparklineData[item.scripCode] || []} width={60} height={20} showDot={false} />
                      <div className="ml-auto text-right">
                        <span className="text-sm font-medium text-white block">
                          ₹{item.quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                        </span>
                        <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{(item.quote?.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </Link>
                    <button
                      onClick={() => onRemove(item.scripCode)}
                      className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DetailedView({ groupedItems, onToggleCollapse, onRemove, onDragStart, onDragOver, onDrop, dragOverGroup, sparklineData, priceFlash }: ViewProps) {
  return (
    <div className="p-4">
      {groupedItems.map(({ group, items }) => (
        <div key={group.id} className="mb-4">
          <button
            onClick={() => onToggleCollapse(group.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <span>{group.name}</span>
            <span className="text-zinc-600 font-normal">({items.length})</span>
            <ChevronRight className={`h-3.5 w-3.5 ml-auto transition-transform ${group.isCollapsed ? '' : 'rotate-90'}`} />
          </button>
          
          {!group.isCollapsed && (
            <div 
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2 rounded-xl ${dragOverGroup === group.id ? 'bg-amber-500/10 border border-amber-500/30 p-2' : ''}`}
              onDragOver={(e) => onDragOver?.(e, group.id)}
              onDrop={() => onDrop?.(group.id)}
            >
              {items.map(item => {
                const notes = getNotesByScripCode(item.scripCode)
                const isPositive = (item.quote?.changePercent || 0) >= 0
                const hasTarget = item.targetPrice && item.quote?.price
                const flash = priceFlash[item.scripCode]

                return (
                  <div
                    key={item.scripCode}
                    draggable
                    onDragStart={() => onDragStart?.(item.scripCode)}
                    className={`group relative bg-zinc-900/50 hover:bg-zinc-800/80 rounded-xl p-4 transition-all border border-zinc-800/50 hover:border-zinc-700 cursor-move ${
                      flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''
                    }`}
                  >
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-zinc-600" />
                    </div>
                    
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/company/${item.scripCode}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base">{item.symbol}</span>
                          {notes.length > 0 && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] border border-cyan-500/30">
                              <FileText className="h-2.5 w-2.5" />
                              {notes.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{item.name}</p>
                        <SignalBadges item={item} quote={item.quote} />
                      </Link>
                      <button
                        onClick={() => onRemove(item.scripCode)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-2xl font-bold text-white">
                          ₹{item.quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                        </div>
                        <div className={`flex items-center gap-1.5 text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {isPositive ? '+' : ''}{(item.quote?.changePercent || 0).toFixed(2)}%
                        </div>
                      </div>
                      <Sparkline 
                        data={sparklineData[item.scripCode] || []} 
                        width={80} 
                        height={32}
                        showDot={true}
                      />
                    </div>

                    {hasTarget && (
                      <div className="mt-4 pt-3 border-t border-zinc-800">
                        <PriceTargetProgress
                          currentPrice={item.quote!.price}
                          targetPrice={item.targetPrice!}
                          entryPrice={item.avgBuyPrice}
                          stopLoss={item.stopLoss}
                          width={999}
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50 text-[11px] text-zinc-600">
                      <span>H: ₹{item.quote?.high?.toLocaleString('en-IN') || '—'}</span>
                      <span>L: ₹{item.quote?.low?.toLocaleString('en-IN') || '—'}</span>
                      <span>Vol: {item.quote?.volume ? (item.quote.volume / 1000).toFixed(0) + 'K' : '—'}</span>
                    </div>
                  </div>
                )
              })}
              
              <Link
                href="/watchlist"
                className="flex flex-col items-center justify-center bg-zinc-900/30 hover:bg-zinc-800/50 rounded-xl p-6 border border-dashed border-zinc-800 hover:border-amber-500/30 transition-all min-h-[160px] group"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-amber-500/20 flex items-center justify-center mb-3 transition-colors">
                  <Plus className="h-6 w-6 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">Add More</span>
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CardsView({ groupedItems, onToggleCollapse, onRemove, sparklineData, priceFlash }: ViewProps) {
  return (
    <div className="p-4">
      {groupedItems.map(({ group, items }) => (
        <div key={group.id} className="mb-4">
          <button
            onClick={() => onToggleCollapse(group.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <span>{group.name}</span>
            <span className="text-zinc-600 font-normal">({items.length})</span>
            <ChevronRight className={`h-3.5 w-3.5 ml-auto transition-transform ${group.isCollapsed ? '' : 'rotate-90'}`} />
          </button>
          
          {!group.isCollapsed && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-2">
              {items.map(item => {
                const isPositive = (item.quote?.changePercent || 0) >= 0
                const flash = priceFlash[item.scripCode]
                
                return (
                  <Link
                    key={item.scripCode}
                    href={`/company/${item.scripCode}`}
                    className={`group relative overflow-hidden rounded-xl p-4 transition-all hover:scale-[1.02] ${
                      isPositive 
                        ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40' 
                        : 'bg-gradient-to-br from-rose-500/15 to-rose-500/5 border border-rose-500/20 hover:border-rose-500/40'
                    } ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}
                  >
                    <button
                      onClick={(e) => { e.preventDefault(); onRemove(item.scripCode) }}
                      className="absolute top-2 right-2 p-1 rounded-lg hover:bg-black/30 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    
                    <div className="text-center">
                      <div className="font-bold text-white text-sm mb-1">{item.symbol}</div>
                      <div className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{(item.quote?.changePercent || 0).toFixed(2)}%
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        ₹{item.quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '—'}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface TableViewProps {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
  sparklineData: Record<string, number[]>
  onRemove: (scripCode: string) => void
  priceFlash: Record<string, 'up' | 'down' | null>
}

function TableView({ items, quotes, sparklineData, onRemove, priceFlash }: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-sm">
          <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
            <th className="px-4 py-3 text-left font-semibold">Symbol</th>
            <th className="px-4 py-3 text-left font-semibold">Name</th>
            <th className="px-4 py-3 text-left font-semibold">Signals</th>
            <th className="px-4 py-3 text-right font-semibold">Price</th>
            <th className="px-4 py-3 text-right font-semibold">Change</th>
            <th className="px-4 py-3 text-center font-semibold">7D</th>
            <th className="px-4 py-3 text-right font-semibold">High</th>
            <th className="px-4 py-3 text-right font-semibold">Low</th>
            <th className="px-4 py-3 text-right font-semibold">Volume</th>
            <th className="px-4 py-3 text-center font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {items.map(item => {
            const quote = quotes[item.scripCode]
            const isPositive = (quote?.changePercent || 0) >= 0
            const flash = priceFlash[item.scripCode]
            
            return (
              <tr 
                key={item.scripCode} 
                className={`hover:bg-zinc-800/30 transition-colors group ${
                  flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''
                }`}
              >
                <td className="px-4 py-3.5">
                  <Link href={`/company/${item.scripCode}`} className="font-semibold text-white hover:text-amber-400 transition-colors">
                    {item.symbol}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-zinc-400 truncate max-w-[180px]">{item.name}</td>
                <td className="px-4 py-3.5">
                  <SignalBadges item={item} quote={quote} />
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-white">
                  ₹{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                </td>
                <td className={`px-4 py-3.5 text-right font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {isPositive ? '+' : ''}{(quote?.changePercent || 0).toFixed(2)}%
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-center">
                    <Sparkline data={sparklineData[item.scripCode] || []} width={70} height={24} showDot={false} />
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-zinc-400">₹{quote?.high?.toLocaleString('en-IN') || '—'}</td>
                <td className="px-4 py-3.5 text-right text-zinc-400">₹{quote?.low?.toLocaleString('en-IN') || '—'}</td>
                <td className="px-4 py-3.5 text-right text-zinc-400">{quote?.volume?.toLocaleString('en-IN') || '—'}</td>
                <td className="px-4 py-3.5 text-center">
                  <button
                    onClick={() => onRemove(item.scripCode)}
                    className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
