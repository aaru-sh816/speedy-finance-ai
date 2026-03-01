'use client'

import { useState, useMemo } from 'react'
import {
  FileText, Plus, Pin, PinOff, Trash2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Target, Star, Clock, Tag,
  Calendar, Sparkles, ExternalLink
} from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { ResearchNoteOverlay, type ResearchNoteContext } from './research-note-overlay'
import type { Note } from '@/lib/notes-types'

interface StockNotesPanelProps {
  scripCode: string
  symbol: string
  companyName: string
  currentPrice?: number
  changePercent?: number
  announcements?: Array<{ id: string; headline: string; date: string; category?: string }>
}

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Bull' },
  bearish: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/15', label: 'Bear' },
  neutral: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-500/15', label: 'Neutral' },
} as const

export function StockNotesPanel({ scripCode, symbol, companyName, currentPrice, changePercent, announcements = [] }: StockNotesPanelProps) {
  const { notes, toggleNotePin, deleteNote } = useNotes()
  const [isExpanded, setIsExpanded] = useState(true)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [editNoteId, setEditNoteId] = useState<string | undefined>(undefined)

  // Filter notes for this stock
  const stockNotes = useMemo(() => {
    return notes
      .filter(n => !n.deleted && n.scripCode === scripCode)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.modified - a.modified
      })
  }, [notes, scripCode])

  const sentimentCounts = useMemo(() => {
    const counts = { bullish: 0, bearish: 0, neutral: 0 }
    stockNotes.forEach(n => { if (n.sentiment) counts[n.sentiment]++ })
    return counts
  }, [stockNotes])

  const context: ResearchNoteContext = {
    scripCode,
    symbol,
    companyName,
    currentPrice,
    changePercent,
  }

  const openNewNote = () => {
    setEditNoteId(undefined)
    setOverlayOpen(true)
  }

  const openExistingNote = (noteId: string) => {
    setEditNoteId(noteId)
    setOverlayOpen(true)
  }

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff}d ago`
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <>
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
              <h3 className="text-lg font-semibold text-white">Research Notes</h3>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span>{stockNotes.length} note{stockNotes.length !== 1 ? 's' : ''}</span>
                {stockNotes.length > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <div className="flex items-center gap-2">
                      {sentimentCounts.bullish > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400 text-xs">
                          <TrendingUp className="h-3 w-3" /> {sentimentCounts.bullish}
                        </span>
                      )}
                      {sentimentCounts.bearish > 0 && (
                        <span className="flex items-center gap-0.5 text-rose-400 text-xs">
                          <TrendingDown className="h-3 w-3" /> {sentimentCounts.bearish}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp className="h-5 w-5 text-zinc-500" /> : <ChevronDown className="h-5 w-5 text-zinc-500" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-zinc-800">
            {/* New Note Button */}
            <div className="p-3">
              <button
                onClick={openNewNote}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
              >
                <Sparkles className="h-4 w-4" />
                New Research Note
              </button>
            </div>

            {/* Notes List */}
            <div className="max-h-[400px] overflow-y-auto">
              {stockNotes.length === 0 ? (
                <div className="p-6 text-center text-zinc-600">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No notes yet for {symbol}</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {stockNotes.map(note => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      currentPrice={currentPrice}
                      onOpen={() => openExistingNote(note.id)}
                      onTogglePin={() => toggleNotePin(note.id)}
                      onDelete={() => deleteNote(note.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {stockNotes.length > 0 && (
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <a
                  href="/research"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  All research notes <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-[10px] text-zinc-700">
                  {formatDate(stockNotes[0].modified)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Research Note Overlay */}
      <ResearchNoteOverlay
        isOpen={overlayOpen}
        onClose={() => { setOverlayOpen(false); setEditNoteId(undefined) }}
        context={context}
        editNoteId={editNoteId}
      />
    </>
  )
}

// ─── Note Row Component ──────────────────────────────────────────────
function NoteRow({
  note,
  currentPrice,
  onOpen,
  onTogglePin,
  onDelete,
  formatDate,
}: {
  note: Note
  currentPrice?: number
  onOpen: () => void
  onTogglePin: () => void
  onDelete: () => void
  formatDate: (ts: number) => string
}) {
  const sentimentConfig = note.sentiment ? SENTIMENT_CONFIG[note.sentiment] : null
  const SentimentIcon = sentimentConfig?.icon

  const pnl = useMemo(() => {
    if (!note.priceAtCreation || !currentPrice) return null
    return ((currentPrice - note.priceAtCreation) / note.priceAtCreation) * 100
  }, [note.priceAtCreation, currentPrice])

  return (
    <div
      className="px-3 py-3 hover:bg-zinc-800/30 transition-colors group cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {note.pinned && <Pin className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
            <h4 className="text-sm font-semibold text-white truncate">{note.title}</h4>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {sentimentConfig && SentimentIcon && (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${sentimentConfig.bg} ${sentimentConfig.color}`}>
                <SentimentIcon className="h-2.5 w-2.5" />
                {sentimentConfig.label}
              </span>
            )}
            {note.confidence && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                {[...Array(note.confidence)].map((_, i) => (
                  <Star key={i} className="h-2 w-2 fill-amber-400" />
                ))}
              </span>
            )}
            {note.priceTarget && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                <Target className="h-2.5 w-2.5" /> ₹{note.priceTarget.toLocaleString('en-IN')}
              </span>
            )}
            {pnl !== null && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums ${
                pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
              </span>
            )}
          </div>

          {note.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {note.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[9px] text-zinc-600">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onTogglePin} className={`p-1 rounded hover:bg-zinc-700 ${note.pinned ? 'text-amber-400' : 'text-zinc-600 hover:text-white'}`}>
            {note.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-rose-400">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-700">
        <span>{formatDate(note.modified)}</span>
        {note.priceAtCreation && (
          <span>₹{note.priceAtCreation.toLocaleString('en-IN')}</span>
        )}
      </div>
    </div>
  )
}
