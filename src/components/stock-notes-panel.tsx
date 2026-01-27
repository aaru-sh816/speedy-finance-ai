'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { 
  FileText, 
  Plus, 
  Pin, 
  PinOff, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Tag,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Target,
  Clock,
  Sparkles,
  BarChart3,
  BookOpen,
  Newspaper,
  Lightbulb,
  Copy,
  Check,
  Link2,
  AlertCircle,
  Zap,
  Star,
  MessageSquare
} from 'lucide-react'
import { useStockNotes } from '@/hooks/useStockNotes'
import { NOTE_TEMPLATES, type StockNote } from '@/lib/storage'

interface TechnicalContext {
  rsi?: number
  ma20?: number
  ma50?: number
  ma200?: number
  support?: number
  resistance?: number
  volume?: number
  avgVolume?: number
  dayHigh?: number
  dayLow?: number
  weekHigh52?: number
  weekLow52?: number
}

interface StockNotesPanelProps {
  scripCode: string
  symbol: string
  companyName: string
  currentPrice?: number
  technicalContext?: TechnicalContext
  announcements?: Array<{ id: string; headline: string; date: string }>
}

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', label: 'Bearish' },
  neutral: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', label: 'Neutral' },
}

const TIMEFRAME_OPTIONS = [
  { value: 'short', label: 'Short Term', sublabel: '< 1 month' },
  { value: 'medium', label: 'Medium Term', sublabel: '1-6 months' },
  { value: 'long', label: 'Long Term', sublabel: '> 6 months' },
]

const TEMPLATE_CONFIG = {
  earnings: { icon: BarChart3, label: 'Earnings Analysis', color: 'text-blue-400' },
  technical: { icon: TrendingUp, label: 'Technical Setup', color: 'text-purple-400' },
  fundamental: { icon: BookOpen, label: 'Fundamental Review', color: 'text-emerald-400' },
  news: { icon: Newspaper, label: 'News/Event Impact', color: 'text-amber-400' },
  custom: { icon: FileText, label: 'Custom Note', color: 'text-zinc-400' },
}

const SUGGESTED_TAGS = ['earnings', 'technical', 'fundamental', 'news', 'dividend', 'results', 'breakout', 'support', 'resistance', 'target', 'entry', 'exit', 'sector', 'macro']

export function StockNotesPanel({ scripCode, symbol, companyName, currentPrice, technicalContext, announcements = [] }: StockNotesPanelProps) {
  const { notes, add, update, remove, togglePin } = useStockNotes(scripCode)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof NOTE_TEMPLATES | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    sentiment: undefined as StockNote['sentiment'],
    template: 'custom' as StockNote['template'],
    priceTarget: undefined as number | undefined,
    stopLoss: undefined as number | undefined,
    timeframe: undefined as StockNote['timeframe'],
    confidence: undefined as StockNote['confidence'],
    linkedAnnouncement: undefined as string | undefined,
  })
  const [tagInput, setTagInput] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const handleSelectTemplate = (templateKey: keyof typeof NOTE_TEMPLATES) => {
    const template = NOTE_TEMPLATES[templateKey]
    setNewNote(prev => ({
      ...prev,
      title: template.title
        .replace('{Q}', `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`)
        .replace('{FY}', String(new Date().getFullYear()).slice(2)),
      content: template.content,
      tags: template.tags,
      template: templateKey as StockNote['template'],
    }))
    setSelectedTemplate(templateKey)
    setIsAddingNote(true)
  }

  const handleAddNote = () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return

    add({
      scripCode,
      symbol,
      companyName,
      title: newNote.title || 'Untitled Note',
      content: newNote.content,
      tags: newNote.tags,
      sentiment: newNote.sentiment,
      priceAtNote: currentPrice,
      isPinned: false,
      template: newNote.template,
      priceTarget: newNote.priceTarget,
      stopLoss: newNote.stopLoss,
      timeframe: newNote.timeframe,
      confidence: newNote.confidence,
      announcementId: newNote.linkedAnnouncement,
    })

    resetForm()
  }

  const resetForm = () => {
    setNewNote({
      title: '',
      content: '',
      tags: [],
      sentiment: undefined,
      template: 'custom',
      priceTarget: undefined,
      stopLoss: undefined,
      timeframe: undefined,
      confidence: undefined,
      linkedAnnouncement: undefined,
    })
    setIsAddingNote(false)
    setSelectedTemplate(null)
    setTagInput('')
  }

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim().replace(/^#/, '')
    if (normalizedTag && !newNote.tags.includes(normalizedTag)) {
      setNewNote(prev => ({ ...prev, tags: [...prev.tags, normalizedTag] }))
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setNewNote(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  const handleCopyNote = async (note: StockNote) => {
    const text = `# ${note.title}\n\n${note.content}\n\n---\n${symbol} | ₹${note.priceAtNote?.toLocaleString('en-IN') || '—'} | ${new Date(note.createdAt).toLocaleDateString('en-IN')}`
    await navigator.clipboard.writeText(text)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 2000)
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

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering
    return content
      .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold text-white mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400 text-xs font-mono">$1</code>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 text-zinc-300">• $1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-zinc-300">$1. $2</li>')
      .replace(/\n/g, '<br/>')
  }

  const pinnedNotes = notes.filter(n => n.isPinned)
  const recentNotes = notes.filter(n => !n.isPinned)

  // Calculate note stats
  const noteStats = useMemo(() => {
    const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 }
    notes.forEach(n => {
      if (n.sentiment) sentimentCounts[n.sentiment]++
    })
    return sentimentCounts
  }, [notes])

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
            <FileText className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">My Research Notes</h3>
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
              {notes.length > 0 && (
                <>
                  <span className="text-zinc-700">•</span>
                  <div className="flex items-center gap-2">
                    {noteStats.bullish > 0 && (
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <TrendingUp className="h-3 w-3" /> {noteStats.bullish}
                      </span>
                    )}
                    {noteStats.bearish > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-400">
                        <TrendingDown className="h-3 w-3" /> {noteStats.bearish}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden sm:inline px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-500 font-mono">N</kbd>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-zinc-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-zinc-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800">
          {/* Template Selector / Add Note Button */}
          {!isAddingNote ? (
            <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
              <p className="text-xs text-zinc-500 mb-3">Start with a template or create a custom note</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(TEMPLATE_CONFIG) as Array<keyof typeof TEMPLATE_CONFIG>).map(key => {
                  const config = TEMPLATE_CONFIG[key]
                  const Icon = config.icon
                  return (
                    <button
                      key={key}
                      onClick={() => key === 'custom' ? setIsAddingNote(true) : handleSelectTemplate(key as keyof typeof NOTE_TEMPLATES)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-all group"
                    >
                      <Icon className={`h-5 w-5 ${config.color} group-hover:scale-110 transition-transform`} />
                      <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Note Editor */
            <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {selectedTemplate && TEMPLATE_CONFIG[selectedTemplate] && (
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 text-xs ${TEMPLATE_CONFIG[selectedTemplate].color}`}>
                      {(() => { const Icon = TEMPLATE_CONFIG[selectedTemplate].icon; return <Icon className="h-3.5 w-3.5" /> })()}
                      {TEMPLATE_CONFIG[selectedTemplate].label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`p-2 rounded-lg transition-colors ${showPreview ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-zinc-700 text-zinc-500'}`}
                    title={showPreview ? 'Edit' : 'Preview'}
                  >
                    {showPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Note title..."
                value={newNote.title}
                onChange={e => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-transparent text-white text-lg font-semibold placeholder:text-zinc-600 outline-none mb-3"
                autoFocus
              />
              
              {showPreview ? (
                <div 
                  className="prose prose-invert prose-sm max-w-none min-h-[200px] p-4 rounded-xl bg-zinc-900/50 border border-zinc-700"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(newNote.content) }}
                />
              ) : (
                <textarea
                  ref={contentRef}
                  placeholder="Write your research notes here... (supports **bold**, *italic*, `code`, ## headings)"
                  value={newNote.content}
                  onChange={e => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-zinc-900/50 rounded-xl p-4 text-zinc-300 placeholder:text-zinc-600 outline-none resize-none min-h-[200px] border border-zinc-700 focus:border-cyan-500/50 transition-colors font-mono text-sm"
                />
              )}

              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <Tag className="h-4 w-4 text-zinc-500" />
                {newNote.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium flex items-center gap-1 group"
                  >
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault()
                      handleAddTag(tagInput)
                    }
                  }}
                  className="bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none w-24"
                />
              </div>

              {/* Suggested Tags */}
              <div className="mt-2 flex flex-wrap gap-1">
                {SUGGESTED_TAGS.filter(t => !newNote.tags.includes(t)).slice(0, 6).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleAddTag(tag)}
                    className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {/* Advanced Options */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Sentiment */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Sentiment</label>
                  <div className="flex gap-1">
                    {(['bullish', 'bearish', 'neutral'] as const).map(sentiment => {
                      const config = SENTIMENT_CONFIG[sentiment]
                      const Icon = config.icon
                      const isSelected = newNote.sentiment === sentiment
                      return (
                        <button
                          key={sentiment}
                          onClick={() => setNewNote(prev => ({ 
                            ...prev, 
                            sentiment: prev.sentiment === sentiment ? undefined : sentiment 
                          }))}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                            isSelected 
                              ? `${config.bg} ${config.color} ${config.border} border` 
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent'
                          }`}
                          title={config.label}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Timeframe */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Timeframe</label>
                  <select
                    value={newNote.timeframe || ''}
                    onChange={e => setNewNote(prev => ({ ...prev, timeframe: e.target.value as StockNote['timeframe'] || undefined }))}
                    className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none border border-zinc-700 focus:border-cyan-500/50"
                  >
                    <option value="">Select...</option>
                    {TIMEFRAME_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Price Target */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Price Target</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="Target"
                      value={newNote.priceTarget || ''}
                      onChange={e => setNewNote(prev => ({ ...prev, priceTarget: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="w-full bg-zinc-800 rounded-lg pl-6 pr-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none border border-zinc-700 focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                {/* Confidence */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Confidence</label>
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setNewNote(prev => ({ ...prev, confidence: prev.confidence === level ? undefined : level }))}
                        className={`flex-1 py-2 rounded-lg transition-all ${
                          newNote.confidence && newNote.confidence >= level
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-zinc-800 text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 mx-auto ${newNote.confidence && newNote.confidence >= level ? 'fill-amber-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Link to Announcement */}
              {announcements.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs text-zinc-500 mb-1.5 block flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Link to Announcement
                  </label>
                  <select
                    value={newNote.linkedAnnouncement || ''}
                    onChange={e => setNewNote(prev => ({ ...prev, linkedAnnouncement: e.target.value || undefined }))}
                    className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none border border-zinc-700 focus:border-cyan-500/50"
                  >
                    <option value="">None</option>
                    {announcements.slice(0, 10).map(ann => (
                      <option key={ann.id} value={ann.id}>{ann.headline.slice(0, 60)}...</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current Price Indicator */}
              {currentPrice && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-zinc-500">Current price:</span>
                  <span className="text-sm font-medium text-white">₹{currentPrice.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-zinc-600">(will be saved with note)</span>
                </div>
              )}

              {/* Technical Context Snapshot */}
              {technicalContext && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Technical Snapshot</span>
                    <span className="text-[10px] text-zinc-500">(auto-captured)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {technicalContext.rsi !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">RSI(14)</span>
                        <span className={`font-semibold ${
                          technicalContext.rsi > 70 ? 'text-rose-400' : 
                          technicalContext.rsi < 30 ? 'text-emerald-400' : 'text-white'
                        }`}>{technicalContext.rsi.toFixed(1)}</span>
                      </div>
                    )}
                    {technicalContext.ma20 !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">MA(20)</span>
                        <span className={`font-semibold ${currentPrice && currentPrice > technicalContext.ma20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{technicalContext.ma20.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {technicalContext.ma50 !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">MA(50)</span>
                        <span className={`font-semibold ${currentPrice && currentPrice > technicalContext.ma50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{technicalContext.ma50.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {technicalContext.ma200 !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">MA(200)</span>
                        <span className={`font-semibold ${currentPrice && currentPrice > technicalContext.ma200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{technicalContext.ma200.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {technicalContext.support !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">Support</span>
                        <span className="font-semibold text-emerald-400">₹{technicalContext.support.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    {technicalContext.resistance !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">Resistance</span>
                        <span className="font-semibold text-rose-400">₹{technicalContext.resistance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    {technicalContext.volume !== undefined && technicalContext.avgVolume !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">Vol vs Avg</span>
                        <span className={`font-semibold ${technicalContext.volume > technicalContext.avgVolume * 1.5 ? 'text-amber-400' : 'text-white'}`}>
                          {((technicalContext.volume / technicalContext.avgVolume) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {technicalContext.weekHigh52 !== undefined && (
                      <div className="p-2 rounded-lg bg-zinc-900/50">
                        <span className="text-zinc-500 block">52W High</span>
                        <span className="font-semibold text-white">₹{technicalContext.weekHigh52.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-2 text-[10px] text-zinc-600">
                    This context will be saved with your note so you remember the chart conditions at this moment.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2 justify-end">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.title.trim() && !newNote.content.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                  <Save className="h-4 w-4" />
                  Save Note
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="max-h-[500px] overflow-y-auto">
            {notes.length === 0 && !isAddingNote ? (
              <div className="p-8 text-center text-zinc-500">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 opacity-30" />
                </div>
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs mt-1 text-zinc-600">Start documenting your research for {symbol}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {/* Pinned Notes */}
                {pinnedNotes.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Pin className="h-3 w-3" /> Pinned
                    </div>
                    {pinnedNotes.map(note => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        onTogglePin={togglePin} 
                        onDelete={remove}
                        onCopy={handleCopyNote}
                        isCopied={copiedId === note.id}
                        formatDate={formatDate}
                        renderMarkdown={renderMarkdown}
                      />
                    ))}
                  </div>
                )}

                {/* Recent Notes */}
                {recentNotes.length > 0 && (
                  <div className="p-2">
                    {pinnedNotes.length > 0 && (
                      <div className="px-2 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Recent
                      </div>
                    )}
                    {recentNotes.map(note => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        onTogglePin={togglePin} 
                        onDelete={remove}
                        onCopy={handleCopyNote}
                        isCopied={copiedId === note.id}
                        formatDate={formatDate}
                        renderMarkdown={renderMarkdown}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {notes.length > 0 && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <Link
                href="/notes"
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                View all notes <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
              </Link>
              <span className="text-xs text-zinc-600">
                Last updated: {notes[0] ? formatDate(notes[0].updatedAt) : '—'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface NoteCardProps {
  note: StockNote
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onCopy: (note: StockNote) => void
  isCopied: boolean
  formatDate: (date: string) => string
  renderMarkdown: (content: string) => string
}

function NoteCard({ note, onTogglePin, onDelete, onCopy, isCopied, formatDate, renderMarkdown }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const SentimentIcon = note.sentiment ? SENTIMENT_CONFIG[note.sentiment].icon : null
  const sentimentConfig = note.sentiment ? SENTIMENT_CONFIG[note.sentiment] : null
  const templateConfig = note.template ? TEMPLATE_CONFIG[note.template] : null

  return (
    <div className={`p-3 rounded-xl hover:bg-zinc-800/50 transition-colors group ${note.isPinned ? 'bg-amber-500/5' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {note.isPinned && (
              <Pin className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
            {templateConfig && note.template !== 'custom' && (
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 ${templateConfig.color}`}>
                {(() => { const Icon = templateConfig.icon; return <Icon className="h-2.5 w-2.5" /> })()}
              </span>
            )}
            <h4 className="font-semibold text-white truncate">{note.title}</h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {sentimentConfig && SentimentIcon && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${sentimentConfig.bg} ${sentimentConfig.color}`}>
                <SentimentIcon className="h-3 w-3" />
                {sentimentConfig.label}
              </span>
            )}
            {note.timeframe && (
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs">
                {TIMEFRAME_OPTIONS.find(t => t.value === note.timeframe)?.label}
              </span>
            )}
            {note.priceTarget && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs">
                <Target className="h-3 w-3" /> ₹{note.priceTarget.toLocaleString('en-IN')}
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
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(note)}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
            title="Copy note"
          >
            {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onTogglePin(note.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              note.isPinned 
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                : 'hover:bg-zinc-700 text-zinc-500 hover:text-amber-400'
            }`}
            title={note.isPinned ? 'Unpin' : 'Pin'}
          >
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {note.content && (
        <div 
          className={`mt-2 text-sm text-zinc-400 ${isExpanded ? '' : 'line-clamp-3'}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <div 
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
            />
          ) : (
            <p className="whitespace-pre-wrap cursor-pointer">{note.content}</p>
          )}
        </div>
      )}

      {note.content && note.content.length > 150 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(note.updatedAt)}
        </span>
        {note.priceAtNote && (
          <span>
            Price: ₹{note.priceAtNote.toLocaleString('en-IN')}
            {note.priceTarget && (
              <span className={note.priceTarget > note.priceAtNote ? 'text-emerald-400' : 'text-rose-400'}>
                {' '}({((note.priceTarget - note.priceAtNote) / note.priceAtNote * 100).toFixed(1)}% target)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
