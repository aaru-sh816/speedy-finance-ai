'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X, Star, TrendingUp, TrendingDown, Minus, Target,
  Tag, Sparkles, Send, FileText, BarChart3, BookOpen,
  Newspaper, Pin, PinOff, Trash2, Loader2, Check,
  ChevronDown, ChevronUp, Plus, Maximize2, Minimize2
} from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import type { Note, LinkedAnnouncement } from '@/lib/notes-types'
import { DEFAULT_TEMPLATES } from '@/lib/notes-types'

// ─── Public Types ─────────────────────────────────────────────────────────────
export interface ResearchNoteContext {
  scripCode: string
  symbol: string
  companyName: string
  currentPrice?: number
  changePercent?: number
  announcement?: {
    id: string
    headline: string
    date: string
    category?: string
    pdfUrl?: string
  }
}

interface ResearchNoteOverlayProps {
  isOpen: boolean
  onClose: () => void
  context?: ResearchNoteContext
  editNoteId?: string
  initialTitle?: string
  initialContent?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const SENTIMENTS = [
  { value: 'bullish' as const, label: 'Bull', Icon: TrendingUp },
  { value: 'bearish' as const, label: 'Bear', Icon: TrendingDown },
  { value: 'neutral' as const, label: 'Neutral', Icon: Minus },
]

const TIMEFRAMES = [
  { value: 'short' as const, label: 'Short', hint: '< 1 mo' },
  { value: 'medium' as const, label: 'Mid', hint: '1–6 mo' },
  { value: 'long' as const, label: 'Long', hint: '6 mo+' },
]

const TEMPLATES = [
  { id: 'blank', label: 'Blank', Icon: FileText },
  { id: 'thesis', label: 'Thesis', Icon: Target },
  { id: 'earnings', label: 'Earnings', Icon: BarChart3 },
  { id: 'technical', label: 'Technical', Icon: TrendingUp },
  { id: 'fundamental', label: 'Fundamental', Icon: BookOpen },
  { id: 'news', label: 'News', Icon: Newspaper },
]

const QUICK_ACTIONS = [
  { label: 'Draft thesis', prompt: 'Draft a detailed investment thesis for this stock based on recent announcements and fundamentals' },
  { label: 'Analyze risks', prompt: 'List the key risks for this investment with brief explanations' },
  { label: 'Earnings recap', prompt: 'Extract and summarize the latest quarterly earnings data with key metrics' },
  { label: 'Auto-tag', prompt: 'auto-tag: Analyze this note and suggest tags, sentiment, confidence level (1-5), and timeframe' },
]

// ─── Component ────────────────────────────────────────────────────────────────
export function ResearchNoteOverlay({ isOpen, onClose, context, editNoteId, initialTitle, initialContent }: ResearchNoteOverlayProps) {
  const { notes, createNote, updateNote, deleteNote, toggleNotePin, refresh } = useNotes()

  // ── Note fields
  const [noteId, setNoteId]                         = useState<string | null>(editNoteId || null)
  const [title, setTitle]                           = useState(initialTitle || '')
  const [content, setContent]                       = useState(initialContent || '')
  const [sentiment, setSentiment]                   = useState<Note['sentiment']>(undefined)
  const [confidence, setConfidence]                 = useState<Note['confidence']>(undefined)
  const [timeframe, setTimeframe]                   = useState<Note['timeframe']>(undefined)
  const [priceTarget, setPriceTarget]               = useState('')
  const [stopLoss, setStopLoss]                     = useState('')
  const [tags, setTags]                             = useState<string[]>([])
  const [tagInput, setTagInput]                     = useState('')
  const [linkedAnns, setLinkedAnns]                 = useState<LinkedAnnouncement[]>([])
  const [thesisStatus, setThesisStatus]             = useState<Note['thesisStatus']>(undefined)

  // ── AI
  const [aiInput, setAiInput]                       = useState('')
  const [aiLoading, setAiLoading]                   = useState(false)
  const [aiResponse, setAiResponse]                 = useState('')
  const [aiVisible, setAiVisible]                   = useState(false)

  // ── UI
  const [saveStatus, setSaveStatus]                 = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showTemplates, setShowTemplates]           = useState(false)
  const [metaExpanded, setMetaExpanded]             = useState(true)
  const [deleteConfirm, setDeleteConfirm]           = useState(false)
  const [isFullScreen, setIsFullScreen]             = useState(false)

  const titleRef    = useRef<HTMLInputElement>(null)
  const editorRef   = useRef<HTMLTextAreaElement>(null)
  const aiRef       = useRef<HTMLInputElement>(null)
  const saveTimer   = useRef<NodeJS.Timeout | null>(null)
  const onCloseRef  = useRef(onClose)
  onCloseRef.current = onClose

  // ── Derived current note
  const currentNote = useMemo(
    () => (noteId ? notes.find(n => n.id === noteId && !n.deleted) || null : null),
    [noteId, notes]
  )

  // ── Load note when overlay opens
  useEffect(() => {
    if (!isOpen) return

    if (editNoteId) {
      const n = notes.find(n => n.id === editNoteId)
      if (n) {
        setNoteId(n.id)
        setTitle(n.title)
        setContent(n.content)
        setSentiment(n.sentiment)
        setConfidence(n.confidence)
        setTimeframe(n.timeframe)
        setPriceTarget(n.priceTarget?.toString() ?? '')
        setStopLoss(n.stopLoss?.toString() ?? '')
        setTags(n.tags)
        setLinkedAnns(n.linkedAnnouncements ?? [])
        setThesisStatus(n.thesisStatus)
        setShowTemplates(false)
        return
      }
    }

    // New note
    setNoteId(null)
    setTitle(initialTitle || '')
    setContent(initialContent || '')
    setSentiment(undefined)
    setConfidence(undefined)
    setTimeframe(undefined)
    setPriceTarget('')
    setStopLoss('')
    setTags([])
    setThesisStatus(undefined)
    setAiResponse('')
    setAiVisible(false)
    setDeleteConfirm(false)
    setIsFullScreen(false)
    setShowTemplates(true)

    if (context?.announcement) {
      setLinkedAnns([{
        id: context.announcement.id,
        headline: context.announcement.headline,
        date: context.announcement.date,
        category: context.announcement.category,
      }])
    } else {
      setLinkedAnns([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editNoteId, context?.announcement?.id, initialTitle, initialContent])


  // ── Auto-save
  const doSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return

    const payload = {
      title: title.trim() || 'Untitled',
      content,
      sentiment,
      confidence,
      timeframe,
      priceTarget: priceTarget ? parseFloat(priceTarget) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      tags,
      linkedAnnouncements: linkedAnns,
      thesisStatus,
      ...(context ? {
        scripCode: context.scripCode,
        symbol: context.symbol,
        companyName: context.companyName,
      } : {}),
    }

    if (noteId) {
      updateNote(noteId, payload)
    } else {
      const newNote = createNote('notes', payload.title, content)
      updateNote(newNote.id, {
        ...payload,
        priceAtCreation: context?.currentPrice,
      })
      setNoteId(newNote.id)
    }

    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [noteId, title, content, sentiment, confidence, timeframe, priceTarget, stopLoss, tags, linkedAnns, thesisStatus, context, createNote, updateNote])

  useEffect(() => {
    if (!isOpen || (!title.trim() && !content.trim())) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(doSave, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, sentiment, confidence, timeframe, priceTarget, stopLoss, tags, linkedAnns, thesisStatus])

  // ── Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); doSave(); onCloseRef.current() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, doSave])

  // ── Template selection
  const applyTemplate = (id: string) => {
    const tmpl = DEFAULT_TEMPLATES.find(t => t.id === id)
    if (tmpl && id !== 'blank') {
      setTitle(tmpl.name)
      setContent(tmpl.content)
      setTags(tmpl.tags)
    }
    setShowTemplates(false)
    setTimeout(() => (id === 'blank' ? titleRef : editorRef).current?.focus(), 50)
  }

  // ── Tags
  const addTag = (raw: string) => {
    const t = raw.toLowerCase().trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setTagInput('')
  }

  // ── AI
  const sendAI = async (prompt?: string) => {
    const msg = (prompt ?? aiInput).trim()
    if (!msg || aiLoading) return
    setAiInput('')
    setAiLoading(true)
    setAiVisible(true)
    setAiResponse('')

    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          scripCode: context?.scripCode,
          symbol: context?.symbol,
          companyName: context?.companyName,
          noteContent: content,
          noteTitle: title,
        }),
      })

      if (!res.ok) throw new Error('AI failed')

      const reader = res.body?.getReader()
      const dec = new TextDecoder()
      let full = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of dec.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const d = JSON.parse(line.slice(6))
              if (d.type === 'content') { full += d.content; setAiResponse(full) }
              if (d.type === 'auto-tag' && d.suggestions) {
                if (d.suggestions.sentiment) setSentiment(d.suggestions.sentiment)
                if (d.suggestions.confidence) setConfidence(d.suggestions.confidence)
                if (d.suggestions.timeframe) setTimeframe(d.suggestions.timeframe)
                if (d.suggestions.tags) setTags(p => [...new Set([...p, ...d.suggestions.tags])])
              }
            } catch {}
          }
        }
      }
    } catch {
      setAiResponse('Failed to get AI response.')
    } finally {
      setAiLoading(false)
    }
  }

  const insertAI = () => {
    if (!aiResponse) return
    setContent(p => p ? `${p}\n\n${aiResponse}` : aiResponse)
    setAiResponse('')
    setAiVisible(false)
  }

  // ── P&L
  const pnl = useMemo(() => {
    const entry = currentNote?.priceAtCreation ?? (noteId === null ? context?.currentPrice : undefined)
    const cur = context?.currentPrice
    if (!entry || !cur) return null
    const pct = ((cur - entry) / entry) * 100
    return { pct, entry }
  }, [currentNote?.priceAtCreation, context?.currentPrice, noteId])

  const rr = useMemo(() => {
    const entry = pnl?.entry ?? context?.currentPrice
    const tgt = priceTarget ? parseFloat(priceTarget) : undefined
    const sl = stopLoss ? parseFloat(stopLoss) : undefined
    if (!entry || !tgt || !sl || sl === entry) return null
    return (Math.abs(tgt - entry) / Math.abs(entry - sl)).toFixed(1)
  }, [pnl?.entry, context?.currentPrice, priceTarget, stopLoss])

  // ── Delete
  const handleDelete = () => {
    if (!noteId) return
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return }
    deleteNote(noteId)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
        onClick={() => { doSave(); onClose() }}
      />

      {/* Shell */}
      <div className="relative flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-200">

        {/* ══════════ HEADER ══════════ */}
        <header className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05] bg-zinc-950/60 backdrop-blur-xl z-10 flex-shrink-0">
          {/* Left: close + stock badge */}
          <button
            onClick={() => { doSave(); onClose() }}
            className="p-1 rounded-lg text-zinc-600 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>

          {context && (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-black tracking-[0.18em] text-white">{context.symbol}</span>
              {context.currentPrice && (
                <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                  ₹{context.currentPrice.toLocaleString('en-IN')}
                </span>
              )}
              {context.changePercent !== undefined && (
                <span className={`text-[10px] font-bold tabular-nums ${context.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {context.changePercent >= 0 ? '+' : ''}{context.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {/* Sentiment pill */}
          {sentiment && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${
              sentiment === 'bullish' ? 'bg-emerald-500/10 text-emerald-400' :
              sentiment === 'bearish' ? 'bg-rose-500/10 text-rose-400' :
              'bg-zinc-700/40 text-zinc-400'
            }`}>
              {sentiment}
            </span>
          )}

          {/* P&L */}
          {pnl && (
            <span className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${pnl.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}% since note
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save indicator */}
          <span className={`text-[9px] font-bold uppercase tracking-widest transition-all duration-300 flex-shrink-0 ${
            saveStatus === 'saving' ? 'text-zinc-600' :
            saveStatus === 'saved' ? 'text-emerald-500' :
            'text-transparent'
          }`}>
            {saveStatus === 'saving' ? '●' : saveStatus === 'saved' ? '✓ Saved' : '·'}
          </span>

          {/* Pin */}
          {noteId && (
            <button
              onClick={() => toggleNotePin(noteId)}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                currentNote?.pinned
                  ? 'text-amber-400'
                  : 'text-zinc-700 hover:text-zinc-400'
              }`}
            >
              {currentNote?.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullScreen(p => !p)}
            className="p-1.5 rounded-lg text-zinc-700 hover:text-white transition-colors flex-shrink-0"
            title={isFullScreen ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          >
            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Delete */}
          {noteId && (
            <button
              onClick={handleDelete}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                deleteConfirm ? 'text-rose-400 bg-rose-500/10' : 'text-zinc-700 hover:text-rose-400'
              }`}
              title={deleteConfirm ? 'Click again to confirm delete' : 'Delete note'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => { doSave(); onClose() }}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-all flex-shrink-0"
          >
            Done
          </button>
        </header>

        {/* ══════════ BODY ══════════ */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Editor Column ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Template picker */}
            {showTemplates && !noteId && (
              <div className="flex-shrink-0 px-8 pt-5 pb-3 border-b border-white/[0.04]">
                <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.25em] mb-2.5">Start with a template</p>
                <div className="flex gap-1.5 flex-wrap">
                  {TEMPLATES.map(t => {
                    const { Icon } = t
                    return (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10 text-[10px] font-semibold text-zinc-500 hover:text-white transition-all"
                      >
                        <Icon className="h-3 w-3" />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Title */}
            <div className="flex-shrink-0 px-8 pt-6">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title"
                autoFocus={!editNoteId}
                className="w-full bg-transparent text-[22px] font-black text-white placeholder:text-zinc-800 outline-none tracking-tight"
              />
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0">
              <textarea
                ref={editorRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Start writing your research..."
                className="w-full bg-transparent text-[13px] text-zinc-300 placeholder:text-zinc-800 outline-none resize-none leading-[1.75] font-mono min-h-[300px]"
              />

              {/* AI response panel */}
              {aiVisible && (
                <div className="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                        <Sparkles className="h-2 w-2 text-white" />
                      </div>
                      <span className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.2em]">Speedy AI</span>
                      {aiLoading && <Loader2 className="h-3 w-3 text-zinc-600 animate-spin" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {aiResponse && !aiLoading && (
                        <button
                          onClick={insertAI}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/15 text-[9px] font-bold text-cyan-400 hover:bg-cyan-500/25 transition-colors"
                        >
                          <Plus className="h-2.5 w-2.5" /> Insert
                        </button>
                      )}
                      <button
                        onClick={() => { setAiVisible(false); setAiResponse('') }}
                        className="p-1 text-zinc-700 hover:text-white transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-3 max-h-[280px] overflow-y-auto">
                    <pre className="text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">
                      {aiResponse || (aiLoading ? <span className="text-zinc-700">Generating...</span> : null)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* ── AI Bar ── */}
            <div className="flex-shrink-0 border-t border-white/[0.04] bg-zinc-950/40 px-4 py-3">
              {/* Quick action chips */}
              <div className="flex gap-1.5 mb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.label}
                    onClick={() => sendAI(a.prompt)}
                    disabled={aiLoading}
                    className="flex-shrink-0 px-2.5 py-1 rounded-md bg-white/[0.025] border border-white/[0.05] text-[9px] font-bold text-zinc-600 hover:text-cyan-400 hover:border-cyan-500/20 hover:bg-cyan-500/[0.03] transition-all disabled:opacity-30"
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.05] focus-within:border-cyan-500/20 transition-colors">
                  <Sparkles className="h-3 w-3 text-zinc-700 flex-shrink-0" />
                  <input
                    ref={aiRef}
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI() } }}
                    placeholder="Ask Speedy about this stock..."
                    disabled={aiLoading}
                    className="flex-1 bg-transparent text-[11px] text-zinc-400 placeholder:text-zinc-700 outline-none"
                  />
                </div>
                <button
                  onClick={() => sendAI()}
                  disabled={!aiInput.trim() || aiLoading}
                  className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/80 to-purple-500/80 text-white transition-all disabled:opacity-20 hover:from-cyan-400 hover:to-purple-400"
                >
                  {aiLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* ── Meta Sidebar ── */}
          {!isFullScreen && (
            <aside className="hidden lg:flex flex-col w-[220px] min-w-[220px] border-l border-white/[0.05] overflow-y-auto bg-zinc-950/30">

              {/* Collapse toggle */}
              <button
                onClick={() => setMetaExpanded(p => !p)}
                className="flex items-center justify-between px-4 py-3 text-[8px] font-black text-zinc-700 uppercase tracking-[0.2em] hover:text-zinc-400 transition-colors border-b border-white/[0.03]"
              >
                Research Meta
                {metaExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {metaExpanded && (
                <div className="p-4 space-y-5">

                  {/* ── Sentiment ── */}
                  <div>
                    <label className="meta-label">Sentiment</label>
                    <div className="flex gap-1 mt-1.5">
                      {SENTIMENTS.map(s => {
                        const active = sentiment === s.value
                        return (
                          <button
                            key={s.value}
                            onClick={() => setSentiment(sentiment === s.value ? undefined : s.value)}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                              active
                                ? s.value === 'bullish' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                : s.value === 'bearish' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                                : 'bg-zinc-700/25 text-zinc-400 border border-zinc-600/25'
                                : 'text-zinc-700 border border-transparent hover:text-zinc-500 hover:bg-white/[0.03]'
                            }`}
                          >
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Prices ── */}
                  <div>
                    <label className="meta-label">Price Levels</label>
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-zinc-700 w-7">Entry</span>
                        <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                          ₹{(currentNote?.priceAtCreation ?? context?.currentPrice ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-emerald-600 w-7">Tgt</span>
                        <input
                          type="number"
                          value={priceTarget}
                          onChange={e => setPriceTarget(e.target.value)}
                          placeholder="—"
                          className="flex-1 bg-white/[0.025] border border-white/[0.05] rounded-md px-2 py-1 text-[10px] text-zinc-400 placeholder:text-zinc-800 outline-none focus:border-emerald-500/25 tabular-nums"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-rose-600 w-7">SL</span>
                        <input
                          type="number"
                          value={stopLoss}
                          onChange={e => setStopLoss(e.target.value)}
                          placeholder="—"
                          className="flex-1 bg-white/[0.025] border border-white/[0.05] rounded-md px-2 py-1 text-[10px] text-zinc-400 placeholder:text-zinc-800 outline-none focus:border-rose-500/25 tabular-nums"
                        />
                      </div>
                      {rr && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[8px] font-bold text-zinc-700 w-7">R:R</span>
                          <span className="text-[11px] font-bold text-cyan-400 tabular-nums">1 : {rr}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Confidence ── */}
                  <div>
                    <label className="meta-label">Conviction</label>
                    <div className="flex gap-0.5 mt-1.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfidence(confidence === n ? undefined : n as Note['confidence'])}
                          className="flex-1 flex items-center justify-center py-1.5"
                        >
                          <Star className={`h-3 w-3 transition-colors ${
                            confidence && confidence >= n
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-800'
                          }`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Timeframe ── */}
                  <div>
                    <label className="meta-label">Timeframe</label>
                    <div className="flex gap-1 mt-1.5">
                      {TIMEFRAMES.map(tf => {
                        const active = timeframe === tf.value
                        return (
                          <button
                            key={tf.value}
                            onClick={() => setTimeframe(timeframe === tf.value ? undefined : tf.value)}
                            title={tf.hint}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                              active
                                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                                : 'text-zinc-700 border border-transparent hover:text-zinc-500 hover:bg-white/[0.03]'
                            }`}
                          >
                            {tf.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Tags ── */}
                  <div>
                    <label className="meta-label">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1.5 mb-1.5">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] text-zinc-500"
                        >
                          #{tag}
                          <button
                            onClick={() => setTags(p => p.filter(t => t !== tag))}
                            className="text-zinc-700 hover:text-white transition-colors"
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTag(tagInput) } }}
                      placeholder="Add tag…"
                      className="w-full bg-white/[0.025] border border-white/[0.05] rounded-md px-2 py-1 text-[9px] text-zinc-500 placeholder:text-zinc-800 outline-none focus:border-white/[0.08]"
                    />
                  </div>

                  {/* ── Thesis Status ── */}
                  <div>
                    <label className="meta-label">Thesis Status</label>
                    <div className="grid grid-cols-2 gap-1 mt-1.5">
                      {(['active', 'closed-win', 'closed-loss', 'invalidated'] as const).map(s => {
                        const active = thesisStatus === s
                        const colors: Record<string, string> = {
                          active: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                          'closed-win': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                          'closed-loss': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                          invalidated: 'text-zinc-500 bg-zinc-700/20 border-zinc-600/20',
                        }
                        return (
                          <button
                            key={s}
                            onClick={() => setThesisStatus(thesisStatus === s ? undefined : s)}
                            className={`px-2 py-1.5 rounded-md text-[8px] font-bold uppercase tracking-wide border transition-all ${
                              active ? colors[s] : 'text-zinc-700 border-transparent hover:bg-white/[0.03] hover:text-zinc-600'
                            }`}
                          >
                            {s.replace('-', ' ')}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Linked Announcements ── */}
                  {linkedAnns.length > 0 && (
                    <div>
                      <label className="meta-label">Linked</label>
                      <div className="mt-1.5 space-y-1">
                        {linkedAnns.map(ann => (
                          <div
                            key={ann.id}
                            className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-white/[0.025] border border-white/[0.04]"
                          >
                            <FileText className="h-2.5 w-2.5 text-zinc-700 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[9px] text-zinc-500 leading-snug line-clamp-2">{ann.headline}</p>
                              <p className="text-[8px] text-zinc-700 mt-0.5">{ann.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Meta label utility - injected via style tag since no CSS file edit */}
      <style>{`
        .meta-label {
          display: block;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgb(63 63 70);
        }
      `}</style>
    </div>
  )
}
