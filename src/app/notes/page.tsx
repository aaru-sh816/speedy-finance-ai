'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  FileText, 
  Search, 
  ArrowLeft, 
  Pin, 
  Trash2, 
  Calendar,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  Clock,
  BarChart3,
  BookOpen,
  Newspaper,
  Target,
  Star,
  Download,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import { useStockNotes } from '@/hooks/useStockNotes'
import type { StockNote } from '@/lib/storage'

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'Bearish' },
  neutral: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: 'Neutral' },
}

const TEMPLATE_CONFIG = {
  earnings: { icon: BarChart3, label: 'Earnings', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  technical: { icon: TrendingUp, label: 'Technical', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  fundamental: { icon: BookOpen, label: 'Fundamental', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  news: { icon: Newspaper, label: 'News', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  custom: { icon: FileText, label: 'Custom', color: 'text-zinc-400', bg: 'bg-zinc-500/20' },
}

type ViewMode = 'cards' | 'timeline' | 'table'
type SortOption = 'newest' | 'oldest' | 'symbol' | 'sentiment'
type GroupBy = 'none' | 'stock' | 'date' | 'sentiment' | 'template'

export default function NotesPage() {
  const { notes, remove, togglePin, getAllTags } = useStockNotes()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedSentiment, setSelectedSentiment] = useState<StockNote['sentiment'] | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<StockNote['template'] | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const allTags = useMemo(() => getAllTags(), [getAllTags])

  // Filter notes
  const filteredNotes = useMemo(() => {
    let result = [...notes]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(n => 
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.symbol.toLowerCase().includes(q) ||
        n.companyName.toLowerCase().includes(q)
      )
    }

    if (selectedTag) {
      result = result.filter(n => n.tags.includes(selectedTag))
    }

    if (selectedSentiment) {
      result = result.filter(n => n.sentiment === selectedSentiment)
    }

    if (selectedTemplate) {
      result = result.filter(n => n.template === selectedTemplate)
    }

    // Sort
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1

      switch (sortBy) {
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        case 'symbol':
          return a.symbol.localeCompare(b.symbol)
        case 'sentiment':
          const sentimentOrder = { bullish: 0, neutral: 1, bearish: 2 }
          return (sentimentOrder[a.sentiment || 'neutral'] || 2) - (sentimentOrder[b.sentiment || 'neutral'] || 2)
        default:
          return 0
      }
    })

    return result
  }, [notes, searchQuery, selectedTag, selectedSentiment, selectedTemplate, sortBy])

  // Group notes
  const groupedNotes = useMemo(() => {
    if (groupBy === 'none') return { 'All Notes': filteredNotes }

    const groups: Record<string, StockNote[]> = {}
    
    filteredNotes.forEach(note => {
      let key = ''
      switch (groupBy) {
        case 'stock':
          key = `${note.symbol} - ${note.companyName}`
          break
        case 'date':
          const date = new Date(note.updatedAt)
          key = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
          break
        case 'sentiment':
          key = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].label : 'No Sentiment'
          break
        case 'template':
          key = note.template ? TEMPLATE_CONFIG[note.template].label : 'Custom'
          break
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(note)
    })

    return groups
  }, [filteredNotes, groupBy])

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(group)) {
      newExpanded.delete(group)
    } else {
      newExpanded.add(group)
    }
    setExpandedGroups(newExpanded)
  }

  const handleCopy = async (note: StockNote) => {
    const text = `# ${note.title}\n\n${note.content}\n\n---\n${note.symbol} | ₹${note.priceAtNote?.toLocaleString('en-IN') || '—'} | ${new Date(note.createdAt).toLocaleDateString('en-IN')}`
    await navigator.clipboard.writeText(text)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExport = () => {
    const markdown = filteredNotes.map(note => {
      const sentiment = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].label : ''
      return `# ${note.title}

**Stock:** ${note.symbol} - ${note.companyName}
**Date:** ${new Date(note.createdAt).toLocaleDateString('en-IN')}
**Price at Note:** ₹${note.priceAtNote?.toLocaleString('en-IN') || '—'}
${sentiment ? `**Sentiment:** ${sentiment}` : ''}
${note.priceTarget ? `**Price Target:** ₹${note.priceTarget.toLocaleString('en-IN')}` : ''}
${note.tags.length > 0 ? `**Tags:** ${note.tags.map(t => `#${t}`).join(' ')}` : ''}

${note.content}

---
`
    }).join('\n\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-notes-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  // Stats
  const stats = useMemo(() => {
    const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 }
    const stockCounts = new Map<string, number>()
    
    notes.forEach(n => {
      if (n.sentiment) sentimentCounts[n.sentiment]++
      stockCounts.set(n.scripCode, (stockCounts.get(n.scripCode) || 0) + 1)
    })
    
    return {
      total: notes.length,
      pinned: notes.filter(n => n.isPinned).length,
      ...sentimentCounts,
      uniqueStocks: stockCounts.size,
      withTargets: notes.filter(n => n.priceTarget).length,
    }
  }, [notes])

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
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Research Notes</h1>
                <p className="text-sm text-zinc-500">{stats.total} notes across {stats.uniqueStocks} stocks</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {notes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Total</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Pinned</p>
              <p className="text-xl font-bold text-amber-400">{stats.pinned}</p>
            </div>
            <div 
              className={`rounded-xl p-3 border cursor-pointer transition-all ${
                selectedSentiment === 'bullish' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => setSelectedSentiment(selectedSentiment === 'bullish' ? null : 'bullish')}
            >
              <p className="text-xs text-zinc-500 mb-0.5">Bullish</p>
              <p className="text-xl font-bold text-emerald-400">{stats.bullish}</p>
            </div>
            <div 
              className={`rounded-xl p-3 border cursor-pointer transition-all ${
                selectedSentiment === 'bearish' ? 'bg-rose-500/20 border-rose-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => setSelectedSentiment(selectedSentiment === 'bearish' ? null : 'bearish')}
            >
              <p className="text-xs text-zinc-500 mb-0.5">Bearish</p>
              <p className="text-xl font-bold text-rose-400">{stats.bearish}</p>
            </div>
            <div 
              className={`rounded-xl p-3 border cursor-pointer transition-all ${
                selectedSentiment === 'neutral' ? 'bg-zinc-500/20 border-zinc-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => setSelectedSentiment(selectedSentiment === 'neutral' ? null : 'neutral')}
            >
              <p className="text-xs text-zinc-500 mb-0.5">Neutral</p>
              <p className="text-xl font-bold text-zinc-400">{stats.neutral}</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">Stocks</p>
              <p className="text-xl font-bold text-cyan-400">{stats.uniqueStocks}</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-0.5">With Targets</p>
              <p className="text-xl font-bold text-purple-400">{stats.withTargets}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* View Mode */}
          <div className="flex items-center bg-zinc-800 rounded-xl p-1">
            {[
              { mode: 'cards' as ViewMode, icon: LayoutGrid, label: 'Cards' },
              { mode: 'timeline' as ViewMode, icon: Clock, label: 'Timeline' },
              { mode: 'table' as ViewMode, icon: List, label: 'Table' },
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

          {/* Sort & Group */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="symbol">Symbol</option>
              <option value="sentiment">Sentiment</option>
            </select>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white outline-none"
            >
              <option value="none">No Grouping</option>
              <option value="stock">By Stock</option>
              <option value="date">By Month</option>
              <option value="sentiment">By Sentiment</option>
              <option value="template">By Template</option>
            </select>
          </div>
        </div>

        {/* Tags & Template Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Template Filters */}
          <div className="flex items-center gap-2 mr-4">
            {(Object.keys(TEMPLATE_CONFIG) as Array<keyof typeof TEMPLATE_CONFIG>).map(key => {
              const config = TEMPLATE_CONFIG[key]
              const Icon = config.icon
              const isSelected = selectedTemplate === key
              const count = notes.filter(n => n.template === key).length
              if (count === 0) return null
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(isSelected ? null : key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isSelected 
                      ? `${config.bg} ${config.color} border border-current` 
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                  <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <>
              <div className="w-px h-6 bg-zinc-700 mx-2" />
              <div className="flex flex-wrap gap-1.5">
                {allTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedTag === tag 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Clear Filters */}
          {(selectedTag || selectedSentiment || selectedTemplate) && (
            <button
              onClick={() => { 
                setSelectedTag(null)
                setSelectedSentiment(null)
                setSelectedTemplate(null)
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Content */}
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <FileText className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">
              {notes.length === 0 ? 'No research notes yet' : 'No notes match your filters'}
            </p>
            <p className="text-sm">
              {notes.length === 0 
                ? 'Visit a company page to add your first note' 
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView 
            groupedNotes={groupedNotes}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            onTogglePin={togglePin}
            onDelete={remove}
            onCopy={handleCopy}
            copiedId={copiedId}
            formatDate={formatDate}
            groupBy={groupBy}
          />
        ) : viewMode === 'table' ? (
          <TableView 
            notes={filteredNotes}
            onTogglePin={togglePin}
            onDelete={remove}
            formatDate={formatDate}
          />
        ) : (
          <CardsView 
            groupedNotes={groupedNotes}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            onTogglePin={togglePin}
            onDelete={remove}
            onCopy={handleCopy}
            copiedId={copiedId}
            formatDate={formatDate}
            groupBy={groupBy}
          />
        )}
      </div>
    </div>
  )
}

// Cards View
function CardsView({ groupedNotes, expandedGroups, onToggleGroup, onTogglePin, onDelete, onCopy, copiedId, formatDate, groupBy }: {
  groupedNotes: Record<string, StockNote[]>
  expandedGroups: Set<string>
  onToggleGroup: (group: string) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onCopy: (note: StockNote) => void
  copiedId: string | null
  formatDate: (date: string) => string
  groupBy: GroupBy
}) {
  return (
    <div className="space-y-6">
      {Object.entries(groupedNotes).map(([group, notes]) => (
        <div key={group}>
          {groupBy !== 'none' && (
            <button
              onClick={() => onToggleGroup(group)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white mb-3 transition-colors"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${!expandedGroups.has(group) || expandedGroups.size === 0 ? 'rotate-90' : ''}`} />
              {group}
              <span className="text-zinc-600">({notes.length})</span>
            </button>
          )}
          
          {(groupBy === 'none' || !expandedGroups.has(group)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onTogglePin={onTogglePin}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  isCopied={copiedId === note.id}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Timeline View
function TimelineView({ groupedNotes, expandedGroups, onToggleGroup, onTogglePin, onDelete, onCopy, copiedId, formatDate, groupBy }: {
  groupedNotes: Record<string, StockNote[]>
  expandedGroups: Set<string>
  onToggleGroup: (group: string) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onCopy: (note: StockNote) => void
  copiedId: string | null
  formatDate: (date: string) => string
  groupBy: GroupBy
}) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-zinc-800" />
      
      <div className="space-y-4">
        {Object.entries(groupedNotes).map(([group, notes]) => (
          <div key={group}>
            {groupBy !== 'none' && (
              <div className="flex items-center gap-3 mb-4 ml-8">
                <button
                  onClick={() => onToggleGroup(group)}
                  className="flex items-center gap-2 text-sm font-semibold text-white"
                >
                  {group}
                  <span className="text-zinc-500">({notes.length})</span>
                </button>
              </div>
            )}
            
            {(groupBy === 'none' || !expandedGroups.has(group)) && notes.map((note, index) => {
              const SentimentIcon = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].icon : null
              const sentimentConfig = note.sentiment ? SENTIMENT_CONFIG[note.sentiment] : null
              
              return (
                <div key={note.id} className="flex gap-4 group">
                  {/* Timeline dot */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    note.isPinned 
                      ? 'bg-amber-500/20 border-2 border-amber-500' 
                      : sentimentConfig 
                        ? `${sentimentConfig.bg} border-2 border-current ${sentimentConfig.color}`
                        : 'bg-zinc-800 border-2 border-zinc-700'
                  }`}>
                    {note.isPinned ? (
                      <Pin className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ) : SentimentIcon ? (
                      <SentimentIcon className={`h-4 w-4 ${sentimentConfig?.color}`} />
                    ) : (
                      <FileText className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 p-4 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <Link 
                            href={`/company/${note.scripCode}`}
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            {note.symbol} • {note.companyName}
                          </Link>
                          <h3 className="text-lg font-semibold text-white">{note.title}</h3>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onCopy(note)}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
                          >
                            {copiedId === note.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => onTogglePin(note.id)}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-amber-400 transition-colors"
                          >
                            <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={() => onDelete(note.id)}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {note.content && (
                        <p className="text-sm text-zinc-400 line-clamp-3 mb-3">{note.content}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {sentimentConfig && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${sentimentConfig.bg} ${sentimentConfig.color}`}>
                              {SentimentIcon && <SentimentIcon className="h-3 w-3" />}
                              {sentimentConfig.label}
                            </span>
                          )}
                          {note.priceTarget && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs">
                              <Target className="h-3 w-3" />
                              ₹{note.priceTarget.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{formatDate(note.updatedAt)}</span>
                          {note.priceAtNote && (
                            <span>₹{note.priceAtNote.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>

                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Table View
function TableView({ notes, onTogglePin, onDelete, formatDate }: {
  notes: StockNote[]
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  formatDate: (date: string) => string
}) {
  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase">Sentiment</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Target</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Price at Note</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tags</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Date</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {notes.map(note => {
              const SentimentIcon = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].icon : null
              const sentimentConfig = note.sentiment ? SENTIMENT_CONFIG[note.sentiment] : null
              
              return (
                <tr key={note.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {note.isPinned && <Pin className="h-3 w-3 text-amber-400 fill-amber-400" />}
                      <span className="font-medium text-white truncate max-w-[200px]">{note.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/company/${note.scripCode}`} className="text-cyan-400 hover:text-cyan-300 font-medium">
                      {note.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {sentimentConfig && SentimentIcon && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${sentimentConfig.bg} ${sentimentConfig.color}`}>
                        <SentimentIcon className="h-3 w-3" />
                        {sentimentConfig.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {note.priceTarget && (
                      <span className="text-purple-400">₹{note.priceTarget.toLocaleString('en-IN')}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-400">
                    {note.priceAtNote && `₹${note.priceAtNote.toLocaleString('en-IN')}`}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-xs">
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-xs">
                          +{note.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-500 text-sm">
                    {formatDate(note.updatedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onTogglePin(note.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-amber-400 transition-colors"
                      >
                        <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => onDelete(note.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

// Note Card Component
function NoteCard({ note, onTogglePin, onDelete, onCopy, isCopied, formatDate }: {
  note: StockNote
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onCopy: (note: StockNote) => void
  isCopied: boolean
  formatDate: (date: string) => string
}) {
  const SentimentIcon = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].icon : null
  const sentimentConfig = note.sentiment ? SENTIMENT_CONFIG[note.sentiment] : null
  const templateConfig = note.template ? TEMPLATE_CONFIG[note.template] : null

  return (
    <div className={`bg-zinc-900/50 rounded-xl border transition-all group ${
      note.isPinned ? 'border-amber-500/30' : 'border-zinc-800 hover:border-zinc-700'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {note.isPinned && <Pin className="h-3 w-3 text-amber-400 fill-amber-400" />}
              {templateConfig && note.template !== 'custom' && (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${templateConfig.bg} ${templateConfig.color}`}>
                  {(() => { const Icon = templateConfig.icon; return <Icon className="h-2.5 w-2.5" /> })()}
                </span>
              )}
              <Link href={`/company/${note.scripCode}`} className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
                {note.symbol}
              </Link>
            </div>
            <h3 className="font-semibold text-white truncate">{note.title}</h3>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onCopy(note)}
              className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onTogglePin(note.id)}
              className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-amber-400"
            >
              <Pin className={`h-3.5 w-3.5 ${note.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {note.content && (
          <p className="text-sm text-zinc-400 line-clamp-3 mb-3">{note.content}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap mb-2">
          {sentimentConfig && SentimentIcon && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${sentimentConfig.bg} ${sentimentConfig.color}`}>
              <SentimentIcon className="h-3 w-3" />
              {sentimentConfig.label}
            </span>
          )}
          {note.priceTarget && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs">
              <Target className="h-3 w-3" />
              ₹{note.priceTarget.toLocaleString('en-IN')}
            </span>
          )}
          {note.confidence && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-xs">
              {[...Array(note.confidence)].map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-amber-400" />
              ))}
            </span>
          )}
        </div>

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {note.tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs">
                #{tag}
              </span>
            ))}
            {note.tags.length > 4 && (
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs">
                +{note.tags.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-600 pt-2 border-t border-zinc-800">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(note.updatedAt)}
          </span>
          {note.priceAtNote && (
            <span>₹{note.priceAtNote.toLocaleString('en-IN')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
