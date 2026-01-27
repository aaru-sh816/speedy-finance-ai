'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  X, 
  Save, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Tag,
  FileText
} from 'lucide-react'
import { addNote, type StockNote } from '@/lib/storage'

interface QuickNoteModalProps {
  isOpen: boolean
  onClose: () => void
  scripCode: string
  symbol: string
  companyName: string
  currentPrice?: number
}

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'Bearish' },
  neutral: { icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: 'Neutral' },
}

const QUICK_TAGS = ['earnings', 'technical', 'fundamental', 'news', 'breakout', 'target']

export function QuickNoteModal({ isOpen, onClose, scripCode, symbol, companyName, currentPrice }: QuickNoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [sentiment, setSentiment] = useState<StockNote['sentiment']>(undefined)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setContent('')
      setTags([])
      setSentiment(undefined)
      setTagInput('')
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
      if (e.key === 'Enter' && e.ctrlKey && isOpen) {
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, title, content, tags, sentiment])

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return

    addNote({
      scripCode,
      symbol,
      companyName,
      title: title || 'Quick Note',
      content,
      tags,
      sentiment,
      priceAtNote: currentPrice,
      isPinned: false,
    })

    onClose()
  }, [scripCode, symbol, companyName, title, content, tags, sentiment, currentPrice, onClose])

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim().replace(/^#/, '')
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags(prev => [...prev, normalizedTag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20">
              <FileText className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Quick Note</h2>
              <p className="text-sm text-zinc-500">{symbol} - {companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <input
            type="text"
            placeholder="Note title (optional)..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-transparent text-white text-lg font-medium placeholder:text-zinc-600 outline-none"
            autoFocus
          />

          <textarea
            placeholder="Write your quick note... (Ctrl+Enter to save)"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full bg-zinc-800/50 rounded-xl p-3 text-zinc-300 placeholder:text-zinc-600 outline-none resize-none min-h-[120px] border border-zinc-700 focus:border-cyan-500/50 transition-colors"
          />

          <div className="flex flex-wrap gap-2 items-center">
            <Tag className="h-4 w-4 text-zinc-500" />
            {tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium flex items-center gap-1"
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
              className="bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none w-20"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {QUICK_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <button
                key={tag}
                onClick={() => handleAddTag(tag)}
                className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Sentiment:</span>
            {(['bullish', 'bearish', 'neutral'] as const).map(s => {
              const config = SENTIMENT_CONFIG[s]
              const Icon = config.icon
              const isSelected = sentiment === s
              return (
                <button
                  key={s}
                  onClick={() => setSentiment(sentiment === s ? undefined : s)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected 
                      ? `${config.bg} ${config.color}` 
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </button>
              )
            })}
          </div>

          {currentPrice && (
            <div className="text-xs text-zinc-500">
              Current price: ₹{currentPrice.toLocaleString('en-IN')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() && !content.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save Note
          </button>
        </div>
      </div>
    </div>
  )
}
