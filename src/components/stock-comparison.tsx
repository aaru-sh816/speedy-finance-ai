'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  X, 
  Plus,
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3,
  DollarSign,
  Users,
  Building2,
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  Scale
} from 'lucide-react'
import { Sparkline } from '@/components/ui/sparkline'

interface CompareStock {
  scripCode: string
  symbol: string
  name: string
  price?: number
  changePercent?: number
  volume?: number
  high?: number
  low?: number
  marketCap?: string
  pe?: number
  weekHigh52?: number
  weekLow52?: number
  historicalData?: number[]
}

interface StockComparisonProps {
  isOpen: boolean
  onClose: () => void
  initialStocks?: CompareStock[]
}

export function StockComparison({ isOpen, onClose, initialStocks = [] }: StockComparisonProps) {
  const router = useRouter()
  const [stocks, setStocks] = useState<CompareStock[]>(initialStocks)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CompareStock[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loadingQuotes, setLoadingQuotes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && initialStocks.length > 0) {
      setStocks(initialStocks)
      initialStocks.forEach(stock => fetchQuote(stock.scripCode))
    }
  }, [isOpen, initialStocks])

  useEffect(() => {
    const searchStocks = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const res = await fetch(`/api/bse/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results?.slice(0, 5) || [])
        }
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchStocks, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const fetchQuote = async (scripCode: string) => {
    setLoadingQuotes(prev => new Set(prev).add(scripCode))
    try {
      const [quoteRes, historyRes] = await Promise.all([
        fetch(`/api/bse/quote?scripCode=${scripCode}`),
        fetch(`/api/bse/history?scripCode=${scripCode}&days=30`)
      ])

      const quoteData = quoteRes.ok ? await quoteRes.json() : null
      const historyData = historyRes.ok ? await historyRes.json() : null

      setStocks(prev => prev.map(s => {
        if (s.scripCode === scripCode) {
          return {
            ...s,
            price: quoteData?.currentValue ? parseFloat(quoteData.currentValue.replace(/,/g, '')) : s.price,
            changePercent: quoteData?.pChange ? parseFloat(quoteData.pChange) : s.changePercent,
            volume: quoteData?.totalTradedQuantity ? parseFloat(quoteData.totalTradedQuantity.replace(/[^0-9.]/g, '')) * 100000 : s.volume,
            high: quoteData?.dayHigh ? parseFloat(quoteData.dayHigh.replace(/,/g, '')) : s.high,
            low: quoteData?.dayLow ? parseFloat(quoteData.dayLow.replace(/,/g, '')) : s.low,
            marketCap: quoteData?.marketCapFull || s.marketCap,
            weekHigh52: quoteData?.['52weekHigh'] ? parseFloat(quoteData['52weekHigh'].replace(/,/g, '')) : s.weekHigh52,
            weekLow52: quoteData?.['52weekLow'] ? parseFloat(quoteData['52weekLow'].replace(/,/g, '')) : s.weekLow52,
            historicalData: historyData?.data?.map((d: { close: number }) => d.close) || s.historicalData
          }
        }
        return s
      }))
    } catch (err) {
      console.error('Failed to fetch quote:', err)
    } finally {
      setLoadingQuotes(prev => {
        const next = new Set(prev)
        next.delete(scripCode)
        return next
      })
    }
  }

  const addStock = (stock: CompareStock) => {
    if (stocks.length >= 4) return
    if (stocks.find(s => s.scripCode === stock.scripCode)) return
    
    setStocks(prev => [...prev, stock])
    fetchQuote(stock.scripCode)
    setSearchQuery('')
    setSearchResults([])
  }

  const removeStock = (scripCode: string) => {
    setStocks(prev => prev.filter(s => s.scripCode !== scripCode))
  }

  const metrics = useMemo(() => {
    if (stocks.length === 0) return null

    const validStocks = stocks.filter(s => s.price)
    if (validStocks.length === 0) return null

    const bestPerformer = validStocks.reduce((best, s) => 
      (s.changePercent || 0) > (best.changePercent || 0) ? s : best, validStocks[0])
    const worstPerformer = validStocks.reduce((worst, s) => 
      (s.changePercent || 0) < (worst.changePercent || 0) ? s : worst, validStocks[0])
    const highestVolume = validStocks.reduce((high, s) => 
      (s.volume || 0) > (high.volume || 0) ? s : high, validStocks[0])

    return { bestPerformer, worstPerformer, highestVolume }
  }, [stocks])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl mx-4 max-h-[90vh] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Compare Stocks</h2>
                <p className="text-xs text-zinc-500">Side-by-side analysis • Up to 4 stocks</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search to add stocks */}
          <div className="p-4 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder={stocks.length >= 4 ? 'Maximum 4 stocks reached' : 'Search stocks to compare...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                disabled={stocks.length >= 4}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-purple-500/50 text-white placeholder:text-zinc-500 outline-none disabled:opacity-50 transition-colors"
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-500" />
              )}

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 rounded-xl border border-zinc-700 shadow-xl z-10 overflow-hidden">
                  {searchResults.map(result => (
                    <button
                      key={result.scripCode}
                      onClick={() => addStock(result)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-700 transition-colors text-left"
                    >
                      <Building2 className="h-4 w-4 text-zinc-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white">{result.symbol}</span>
                        <span className="text-xs text-zinc-500 ml-2 truncate">{result.name}</span>
                      </div>
                      <Plus className="h-4 w-4 text-purple-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected stocks chips */}
            {stocks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {stocks.map(stock => (
                  <div
                    key={stock.scripCode}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30"
                  >
                    <span className="text-sm font-semibold text-purple-400">{stock.symbol}</span>
                    <button
                      onClick={() => removeStock(stock.scripCode)}
                      className="p-0.5 rounded hover:bg-purple-500/30 text-purple-400 hover:text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comparison Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {stocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Scale className="h-16 w-16 text-zinc-700 mb-4" />
                <p className="text-zinc-400 text-center">Search and add stocks to compare them side by side</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quick Stats */}
                {metrics && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-semibold">Best Performer</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{metrics.bestPerformer.symbol}</span>
                        <span className="text-emerald-400 font-semibold">
                          +{(metrics.bestPerformer.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-rose-400" />
                        <span className="text-xs text-rose-400 font-semibold">Worst Performer</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{metrics.worstPerformer.symbol}</span>
                        <span className="text-rose-400 font-semibold">
                          {(metrics.worstPerformer.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-amber-400" />
                        <span className="text-xs text-amber-400 font-semibold">Highest Volume</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{metrics.highestVolume.symbol}</span>
                        <span className="text-amber-400 font-semibold">
                          {((metrics.highestVolume.volume || 0) / 100000).toFixed(1)}L
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left py-3 px-4 text-xs text-zinc-500 font-semibold">METRIC</th>
                        {stocks.map(stock => (
                          <th key={stock.scripCode} className="text-center py-3 px-4">
                            <button
                              onClick={() => router.push(`/company/${stock.scripCode}`)}
                              className="font-bold text-white hover:text-purple-400 transition-colors"
                            >
                              {stock.symbol}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {/* Price */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">Current Price</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {loadingQuotes.has(stock.scripCode) ? (
                              <Loader2 className="h-4 w-4 animate-spin text-zinc-500 mx-auto" />
                            ) : stock.price ? (
                              <span className="font-semibold text-white">₹{stock.price.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Change */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">Day Change</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {stock.changePercent !== undefined ? (
                              <span className={`font-semibold flex items-center justify-center gap-1 ${
                                stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {stock.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* 30-Day Chart */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">30-Day Trend</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4">
                            <div className="flex justify-center">
                              {stock.historicalData && stock.historicalData.length > 0 ? (
                                <Sparkline data={stock.historicalData} width={120} height={40} showDot={true} />
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Day Range */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">Day Range</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {stock.low && stock.high ? (
                              <span className="text-xs text-zinc-300">
                                ₹{stock.low.toLocaleString('en-IN')} - ₹{stock.high.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* 52-Week Range */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">52-Week Range</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {stock.weekLow52 && stock.weekHigh52 ? (
                              <span className="text-xs text-zinc-300">
                                ₹{stock.weekLow52.toLocaleString('en-IN')} - ₹{stock.weekHigh52.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Volume */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">Volume</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {stock.volume ? (
                              <span className="text-zinc-300">{(stock.volume / 100000).toFixed(2)}L</span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Market Cap */}
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-4 px-4 text-sm text-zinc-400">Market Cap</td>
                        {stocks.map(stock => (
                          <td key={stock.scripCode} className="py-4 px-4 text-center">
                            {stock.marketCap ? (
                              <span className="text-zinc-300">{stock.marketCap}</span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <p className="text-xs text-zinc-500">
              {stocks.length}/4 stocks selected
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
