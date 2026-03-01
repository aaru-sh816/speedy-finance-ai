'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
import { createNote, updateNote } from '@/lib/notes-storage'
import type { Note } from '@/lib/notes-types'

interface QuickNoteModalProps {
  isOpen: boolean
  onClose: () => void
  scripCode: string
  symbol: string
  companyName: string
  currentPrice?: number
}

const QUICK_TAGS = ['earnings', 'technical', 'fundamental', 'news', 'breakout', 'target']

export function QuickNoteModal({
  isOpen, onClose, scripCode, symbol, companyName, currentPrice
}: QuickNoteModalProps) {
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [tags, setTags]           = useState<string[]>([])
  const [sentiment, setSentiment] = useState<Note['sentiment']>(undefined)
  const [tagInput, setTagInput]   = useState('')

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setContent(''); setTags([]); setSentiment(undefined); setTagInput('')
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return
    const note = createNote('notes', title || 'Quick Note', content)
    updateNote(note.id, { scripCode, symbol, companyName, tags, sentiment, priceAtCreation: currentPrice })
    onClose()
  }, [scripCode, symbol, companyName, title, content, tags, sentiment, currentPrice, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, handleSave, onClose])

  const addTag = (raw: string) => {
    const t = raw.toLowerCase().trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setTagInput('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-950 rounded-2xl border border-white/[0.07] shadow-2xl animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
            <span className="text-[11px] font-black text-white tracking-wide">Quick Note</span>
            <span className="text-[10px] text-zinc-600">— {symbol}</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-700 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Title */}
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-[15px] font-bold text-white placeholder:text-zinc-700 outline-none"
          />

          {/* Content */}
          <textarea
            placeholder="Write your note... (Ctrl+Enter to save)"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none resize-none focus:border-white/10 transition-colors font-mono"
          />

          {/* Sentiment */}
          <div className="flex items-center gap-1.5">
            {([
              { v: 'bullish', label: 'Bull', Icon: TrendingUp, on: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', off: 'text-zinc-600 border-white/[0.05]' },
              { v: 'bearish', label: 'Bear', Icon: TrendingDown, on: 'bg-rose-500/10 text-rose-400 border-rose-500/20', off: 'text-zinc-600 border-white/[0.05]' },
              { v: 'neutral', label: 'Neutral', Icon: Minus, on: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30', off: 'text-zinc-600 border-white/[0.05]' },
            ] as const).map(s => (
              <button
                key={s.v}
                onClick={() => setSentiment(sentiment === s.v ? undefined : s.v)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                  sentiment === s.v ? s.on : s.off
                } hover:opacity-80`}
              >
                <s.Icon className="h-2.5 w-2.5" /> {s.label}
              </button>
            ))}
            {currentPrice && (
              <span className="ml-auto text-[9px] text-zinc-700 tabular-nums">₹{currentPrice.toLocaleString('en-IN')}</span>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] text-zinc-500">
                  #{tag}
                  <button onClick={() => setTags(p => p.filter(t => t !== tag))} className="text-zinc-700 hover:text-white"><X className="h-2 w-2" /></button>
                </span>
              ))}
              {QUICK_TAGS.filter(t => !tags.includes(t)).map(tag => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-1.5 py-0.5 rounded bg-white/[0.025] border border-white/[0.04] text-[9px] text-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Custom tag…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTag(tagInput) } }}
              className="w-full bg-transparent text-[10px] text-zinc-500 placeholder:text-zinc-700 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.05]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-600 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() && !content.trim()}
            className="px-4 py-1.5 rounded-lg bg-cyan-500/80 hover:bg-cyan-400/80 text-white text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  )
}
