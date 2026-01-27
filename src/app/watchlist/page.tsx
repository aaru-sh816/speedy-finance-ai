'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { 
  Star, 
  Plus, 
  X, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  ArrowLeft,
  Bell,
  BellOff,
  Download,
  Upload,
  Search,
  LayoutGrid,
  List,
  Grid3X3,
  Columns,
  Target,
  DollarSign,
  PieChart,
  BarChart3,
  Settings2,
  Filter,
  SortAsc,
  SortDesc,
  Percent,
  TrendingUpIcon,
  Wallet,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  Scale,
  Sparkles,
  Brain
} from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { SearchModal } from '@/components/search-modal'
import { Sparkline, HeatmapCell, PriceTargetProgress } from '@/components/ui/sparkline'
import { WatchlistHeatmap } from '@/components/watchlist-heatmap'
import { StockComparison } from '@/components/stock-comparison'
import { StockSentimentCard } from '@/components/stock-sentiment-card'
import { 
  getNotesByScripCode, 
  exportAllData, 
  importAllData, 
  addPriceAlert, 
  deletePriceAlert, 
  getPriceAlerts, 
  getWatchlistGroups,
  updateWatchlistItem,
  type PriceAlert,
  type WatchlistItem 
} from '@/lib/storage'

type ViewMode = 'grid' | 'table' | 'heatmap' | 'portfolio' | 'sentiment'
type SortField = 'symbol' | 'change' | 'price' | 'volume' | 'name'
type SortDirection = 'asc' | 'desc'

export default function WatchlistPage() {
  const { items, quotes, isLoading, remove, refresh } = useWatchlist(30000)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('symbol')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterSentiment, setFilterSentiment] = useState<'all' | 'gainers' | 'losers'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({})
  
  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{ scripCode: string; symbol: string } | null>(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above')
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => getPriceAlerts())
  
  // Portfolio Simulation State
  const [portfolioMode, setPortfolioMode] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ quantity: '', avgPrice: '', targetPrice: '', stopLoss: '' })
  
  // Comparison Mode State
  const [showComparison, setShowComparison] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([])

  // Fetch sparkline data
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
        } catch {}
      }
      setSparklineData(data)
    }
    if (items.length > 0) fetchSparklines()
  }, [items])

  const handleExport = () => {
    const data = exportAllData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `speedy-finance-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          if (importAllData(content)) {
            window.location.reload()
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleAddAlert = () => {
    if (!alertModal || !alertPrice) return
    addPriceAlert({
      scripCode: alertModal.scripCode,
      symbol: alertModal.symbol,
      targetPrice: parseFloat(alertPrice),
      direction: alertDirection,
    })
    setAlerts(getPriceAlerts())
    setAlertModal(null)
    setAlertPrice('')
  }

  const handleDeleteAlert = (id: string) => {
    deletePriceAlert(id)
    setAlerts(getPriceAlerts())
  }

  const handleSavePortfolioItem = (scripCode: string) => {
    updateWatchlistItem(scripCode, {
      quantity: editValues.quantity ? parseInt(editValues.quantity) : undefined,
      avgBuyPrice: editValues.avgPrice ? parseFloat(editValues.avgPrice) : undefined,
      targetPrice: editValues.targetPrice ? parseFloat(editValues.targetPrice) : undefined,
      stopLoss: editValues.stopLoss ? parseFloat(editValues.stopLoss) : undefined,
    })
    setEditingItem(null)
    setEditValues({ quantity: '', avgPrice: '', targetPrice: '', stopLoss: '' })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items]

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item => 
        item.symbol.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q)
      )
    }

    // Sentiment filter
    if (filterSentiment === 'gainers') {
      result = result.filter(item => (quotes[item.scripCode]?.changePercent || 0) > 0)
    } else if (filterSentiment === 'losers') {
      result = result.filter(item => (quotes[item.scripCode]?.changePercent || 0) < 0)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortField) {
        case 'symbol':
          aVal = a.symbol
          bVal = b.symbol
          break
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'price':
          aVal = quotes[a.scripCode]?.price || 0
          bVal = quotes[b.scripCode]?.price || 0
          break
        case 'change':
          aVal = quotes[a.scripCode]?.changePercent || 0
          bVal = quotes[b.scripCode]?.changePercent || 0
          break
        case 'volume':
          aVal = quotes[a.scripCode]?.volume || 0
          bVal = quotes[b.scripCode]?.volume || 0
          break
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal)
      }
      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
    })

    return result
  }, [items, quotes, searchQuery, filterSentiment, sortField, sortDirection])

  // Portfolio calculations
  const portfolioStats = useMemo(() => {
    let totalInvested = 0
    let totalCurrent = 0
    let totalPnL = 0

    items.forEach(item => {
      const quote = quotes[item.scripCode]
      if (item.quantity && item.avgBuyPrice && quote?.price) {
        const invested = item.quantity * item.avgBuyPrice
        const current = item.quantity * quote.price
        totalInvested += invested
        totalCurrent += current
        totalPnL += current - invested
      }
    })

    return {
      totalInvested,
      totalCurrent,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
    }
  }, [items, quotes])

  const avgChange = items.length > 0 
    ? Object.values(quotes).reduce((sum, q) => sum + (q.changePercent || 0), 0) / items.length 
    : 0
  const gainers = filteredItems.filter(i => (quotes[i.scripCode]?.changePercent || 0) > 0).length
  const losers = filteredItems.filter(i => (quotes[i.scripCode]?.changePercent || 0) < 0).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
                <Star className="h-6 w-6 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
                <p className="text-sm text-zinc-500">{items.length} stocks • Last updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => refresh()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 transition-colors"
              >
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Compare</span>
              </button>
              <button
                onClick={handleExport}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Export data"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleImport}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Import data"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowSearchModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Stock
              </button>
            </div>
        </div>

        {/* Stats Cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 font-medium mb-1">Total Stocks</p>
              <p className="text-2xl font-bold text-white">{items.length}</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 font-medium mb-1">Average Change</p>
              <p className={`text-2xl font-bold ${avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
              </p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 font-medium mb-1">Gainers / Losers</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-400">{gainers}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-lg font-bold text-rose-400">{losers}</span>
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 font-medium mb-1">Active Alerts</p>
              <p className="text-2xl font-bold text-amber-400">{alerts.filter(a => !a.triggered).length}</p>
            </div>
            {portfolioStats.totalInvested > 0 && (
              <>
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                  <p className="text-xs text-zinc-500 font-medium mb-1">Portfolio Value</p>
                  <p className="text-2xl font-bold text-white">₹{portfolioStats.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className={`rounded-xl p-4 border ${portfolioStats.totalPnL >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                  <p className="text-xs text-zinc-500 font-medium mb-1">Total P&L</p>
                  <p className={`text-2xl font-bold ${portfolioStats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {portfolioStats.totalPnL >= 0 ? '+' : ''}₹{portfolioStats.totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    <span className="text-sm ml-1">({portfolioStats.totalPnLPercent.toFixed(2)}%)</span>
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-800 rounded-xl p-1">
              {[
                { mode: 'grid' as ViewMode, icon: LayoutGrid, label: 'Grid' },
                { mode: 'table' as ViewMode, icon: Columns, label: 'Table' },
                { mode: 'heatmap' as ViewMode, icon: Grid3X3, label: 'Heatmap' },
                { mode: 'portfolio' as ViewMode, icon: PieChart, label: 'Portfolio' },
                { mode: 'sentiment' as ViewMode, icon: Brain, label: 'AI' },
              ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === mode 
                    ? 'bg-zinc-700 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">{label}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value as typeof filterSentiment)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All Stocks</option>
              <option value="gainers">Gainers Only</option>
              <option value="losers">Losers Only</option>
            </select>
          </div>
        </div>

        {/* Content */}
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Star className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">
                {items.length === 0 ? 'No stocks in watchlist' : 'No matches found'}
              </p>
              <p className="text-sm">
                {items.length === 0 ? 'Add stocks to track their prices and get alerts' : 'Try adjusting your search or filters'}
              </p>
              {items.length === 0 && (
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Stock
                </button>
              )}
            </div>
          ) : viewMode === 'heatmap' ? (
            <WatchlistHeatmap 
              stocks={filteredItems.map(item => ({
                scripCode: item.scripCode,
                symbol: item.symbol,
                name: item.name,
                price: quotes[item.scripCode]?.price || 0,
                changePercent: quotes[item.scripCode]?.changePercent || 0,
                volume: quotes[item.scripCode]?.volume || 0,
              }))}
            />
          ) : viewMode === 'sentiment' ? (
            <SentimentView items={filteredItems} quotes={quotes} />
          ) : viewMode === 'portfolio' ? (
          <PortfolioView 
            items={filteredItems} 
            quotes={quotes} 
            sparklineData={sparklineData}
            onRemove={remove}
            onEdit={(scripCode) => {
              const item = items.find(i => i.scripCode === scripCode)
              if (item) {
                setEditingItem(scripCode)
                setEditValues({
                  quantity: item.quantity?.toString() || '',
                  avgPrice: item.avgBuyPrice?.toString() || '',
                  targetPrice: item.targetPrice?.toString() || '',
                  stopLoss: item.stopLoss?.toString() || '',
                })
              }
            }}
            editingItem={editingItem}
            editValues={editValues}
            setEditValues={setEditValues}
            onSaveEdit={handleSavePortfolioItem}
            onCancelEdit={() => setEditingItem(null)}
          />
        ) : viewMode === 'table' ? (
          <TableView 
            items={filteredItems} 
            quotes={quotes} 
            sparklineData={sparklineData}
            onRemove={remove}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
            onSetAlert={(scripCode, symbol) => setAlertModal({ scripCode, symbol })}
            alerts={alerts}
          />
        ) : (
          <GridView 
            items={filteredItems} 
            quotes={quotes} 
            sparklineData={sparklineData}
            onRemove={remove}
            onSetAlert={(scripCode, symbol) => setAlertModal({ scripCode, symbol })}
            alerts={alerts}
          />
        )}
      </div>

        {/* Search Modal */}
        <SearchModal 
          isOpen={showSearchModal} 
          onClose={() => setShowSearchModal(false)} 
          onSelectStock={() => setShowSearchModal(false)}
        />

        {/* Comparison Modal */}
        <StockComparison
          isOpen={showComparison}
          onClose={() => setShowComparison(false)}
          initialStocks={items.slice(0, 4).map(item => ({
            scripCode: item.scripCode,
            symbol: item.symbol,
            name: item.name,
          }))}
        />

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAlertModal(null)} />
          <div className="relative w-full max-w-md mx-4 bg-zinc-900 rounded-2xl border border-zinc-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Set Price Alert</h3>
            <p className="text-sm text-zinc-400 mb-6">Alert me when {alertModal.symbol} goes:</p>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAlertDirection('above')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  alertDirection === 'above' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                Above
              </button>
              <button
                onClick={() => setAlertDirection('below')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  alertDirection === 'below' 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                Below
              </button>
            </div>

            <div className="relative mb-6">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">₹</span>
              <input
                type="number"
                placeholder="Enter target price"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/50 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAlertModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAlert}
                disabled={!alertPrice}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                Set Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Grid View Component
function GridView({ items, quotes, sparklineData, onRemove, onSetAlert, alerts }: {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
  sparklineData: Record<string, number[]>
  onRemove: (scripCode: string) => void
  onSetAlert: (scripCode: string, symbol: string) => void
  alerts: PriceAlert[]
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => {
        const quote = quotes[item.scripCode]
        const notes = getNotesByScripCode(item.scripCode)
        const stockAlerts = alerts.filter(a => a.scripCode === item.scripCode && !a.triggered)
        const isPositive = (quote?.changePercent || 0) >= 0

        return (
          <div
            key={item.scripCode}
            className="group bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-zinc-700 p-4 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <Link href={`/company/${item.scripCode}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{item.symbol}</span>
                  {notes.length > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">
                      <FileText className="h-2.5 w-2.5" />
                      {notes.length}
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 truncate">{item.name}</p>
              </Link>
              <button
                onClick={() => onRemove(item.scripCode)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <p className="text-2xl font-bold text-white">
                  ₹{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                </p>
                <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? '+' : ''}{(quote?.changePercent || 0).toFixed(2)}%
                </div>
              </div>
              <Sparkline data={sparklineData[item.scripCode] || []} width={80} height={32} />
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
              <span>H: ₹{quote?.high?.toLocaleString('en-IN') || '—'}</span>
              <span>L: ₹{quote?.low?.toLocaleString('en-IN') || '—'}</span>
            </div>

            {stockAlerts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {stockAlerts.map(alert => (
                  <span key={alert.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
                    <Bell className="h-3 w-3" />
                    {alert.direction === 'above' ? '>' : '<'} ₹{alert.targetPrice}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => onSetAlert(item.scripCode, item.symbol)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                <Bell className="h-3.5 w-3.5" />
                Alert
              </button>
              <Link
                href={`/company/${item.scripCode}`}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Table View Component
function TableView({ items, quotes, sparklineData, onRemove, onSort, sortField, sortDirection, onSetAlert, alerts }: {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
  sparklineData: Record<string, number[]>
  onRemove: (scripCode: string) => void
  onSort: (field: SortField) => void
  sortField: SortField
  sortDirection: SortDirection
  onSetAlert: (scripCode: string, symbol: string) => void
  alerts: PriceAlert[]
}) {
  const SortIcon = sortDirection === 'asc' ? SortAsc : SortDesc

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-800/50">
              {[
                { field: 'symbol' as SortField, label: 'Symbol', align: 'left' },
                { field: 'name' as SortField, label: 'Name', align: 'left' },
                { field: 'price' as SortField, label: 'Price', align: 'right' },
                { field: 'change' as SortField, label: 'Change', align: 'right' },
                { field: null, label: '7D Trend', align: 'center' },
                { field: null, label: 'High', align: 'right' },
                { field: null, label: 'Low', align: 'right' },
                { field: 'volume' as SortField, label: 'Volume', align: 'right' },
                { field: null, label: 'Alerts', align: 'center' },
                { field: null, label: '', align: 'center' },
              ].map(({ field, label, align }) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-${align} ${field ? 'cursor-pointer hover:text-white' : ''}`}
                  onClick={() => field && onSort(field)}
                >
                  <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                    {label}
                    {field && sortField === field && <SortIcon className="h-3 w-3" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {items.map(item => {
              const quote = quotes[item.scripCode]
              const isPositive = (quote?.changePercent || 0) >= 0
              const stockAlerts = alerts.filter(a => a.scripCode === item.scripCode && !a.triggered)

              return (
                <tr key={item.scripCode} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-4">
                    <Link href={`/company/${item.scripCode}`} className="font-semibold text-white hover:text-amber-400 transition-colors">
                      {item.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 max-w-[200px] truncate">{item.name}</td>
                  <td className="px-4 py-4 text-right font-medium text-white">
                    ₹{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                  </td>
                  <td className={`px-4 py-4 text-right font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isPositive ? '+' : ''}{(quote?.changePercent || 0).toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <Sparkline data={sparklineData[item.scripCode] || []} width={70} height={24} showDot={false} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-400">₹{quote?.high?.toLocaleString('en-IN') || '—'}</td>
                  <td className="px-4 py-4 text-right text-zinc-400">₹{quote?.low?.toLocaleString('en-IN') || '—'}</td>
                  <td className="px-4 py-4 text-right text-zinc-400">{quote?.volume?.toLocaleString('en-IN') || '—'}</td>
                  <td className="px-4 py-4 text-center">
                    {stockAlerts.length > 0 ? (
                      <span className="flex items-center justify-center gap-1 text-amber-400">
                        <Bell className="h-4 w-4" />
                        {stockAlerts.length}
                      </span>
                    ) : (
                      <button
                        onClick={() => onSetAlert(item.scripCode, item.symbol)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-amber-400 transition-colors"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
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
    </div>
  )
}

// Heatmap View Component
function HeatmapView({ items, quotes }: {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
}) {
  const sortedItems = [...items].sort((a, b) => {
    const aChange = quotes[a.scripCode]?.changePercent || 0
    const bChange = quotes[b.scripCode]?.changePercent || 0
    return bChange - aChange
  })

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6">
      <div className="flex flex-wrap gap-3 justify-center">
        {sortedItems.map(item => {
          const quote = quotes[item.scripCode]
          const change = quote?.changePercent || 0
          const intensity = Math.min(Math.abs(change) / 5, 1)
          const isPositive = change >= 0

          return (
            <Link
              key={item.scripCode}
              href={`/company/${item.scripCode}`}
              className={`relative flex flex-col items-center justify-center rounded-xl p-4 transition-all hover:scale-105 hover:z-10 ${
                Math.abs(change) > 3 ? 'min-w-[120px] min-h-[100px]' : 
                Math.abs(change) > 1 ? 'min-w-[100px] min-h-[80px]' : 
                'min-w-[80px] min-h-[60px]'
              }`}
              style={{
                backgroundColor: isPositive 
                  ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`
                  : `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`,
                borderWidth: 1,
                borderColor: isPositive
                  ? `rgba(16, 185, 129, ${0.2 + intensity * 0.3})`
                  : `rgba(239, 68, 68, ${0.2 + intensity * 0.3})`,
              }}
            >
              <span className="font-bold text-white text-sm">{item.symbol}</span>
              <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
              <span className="text-xs text-zinc-400">
                ₹{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '—'}
              </span>
            </Link>
          )
        })}
      </div>
      
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-rose-500/50" />
          <span>Strong Loss</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-rose-500/20" />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/20" />
          <span>Gain</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/50" />
          <span>Strong Gain</span>
        </div>
      </div>
    </div>
  )
}

// Portfolio View Component
function PortfolioView({ items, quotes, sparklineData, onRemove, onEdit, editingItem, editValues, setEditValues, onSaveEdit, onCancelEdit }: {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
  sparklineData: Record<string, number[]>
  onRemove: (scripCode: string) => void
  onEdit: (scripCode: string) => void
  editingItem: string | null
  editValues: { quantity: string; avgPrice: string; targetPrice: string; stopLoss: string }
  setEditValues: (values: typeof editValues) => void
  onSaveEdit: (scripCode: string) => void
  onCancelEdit: () => void
}) {
  return (
    <div className="space-y-4">
      {items.map(item => {
        const quote = quotes[item.scripCode]
        const isPositive = (quote?.changePercent || 0) >= 0
        const hasPortfolioData = item.quantity && item.avgBuyPrice
        const pnl = hasPortfolioData && quote?.price 
          ? (quote.price - item.avgBuyPrice!) * item.quantity!
          : 0
        const pnlPercent = hasPortfolioData && item.avgBuyPrice 
          ? ((quote?.price || 0) - item.avgBuyPrice) / item.avgBuyPrice * 100
          : 0

        return (
          <div
            key={item.scripCode}
            className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 group"
          >
            {editingItem === item.scripCode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{item.symbol}</span>
                  <span className="text-sm text-zinc-500">{item.name}</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      value={editValues.quantity}
                      onChange={e => setEditValues({ ...editValues, quantity: e.target.value })}
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none border border-zinc-700 focus:border-amber-500/50"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Avg Buy Price</label>
                    <input
                      type="number"
                      value={editValues.avgPrice}
                      onChange={e => setEditValues({ ...editValues, avgPrice: e.target.value })}
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none border border-zinc-700 focus:border-amber-500/50"
                      placeholder="₹0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Target Price</label>
                    <input
                      type="number"
                      value={editValues.targetPrice}
                      onChange={e => setEditValues({ ...editValues, targetPrice: e.target.value })}
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none border border-zinc-700 focus:border-amber-500/50"
                      placeholder="₹0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Stop Loss</label>
                    <input
                      type="number"
                      value={editValues.stopLoss}
                      onChange={e => setEditValues({ ...editValues, stopLoss: e.target.value })}
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none border border-zinc-700 focus:border-amber-500/50"
                      placeholder="₹0"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={onCancelEdit}
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onSaveEdit(item.scripCode)}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-400 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Link href={`/company/${item.scripCode}`} className="flex-shrink-0">
                  <div className="font-bold text-white text-lg">{item.symbol}</div>
                  <div className="text-xs text-zinc-500">{item.name}</div>
                </Link>

                <div className="flex-1 flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-zinc-500 mb-0.5">Current</div>
                    <div className="text-lg font-bold text-white">
                      ₹{quote?.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                    </div>
                  </div>

                  <Sparkline data={sparklineData[item.scripCode] || []} width={80} height={32} />

                  <div className="text-center">
                    <div className="text-xs text-zinc-500 mb-0.5">Day Change</div>
                    <div className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{(quote?.changePercent || 0).toFixed(2)}%
                    </div>
                  </div>

                  {hasPortfolioData ? (
                    <>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-0.5">Qty × Avg</div>
                        <div className="text-sm text-zinc-300">
                          {item.quantity} × ₹{item.avgBuyPrice?.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-0.5">P&L</div>
                        <div className={`text-lg font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          <span className="text-sm ml-1">({pnlPercent.toFixed(2)}%)</span>
                        </div>
                      </div>

                      {item.targetPrice && quote?.price && (
                        <div className="w-32">
                          <PriceTargetProgress
                            currentPrice={quote.price}
                            targetPrice={item.targetPrice}
                            entryPrice={item.avgBuyPrice}
                            stopLoss={item.stopLoss}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-zinc-500">
                      No portfolio data. Click edit to add.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(item.scripCode)}
                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onRemove(item.scripCode)}
                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

// Sentiment View Component - AI-Powered Analysis
function SentimentView({ items, quotes }: {
  items: WatchlistItem[]
  quotes: ReturnType<typeof useWatchlist>['quotes']
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI Sentiment Analysis</h3>
          <p className="text-sm text-zinc-400">Powered by Claude AI - Bull vs Bear analysis for your watchlist</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map(item => {
          const quote = quotes[item.scripCode]
          return (
            <StockSentimentCard
              key={item.scripCode}
              symbol={item.symbol}
              companyName={item.name}
              currentPrice={quote?.price || 0}
              changePercent={quote?.changePercent || 0}
              compact={false}
            />
          )
        })}
      </div>
    </div>
  )
}
