'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Note, LinkedAnnouncement } from '@/lib/notes-types'
import { useLivePrices, computePnL } from '@/hooks/useLivePrices'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus as HRIcon,
  Link,
  Pin,
  Trash2,
  Copy,
  MoreHorizontal,
  FileText,
  Type,
  Undo2,
  Redo2,
  Download,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Target,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  LinkIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Tag,
  Activity,
} from 'lucide-react'

type NoteUpdateFields = Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'tags' | 'pinned' | 'locked' | 'passwordHash' | 'scripCode' | 'symbol' | 'companyName' | 'sentiment' | 'priceAtCreation' | 'priceTarget' | 'stopLoss' | 'confidence' | 'timeframe' | 'template' | 'linkedAnnouncements' | 'linkedNoteIds' | 'thesisStatus' | 'closedAt' | 'closedPrice'>>

interface NoteEditorProps {
  note: Note | null
  onUpdateNote: (id: string, updates: NoteUpdateFields) => void
  onDeleteNote: (id: string) => void
  onTogglePin: (id: string) => void
  onDuplicateNote: (id: string) => void
}

interface StockSearchResult {
  scripCode: string
  symbol: string
  companyName: string
}

export default function NoteEditor({
  note,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  onDuplicateNote,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [lastSaved, setLastSaved] = useState<string>('')
  const isInitialLoadRef = useRef(true)
  const currentNoteIdRef = useRef<string | null>(null)
  const [researchPanelOpen, setResearchPanelOpen] = useState(true)
  const [stockSearch, setStockSearch] = useState('')
  const [stockResults, setStockResults] = useState<StockSearchResult[]>([])
  const [showStockSearch, setShowStockSearch] = useState(false)
  const [showCloseThesis, setShowCloseThesis] = useState(false)
  const [closedPrice, setClosedPrice] = useState('')
  const stockSearchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [tagInput, setTagInput] = useState('')

  // Live price tracking
  const scripCodes = useMemo(() => note?.scripCode ? [note.scripCode] : [], [note?.scripCode])
  const livePrices = useLivePrices(scripCodes)
  const currentLivePrice = note?.scripCode ? livePrices[note.scripCode] : undefined
  const pnlData = computePnL(note?.priceAtCreation, currentLivePrice?.price)

  // Load note content into editor
  useEffect(() => {
    if (!note) return

    if (currentNoteIdRef.current !== note.id) {
      currentNoteIdRef.current = note.id
      isInitialLoadRef.current = true

      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || '<p><br></p>'
      }
      if (titleRef.current) {
        titleRef.current.value = note.title || ''
      }

      setWordCount(note.wordCount || 0)
      updateLastSaved(note.modified)
      isInitialLoadRef.current = false
    }
  }, [note])

  const updateLastSaved = (timestamp: number) => {
    const date = new Date(timestamp)
    setLastSaved(date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  }

  // Auto-save with debounce
  const scheduleAutoSave = useCallback((content: string) => {
    if (!note || isInitialLoadRef.current) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      onUpdateNote(note.id, { content })
      updateLastSaved(Date.now())
    }, 500)
  }, [note, onUpdateNote])

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !note) return
    const content = editorRef.current.innerHTML
    const text = editorRef.current.textContent || ''
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
    scheduleAutoSave(content)
  }, [note, scheduleAutoSave])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!note) return
    onUpdateNote(note.id, { title: e.target.value })
  }, [note, onUpdateNote])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editorRef.current?.focus()
    }
  }, [])

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleEditorInput()
  }, [handleEditorInput])

  const formatHeading = useCallback((level: string) => {
    document.execCommand('formatBlock', false, level)
    editorRef.current?.focus()
    handleEditorInput()
  }, [handleEditorInput])

  const insertChecklist = useCallback(() => {
    document.execCommand('insertHTML', false, '<ul class="checklist"><li><input type="checkbox"> </li></ul>')
    editorRef.current?.focus()
    handleEditorInput()
  }, [handleEditorInput])

  const insertCodeBlock = useCallback(() => {
    document.execCommand('insertHTML', false, '<pre><code>// code here</code></pre><p><br></p>')
    editorRef.current?.focus()
    handleEditorInput()
  }, [handleEditorInput])

  const insertHR = useCallback(() => {
    document.execCommand('insertHorizontalRule')
    editorRef.current?.focus()
    handleEditorInput()
  }, [handleEditorInput])

  const insertLink = useCallback(() => {
    if (linkUrl) {
      document.execCommand('createLink', false, linkUrl)
      setLinkUrl('')
      setShowLinkModal(false)
      editorRef.current?.focus()
      handleEditorInput()
    }
  }, [linkUrl, handleEditorInput])

  // Keyboard shortcuts
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cmdKey = e.ctrlKey || e.metaKey
    if (cmdKey && e.key === 'b') { e.preventDefault(); execCommand('bold') }
    else if (cmdKey && e.key === 'i') { e.preventDefault(); execCommand('italic') }
    else if (cmdKey && e.key === 'u') { e.preventDefault(); execCommand('underline') }
    else if (cmdKey && e.key === 'k') { e.preventDefault(); setShowLinkModal(true) }
    else if (cmdKey && e.shiftKey && e.key === 'x') { e.preventDefault(); execCommand('strikeThrough') }
    else if (e.key === 'Tab') { e.preventDefault(); execCommand('insertText', '    ') }

    // Markdown shortcuts
    if (e.key === ' ' && editorRef.current) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const node = range.startContainer
        const text = node.textContent || ''
        if (text === '#') { e.preventDefault(); node.textContent = ''; formatHeading('h1') }
        else if (text === '##') { e.preventDefault(); node.textContent = ''; formatHeading('h2') }
        else if (text === '###') { e.preventDefault(); node.textContent = ''; formatHeading('h3') }
        else if (text === '>') { e.preventDefault(); node.textContent = ''; formatHeading('blockquote') }
        else if (text === '-' || text === '*') { e.preventDefault(); node.textContent = ''; execCommand('insertUnorderedList') }
        else if (text === '1.') { e.preventDefault(); node.textContent = ''; execCommand('insertOrderedList') }
        else if (text === '---') { e.preventDefault(); node.textContent = ''; insertHR() }
        else if (text === '[]') { e.preventDefault(); node.textContent = ''; insertChecklist() }
      }
    }
  }, [execCommand, formatHeading, insertHR, insertChecklist])

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      setTimeout(handleEditorInput, 10)
    }
  }, [handleEditorInput])

  const exportMarkdown = useCallback(() => {
    if (!note) return
    const text = note.plainText || ''
    const blob = new Blob([`# ${note.title}\n\n${text}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [note])

  // Stock search
  const handleStockSearch = useCallback((query: string) => {
    setStockSearch(query)
    if (stockSearchTimeout.current) clearTimeout(stockSearchTimeout.current)
    if (!query.trim()) { setStockResults([]); return }
    
    stockSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bse/search?q=${encodeURIComponent(query)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setStockResults((data.results || data || []).slice(0, 5).map((r: Record<string, string>) => ({
            scripCode: r.scripCode || r.scrip_code || r.SCRIP_CD || '',
            symbol: r.symbol || r.scrip_id || r.SCRIP_ID || r.scripCode || '',
            companyName: r.companyName || r.company_name || r.LONG_NAME || r.name || '',
          })))
        }
      } catch {
        setStockResults([])
      }
    }, 300)
  }, [])

  const selectStock = useCallback((stock: StockSearchResult) => {
    if (!note) return
    onUpdateNote(note.id, {
      scripCode: stock.scripCode,
      symbol: stock.symbol,
      companyName: stock.companyName,
    })
    setShowStockSearch(false)
    setStockSearch('')
    setStockResults([])
    
    // Auto-fetch current price
    fetch(`/api/bse/quote?symbol=${encodeURIComponent(stock.scripCode)}`)
      .then(res => res.json())
      .then(data => {
        if (data.currentPrice && !note.priceAtCreation) {
          onUpdateNote(note.id, { priceAtCreation: data.currentPrice })
        }
      })
      .catch(() => {})
  }, [note, onUpdateNote])

  const handleCloseThesis = useCallback((result: 'closed-win' | 'closed-loss' | 'invalidated') => {
    if (!note) return
    const price = closedPrice ? parseFloat(closedPrice) : undefined
    onUpdateNote(note.id, {
      thesisStatus: result,
      closedAt: Date.now(),
      closedPrice: price,
    })
    setShowCloseThesis(false)
    setClosedPrice('')
  }, [note, onUpdateNote, closedPrice])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (stockSearchTimeout.current) clearTimeout(stockSearchTimeout.current)
    }
  }, [])

  if (!note) {
    return (
      <div className="notes-empty-state">
        <FileText className="notes-empty-icon" />
        <p className="notes-empty-title">Select a research note</p>
        <p className="notes-empty-description">Choose a note from the list or create a new one</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="notes-toolbar flex-wrap">
        <button onClick={() => execCommand('undo')} className="notes-toolbar-btn" title="Undo"><Undo2 className="w-4 h-4" /></button>
        <button onClick={() => execCommand('redo')} className="notes-toolbar-btn" title="Redo"><Redo2 className="w-4 h-4" /></button>
        <div className="notes-toolbar-divider" />
        <button onClick={() => formatHeading('p')} className="notes-toolbar-btn" title="Paragraph"><Type className="w-4 h-4" /></button>
        <button onClick={() => formatHeading('h1')} className="notes-toolbar-btn" title="Heading 1"><Heading1 className="w-4 h-4" /></button>
        <button onClick={() => formatHeading('h2')} className="notes-toolbar-btn" title="Heading 2"><Heading2 className="w-4 h-4" /></button>
        <button onClick={() => formatHeading('h3')} className="notes-toolbar-btn" title="Heading 3"><Heading3 className="w-4 h-4" /></button>
        <div className="notes-toolbar-divider" />
        <button onClick={() => execCommand('bold')} className="notes-toolbar-btn" title="Bold"><Bold className="w-4 h-4" /></button>
        <button onClick={() => execCommand('italic')} className="notes-toolbar-btn" title="Italic"><Italic className="w-4 h-4" /></button>
        <button onClick={() => execCommand('underline')} className="notes-toolbar-btn" title="Underline"><Underline className="w-4 h-4" /></button>
        <button onClick={() => execCommand('strikeThrough')} className="notes-toolbar-btn" title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
        <div className="notes-toolbar-divider" />
        <button onClick={() => execCommand('insertUnorderedList')} className="notes-toolbar-btn" title="Bullet List"><List className="w-4 h-4" /></button>
        <button onClick={() => execCommand('insertOrderedList')} className="notes-toolbar-btn" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
        <button onClick={insertChecklist} className="notes-toolbar-btn" title="Checklist"><CheckSquare className="w-4 h-4" /></button>
        <div className="notes-toolbar-divider" />
        <button onClick={() => formatHeading('blockquote')} className="notes-toolbar-btn" title="Quote"><Quote className="w-4 h-4" /></button>
        <button onClick={insertCodeBlock} className="notes-toolbar-btn" title="Code Block"><Code className="w-4 h-4" /></button>
        <button onClick={insertHR} className="notes-toolbar-btn" title="Horizontal Rule"><HRIcon className="w-4 h-4" /></button>
        <button onClick={() => setShowLinkModal(true)} className="notes-toolbar-btn" title="Insert Link"><Link className="w-4 h-4" /></button>
        <div className="flex-1" />
        <button
          onClick={() => onTogglePin(note.id)}
          className={`notes-toolbar-btn ${note.pinned ? 'text-[var(--notes-accent-yellow)]' : ''}`}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <Pin className="w-4 h-4" />
        </button>
        <div className="relative">
          <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="notes-toolbar-btn" title="More">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-[998]" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-[999] bg-[var(--notes-bg-elevated)] border border-[var(--notes-border-primary)] rounded-lg shadow-lg min-w-[180px] p-1 notes-animate-scale-in">
                <button className="notes-context-item w-full" onClick={() => { onDuplicateNote(note.id); setShowMoreMenu(false) }}>
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button className="notes-context-item w-full" onClick={() => { exportMarkdown(); setShowMoreMenu(false) }}>
                  <Download className="w-4 h-4" /> Export as Markdown
                </button>
                <div className="notes-context-divider" />
                <button className="notes-context-item danger w-full" onClick={() => { onDeleteNote(note.id); setShowMoreMenu(false) }}>
                  <Trash2 className="w-4 h-4" /> Move to Trash
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Research Panel Toggle */}
      <button
        onClick={() => setResearchPanelOpen(!researchPanelOpen)}
        className="flex items-center gap-2 px-6 py-2 border-b border-[var(--notes-border-tertiary)] text-sm text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)] transition-colors"
      >
        <Zap className="w-4 h-4 text-[var(--notes-accent-blue)]" />
        <span className="font-medium">Research Panel</span>
        {note.symbol && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--notes-accent-blue)]/15 text-[var(--notes-accent-blue)]">
            {note.symbol}
          </span>
        )}
          {note.sentiment && (
            <SentimentBadge sentiment={note.sentiment} />
          )}
          {pnlData && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              pnlData.isPositive ? 'bg-[#30D158]/15 text-[#30D158]' : 'bg-[#FF453A]/15 text-[#FF453A]'
            }`}>
              {pnlData.isPositive ? '+' : ''}{pnlData.pnlPercent.toFixed(1)}%
            </span>
          )}
        <div className="flex-1" />
        {researchPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Research Panel */}
      {researchPanelOpen && (
        <div className="border-b border-[var(--notes-border-tertiary)] bg-[var(--notes-bg-secondary)] notes-animate-fade-in">
          <div className="px-6 py-4 space-y-4">
            {/* Row 1: Stock + Sentiment */}
            <div className="flex flex-wrap gap-3">
              {/* Stock Picker */}
              <div className="flex-1 min-w-[200px] relative">
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">Stock</label>
                {note.scripCode ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--notes-accent-blue)]/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-[var(--notes-accent-blue)]">{(note.symbol || '').slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--notes-text-primary)]">{note.symbol}</div>
                      <div className="text-[10px] text-[var(--notes-text-tertiary)] truncate">{note.companyName}</div>
                    </div>
                    <button
                      onClick={() => onUpdateNote(note.id, { scripCode: undefined, symbol: undefined, companyName: undefined })}
                      className="p-1 hover:bg-[var(--notes-bg-hover)] rounded"
                    >
                      <X className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div
                      className="flex items-center gap-2 p-2 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] cursor-pointer hover:border-[var(--notes-accent-blue)] transition-colors"
                      onClick={() => setShowStockSearch(true)}
                    >
                      <Search className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
                      <span className="text-sm text-[var(--notes-text-placeholder)]">Link a stock...</span>
                    </div>
                    {showStockSearch && (
                      <>
                        <div className="fixed inset-0 z-[97]" onClick={() => { setShowStockSearch(false); setStockResults([]) }} />
                        <div className="absolute top-full left-0 right-0 mt-1 z-[98] bg-[var(--notes-bg-elevated)] border border-[var(--notes-border-primary)] rounded-lg shadow-lg p-2 notes-animate-scale-in">
                          <input
                            type="text"
                            value={stockSearch}
                            onChange={(e) => handleStockSearch(e.target.value)}
                            placeholder="Search stock name or code..."
                            autoFocus
                            className="w-full px-3 py-2 bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] rounded-md text-sm text-[var(--notes-text-primary)] outline-none focus:border-[var(--notes-accent-blue)] placeholder:text-[var(--notes-text-placeholder)]"
                          />
                          {stockResults.length > 0 && (
                            <div className="mt-1 max-h-[200px] overflow-y-auto">
                              {stockResults.map(r => (
                                <button
                                  key={r.scripCode}
                                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[var(--notes-bg-hover)] transition-colors"
                                  onClick={() => selectStock(r)}
                                >
                                  <span className="font-semibold text-[var(--notes-text-primary)]">{r.symbol}</span>
                                  <span className="text-[var(--notes-text-tertiary)] ml-2">{r.companyName}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Sentiment */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">Sentiment</label>
                <div className="flex gap-1">
                  {(['bullish', 'neutral', 'bearish'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => onUpdateNote(note.id, { sentiment: note.sentiment === s ? undefined : s })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        note.sentiment === s
                          ? s === 'bullish' ? 'bg-[#30D158]/20 text-[#30D158] ring-1 ring-[#30D158]/40'
                          : s === 'bearish' ? 'bg-[#FF453A]/20 text-[#FF453A] ring-1 ring-[#FF453A]/40'
                          : 'bg-[#8E8E93]/20 text-[#8E8E93] ring-1 ring-[#8E8E93]/40'
                          : 'bg-[var(--notes-bg-tertiary)] text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)]'
                      }`}
                    >
                      {s === 'bullish' && <TrendingUp className="w-3.5 h-3.5 inline mr-1" />}
                      {s === 'bearish' && <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}
                      {s === 'neutral' && <Minus className="w-3.5 h-3.5 inline mr-1" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Price Fields + Confidence */}
            <div className="flex flex-wrap gap-3">
              <div className="w-[120px]">
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">
                  Entry Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--notes-text-tertiary)] text-sm">₹</span>
                  <input
                    type="number"
                    value={note.priceAtCreation || ''}
                    onChange={(e) => onUpdateNote(note.id, { priceAtCreation: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-2 py-2 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] text-sm text-[var(--notes-text-primary)] outline-none focus:border-[var(--notes-accent-blue)] placeholder:text-[var(--notes-text-placeholder)]"
                  />
                </div>
              </div>

              <div className="w-[120px]">
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3 text-[#30D158]" /> Target
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--notes-text-tertiary)] text-sm">₹</span>
                  <input
                    type="number"
                    value={note.priceTarget || ''}
                    onChange={(e) => onUpdateNote(note.id, { priceTarget: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-2 py-2 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] text-sm text-[#30D158] outline-none focus:border-[#30D158] placeholder:text-[var(--notes-text-placeholder)]"
                  />
                </div>
              </div>

              <div className="w-[120px]">
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-[#FF453A]" /> Stop Loss
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--notes-text-tertiary)] text-sm">₹</span>
                  <input
                    type="number"
                    value={note.stopLoss || ''}
                    onChange={(e) => onUpdateNote(note.id, { stopLoss: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="0.00"
                    className="w-full pl-7 pr-2 py-2 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] text-sm text-[#FF453A] outline-none focus:border-[#FF453A] placeholder:text-[var(--notes-text-placeholder)]"
                  />
                </div>
              </div>

              {/* Confidence */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">Confidence</label>
                <div className="flex gap-1 py-2">
                  {([1, 2, 3, 4, 5] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => onUpdateNote(note.id, { confidence: note.confidence === level ? undefined : level })}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star className={`w-5 h-5 ${
                        (note.confidence || 0) >= level 
                          ? 'text-[#FFD60A] fill-[#FFD60A]' 
                          : 'text-[var(--notes-text-quaternary)]'
                      }`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">Timeframe</label>
                <div className="flex gap-1">
                  {(['short', 'medium', 'long'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => onUpdateNote(note.id, { timeframe: note.timeframe === tf ? undefined : tf })}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        note.timeframe === tf
                          ? 'bg-[var(--notes-accent-blue)]/20 text-[var(--notes-accent-blue)] ring-1 ring-[var(--notes-accent-blue)]/40'
                          : 'bg-[var(--notes-bg-tertiary)] text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)]'
                      }`}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      {tf === 'short' ? '<1M' : tf === 'medium' ? '1-6M' : '>6M'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

              {/* Row 3: Thesis Status + Risk/Reward + Live Price */}
              <div className="flex flex-wrap gap-3 items-end">
                {/* Live Price & P&L */}
                {note.scripCode && currentLivePrice && (
                  <div className="p-2.5 rounded-lg bg-[var(--notes-bg-primary)] border border-[var(--notes-border-tertiary)]">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[var(--notes-accent-blue)]" />
                      <span className="text-sm font-bold text-[var(--notes-text-primary)]">
                        ₹{currentLivePrice.price.toLocaleString('en-IN')}
                      </span>
                      {currentLivePrice.changePercent != null && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          currentLivePrice.changePercent >= 0
                            ? 'bg-[#30D158]/15 text-[#30D158]'
                            : 'bg-[#FF453A]/15 text-[#FF453A]'
                        }`}>
                          {currentLivePrice.changePercent >= 0 ? '+' : ''}{currentLivePrice.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    {pnlData && (
                      <div className={`text-[10px] mt-1 font-medium ${pnlData.isPositive ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                        Since entry: {pnlData.isPositive ? '+' : ''}{pnlData.pnlPercent.toFixed(2)}% ({pnlData.isPositive ? '+' : ''}₹{pnlData.pnl.toFixed(2)})
                      </div>
                    )}
                  </div>
                )}

                {/* Thesis Status */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">Thesis Status</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => onUpdateNote(note.id, { thesisStatus: note.thesisStatus === 'active' ? undefined : 'active' })}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      note.thesisStatus === 'active'
                        ? 'bg-[#BF5AF2]/20 text-[#BF5AF2] ring-1 ring-[#BF5AF2]/40'
                        : 'bg-[var(--notes-bg-tertiary)] text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)]'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" /> Active
                  </button>
                  {note.thesisStatus === 'active' && (
                    <button
                      onClick={() => setShowCloseThesis(!showCloseThesis)}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-[var(--notes-bg-tertiary)] text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)] transition-all"
                    >
                      Close Thesis...
                    </button>
                  )}
                  {(note.thesisStatus === 'closed-win' || note.thesisStatus === 'closed-loss' || note.thesisStatus === 'invalidated') && (
                    <span className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      note.thesisStatus === 'closed-win' ? 'bg-[#30D158]/20 text-[#30D158]'
                      : note.thesisStatus === 'closed-loss' ? 'bg-[#FF453A]/20 text-[#FF453A]'
                      : 'bg-[#8E8E93]/20 text-[#8E8E93]'
                    }`}>
                      {note.thesisStatus === 'closed-win' && <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Win</>}
                      {note.thesisStatus === 'closed-loss' && <><XCircle className="w-3.5 h-3.5 inline mr-1" />Loss</>}
                      {note.thesisStatus === 'invalidated' && <><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Invalidated</>}
                      {note.closedPrice && (
                        <span className="ml-1">@ ₹{note.closedPrice.toLocaleString('en-IN')}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Risk/Reward Ratio */}
              {note.priceAtCreation && note.priceTarget && note.stopLoss && (
                <div className="ml-auto">
                  <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block text-right">Risk:Reward</label>
                  <div className="text-lg font-bold text-[var(--notes-text-primary)]">
                    {(() => {
                      const reward = Math.abs(note.priceTarget - note.priceAtCreation)
                      const risk = Math.abs(note.priceAtCreation - note.stopLoss)
                      const ratio = risk > 0 ? (reward / risk).toFixed(1) : '∞'
                      return (
                        <span className={parseFloat(String(ratio)) >= 2 ? 'text-[#30D158]' : parseFloat(String(ratio)) >= 1 ? 'text-[#FFD60A]' : 'text-[#FF453A]'}>
                          1:{ratio}
                        </span>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Close Thesis Panel */}
            {showCloseThesis && (
              <div className="p-3 rounded-lg bg-[var(--notes-bg-primary)] border border-[var(--notes-border-primary)] notes-animate-scale-in">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-[var(--notes-text-primary)]">Close this thesis</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-[var(--notes-text-tertiary)]">Exit Price:</label>
                  <div className="relative flex-1 max-w-[150px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--notes-text-tertiary)] text-sm">₹</span>
                    <input
                      type="number"
                      value={closedPrice}
                      onChange={(e) => setClosedPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-2 py-1.5 rounded-md bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)] text-sm text-[var(--notes-text-primary)] outline-none focus:border-[var(--notes-accent-blue)]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCloseThesis('closed-win')}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-[#30D158]/20 text-[#30D158] hover:bg-[#30D158]/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Win
                  </button>
                  <button
                    onClick={() => handleCloseThesis('closed-loss')}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-[#FF453A]/20 text-[#FF453A] hover:bg-[#FF453A]/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Loss
                  </button>
                  <button
                    onClick={() => handleCloseThesis('invalidated')}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-[#8E8E93]/20 text-[#8E8E93] hover:bg-[#8E8E93]/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Invalid
                  </button>
                </div>
              </div>
            )}

              {/* Linked Announcements */}
              {note.linkedAnnouncements && note.linkedAnnouncements.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">
                    <LinkIcon className="w-3 h-3 inline mr-1" /> Linked Announcements
                  </label>
                  <div className="space-y-1">
                    {note.linkedAnnouncements.map((ann, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--notes-bg-tertiary)] text-xs">
                        <FileText className="w-3.5 h-3.5 text-[var(--notes-accent-blue)] flex-shrink-0" />
                        <span className="flex-1 truncate text-[var(--notes-text-primary)]">{ann.headline}</span>
                        <span className="text-[var(--notes-text-quaternary)]">{ann.date}</span>
                        <button
                          onClick={() => {
                            const updated = note.linkedAnnouncements!.filter((_, idx) => idx !== i)
                            onUpdateNote(note.id, { linkedAnnouncements: updated })
                          }}
                          className="p-0.5 hover:bg-[var(--notes-bg-hover)] rounded"
                        >
                          <X className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Editor */}
              <div>
                <label className="text-[10px] font-semibold text-[var(--notes-text-tertiary)] uppercase tracking-wider mb-1 block">
                  <Tag className="w-3 h-3 inline mr-1" /> Tags
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(note.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--notes-accent-blue)]/15 text-[var(--notes-accent-blue)] text-xs font-medium"
                    >
                      #{tag}
                      <button
                        onClick={() => {
                          const updated = (note.tags || []).filter(t => t !== tag)
                          onUpdateNote(note.id, { tags: updated })
                        }}
                        className="hover:text-[var(--notes-text-primary)] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault()
                        const tag = tagInput.toLowerCase().trim().replace(/^#/, '')
                        if (tag && !(note.tags || []).includes(tag)) {
                          onUpdateNote(note.id, { tags: [...(note.tags || []), tag] })
                        }
                        setTagInput('')
                      }
                    }}
                    placeholder="Add tag..."
                    className="w-20 bg-transparent text-xs text-[var(--notes-text-secondary)] placeholder:text-[var(--notes-text-placeholder)] outline-none"
                  />
                </div>
                {/* Suggested tags */}
                {(note.tags || []).length < 5 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['earnings', 'technical', 'fundamental', 'breakout', 'dividend', 'results', 'sector', 'entry', 'exit']
                      .filter(t => !(note.tags || []).includes(t))
                      .slice(0, 5)
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => onUpdateNote(note.id, { tags: [...(note.tags || []), tag] })}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--notes-bg-tertiary)] text-[var(--notes-text-quaternary)] hover:text-[var(--notes-text-secondary)] transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      {/* Title Input */}
      <div className="px-6 pt-6 pb-2">
        <input
          ref={titleRef}
          type="text"
          defaultValue={note.title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Research note title"
          className="w-full bg-transparent text-[var(--notes-text-3xl)] font-bold text-[var(--notes-text-primary)] outline-none tracking-tight placeholder:text-[var(--notes-text-placeholder)]"
          style={{ fontSize: 'var(--notes-text-3xl)', letterSpacing: '-0.02em' }}
        />
      </div>

      {/* Content Editor */}
      <div
        ref={editorRef}
        className="notes-editor notes-scrollbar flex-1"
        contentEditable
        suppressContentEditableWarning
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
        onClick={handleEditorClick}
        data-placeholder="Start writing your research..."
        role="textbox"
        aria-multiline="true"
        aria-label="Note content"
      />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-[var(--notes-border-tertiary)] text-[var(--notes-text-quaternary)] text-xs">
        <div className="flex items-center gap-3">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          {note.template && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--notes-accent-blue)]/10 text-[var(--notes-accent-blue)] capitalize">{note.template}</span>
          )}
        </div>
        {lastSaved && <span>Last saved {lastSaved}</span>}
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="notes-modal-overlay open" onClick={() => setShowLinkModal(false)}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="notes-modal-header">
              <span className="notes-modal-title">Insert Link</span>
              <button onClick={() => setShowLinkModal(false)} className="notes-toolbar-btn"><X className="w-4 h-4" /></button>
            </div>
            <div className="notes-modal-body">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                className="w-full bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-primary)] rounded-lg px-3 py-2 text-[var(--notes-text-primary)] text-sm outline-none focus:border-[var(--notes-accent-blue)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') insertLink()
                  if (e.key === 'Escape') setShowLinkModal(false)
                }}
              />
            </div>
            <div className="notes-modal-footer">
              <button onClick={() => setShowLinkModal(false)} className="notes-btn notes-btn-ghost">Cancel</button>
              <button onClick={insertLink} disabled={!linkUrl} className="notes-btn notes-btn-primary disabled:opacity-50">Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config = {
    bullish: { color: '#30D158', label: 'Bullish' },
    bearish: { color: '#FF453A', label: 'Bearish' },
    neutral: { color: '#8E8E93', label: 'Neutral' },
  }
  const c = config[sentiment as keyof typeof config] || config.neutral
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
      {c.label}
    </span>
  )
}
