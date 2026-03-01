'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { Note, SortOption, SYSTEM_FOLDERS, DEFAULT_TEMPLATES } from '@/lib/notes-types'
import { useLivePrices, computePnL } from '@/hooks/useLivePrices'
import {
  Search,
  Plus,
  SortAsc,
  SortDesc,
  LayoutList,
  LayoutGrid,
  Pin,
  Lock,
  Trash2,
  Copy,
  RotateCcw,
  X,
  Clock,
  FileText,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Star,
  FileQuestion,
  Activity,
} from 'lucide-react'

interface NotesListProps {
  notes: Note[]
  selectedNoteId: string | null
  searchQuery: string
  sortBy: SortOption
  sortDirection: 'asc' | 'desc'
  viewMode: 'list' | 'grid'
  selectedFolderId: string
  onSelectNote: (noteId: string) => void
  onCreateNote: () => void
  onCreateFromTemplate?: (templateId: string) => void
  onDeleteNote: (id: string, permanent?: boolean) => void
  onTogglePin: (id: string) => void
  onDuplicateNote: (id: string) => void
  onRestoreNote: (id: string) => void
  onSetSearchQuery: (query: string) => void
  onSetSortBy: (sortBy: SortOption) => void
  onSetSortDirection: (direction: 'asc' | 'desc') => void
  onSetViewMode: (mode: 'list' | 'grid') => void
  onEmptyTrash: () => number
}

function formatDate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  })
}

function extractPreview(note: Note): string {
  if (note.plainText) {
    const lines = note.plainText.split('\n').filter(l => l.trim())
    const preview = lines.length > 1 ? lines.slice(1).join(' ') : lines[0] || ''
    return preview.substring(0, 120)
  }
  return 'No additional text'
}

const SentimentIcon = ({ sentiment }: { sentiment?: string }) => {
  switch (sentiment) {
    case 'bullish':
      return <TrendingUp className="w-3.5 h-3.5 text-[#30D158]" />
    case 'bearish':
      return <TrendingDown className="w-3.5 h-3.5 text-[#FF453A]" />
    case 'neutral':
      return <Minus className="w-3.5 h-3.5 text-[#8E8E93]" />
    default:
      return null
  }
}

const ConfidenceStars = ({ level }: { level?: number }) => {
  if (!level) return null
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-2.5 h-2.5 ${i < level ? 'text-[#FFD60A] fill-[#FFD60A]' : 'text-[var(--notes-text-quaternary)]'}`}
        />
      ))}
    </div>
  )
}

export default function NotesList({
  notes,
  selectedNoteId,
  searchQuery,
  sortBy,
  sortDirection,
  viewMode,
  selectedFolderId,
  onSelectNote,
  onCreateNote,
  onCreateFromTemplate,
  onDeleteNote,
  onTogglePin,
  onDuplicateNote,
  onRestoreNote,
  onSetSearchQuery,
  onSetSortBy,
  onSetSortDirection,
  onSetViewMode,
  onEmptyTrash,
}: NotesListProps) {
  const [contextMenu, setContextMenu] = useState<{ noteId: string; x: number; y: number } | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const isTrash = selectedFolderId === SYSTEM_FOLDERS.RECENTLY_DELETED

  // Live P&L tracking - fetch current prices for all stocks in notes
  const scripCodes = useMemo(() => 
    [...new Set(notes.filter(n => n.scripCode).map(n => n.scripCode!))],
    [notes]
  )
  const livePrices = useLivePrices(scripCodes)

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault()
    setContextMenu({ noteId, x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'modified', label: 'Date Modified' },
    { value: 'created', label: 'Date Created' },
    { value: 'title', label: 'Title' },
    { value: 'sentiment', label: 'Sentiment' },
    { value: 'confidence', label: 'Confidence' },
    { value: 'symbol', label: 'Stock Symbol' },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--notes-border-tertiary)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--notes-text-primary)]">
            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="notes-toolbar-btn"
              title="Sort"
            >
              {sortDirection === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-[998]" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-[999] bg-[var(--notes-bg-elevated)] border border-[var(--notes-border-primary)] rounded-lg shadow-lg min-w-[180px] p-1 notes-animate-scale-in">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        sortBy === opt.value
                          ? 'bg-[var(--notes-bg-selected)] text-[var(--notes-accent-blue)]'
                          : 'text-[var(--notes-text-primary)] hover:bg-[var(--notes-bg-hover)]'
                      }`}
                      onClick={() => {
                        if (sortBy === opt.value) {
                          onSetSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        } else {
                          onSetSortBy(opt.value)
                        }
                        setShowSortMenu(false)
                      }}
                    >
                      <span className="flex items-center justify-between">
                        {opt.label}
                        {sortBy === opt.value && (
                          <ChevronDown className={`w-3 h-3 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View Toggle */}
          <button
            onClick={() => onSetViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="notes-toolbar-btn"
            title={viewMode === 'list' ? 'Grid view' : 'List view'}
          >
            {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
          </button>

          {/* New Note with Template Menu */}
          {!isTrash && (
            <div className="relative">
              <button
                onClick={() => {
                  if (onCreateFromTemplate) {
                    setShowNewMenu(!showNewMenu)
                  } else {
                    onCreateNote()
                  }
                }}
                className="notes-toolbar-btn text-[var(--notes-accent-blue)]"
                title="New Research Note"
              >
                <Plus className="w-5 h-5" />
              </button>
              {showNewMenu && onCreateFromTemplate && (
                <>
                  <div className="fixed inset-0 z-[998]" onClick={() => setShowNewMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-[999] bg-[var(--notes-bg-elevated)] border border-[var(--notes-border-primary)] rounded-lg shadow-lg min-w-[220px] p-1 notes-animate-scale-in">
                    <button
                      className="w-full text-left px-3 py-2 text-sm rounded-md text-[var(--notes-text-primary)] hover:bg-[var(--notes-bg-hover)] flex items-center gap-2"
                      onClick={() => {
                        onCreateNote()
                        setShowNewMenu(false)
                      }}
                    >
                      <FileText className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
                      Blank Note
                    </button>
                    <div className="h-px bg-[var(--notes-border-tertiary)] my-1" />
                    {DEFAULT_TEMPLATES.filter(t => t.id !== 'blank').map(template => (
                      <button
                        key={template.id}
                        className="w-full text-left px-3 py-2 text-sm rounded-md text-[var(--notes-text-primary)] hover:bg-[var(--notes-bg-hover)] flex items-center gap-2"
                        onClick={() => {
                          onCreateFromTemplate(template.id)
                          setShowNewMenu(false)
                        }}
                      >
                        <FileQuestion className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
                        {template.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="notes-search">
        <Search className="notes-search-icon" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSetSearchQuery(e.target.value)}
          placeholder="Search research notes..."
          className="notes-search-input"
        />
        {searchQuery && (
          <button
            onClick={() => onSetSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--notes-text-tertiary)] hover:text-[var(--notes-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Trash Actions */}
      {isTrash && notes.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              if (confirm('Permanently delete all notes in trash?')) {
                onEmptyTrash()
              }
            }}
            className="w-full py-2 text-sm text-[var(--notes-accent-red)] hover:bg-[rgba(255,69,58,0.1)] rounded-lg transition-colors"
          >
            Empty Trash ({notes.length})
          </button>
        </div>
      )}

      {/* Notes List */}
      <div className={`flex-1 overflow-y-auto notes-scrollbar p-2 ${
        viewMode === 'grid' ? 'grid grid-cols-2 gap-2 auto-rows-min' : 'flex flex-col gap-0.5'
      }`}>
        {notes.length === 0 ? (
          <div className="notes-empty-state">
            <FileText className="notes-empty-icon" />
            <p className="notes-empty-title">
              {searchQuery ? 'No results' : isTrash ? 'Trash is empty' : 'No research notes'}
            </p>
            <p className="notes-empty-description">
              {searchQuery
                ? `No notes match "${searchQuery}"`
                : isTrash
                ? 'Deleted notes will appear here'
                : 'Create your first research note'}
            </p>
            {!searchQuery && !isTrash && (
              <button onClick={onCreateNote} className="mt-4 notes-btn notes-btn-primary">
                <Plus className="w-4 h-4" />
                New Research Note
              </button>
            )}
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className={`notes-card notes-animate-fade-in ${note.id === selectedNoteId ? 'active' : ''}`}
              onClick={() => onSelectNote(note.id)}
              onContextMenu={(e) => handleContextMenu(e, note.id)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {/* Stock Badge + Sentiment */}
                  {(note.symbol || note.sentiment) && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {note.symbol && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--notes-accent-blue)]/15 text-[var(--notes-accent-blue)]">
                          {note.symbol}
                        </span>
                      )}
                      <SentimentIcon sentiment={note.sentiment} />
                      {note.thesisStatus === 'active' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#BF5AF2]/15 text-[#BF5AF2]">
                          Active Thesis
                        </span>
                      )}
                      {note.thesisStatus === 'closed-win' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#30D158]/15 text-[#30D158]">
                          Win
                        </span>
                      )}
                      {note.thesisStatus === 'closed-loss' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FF453A]/15 text-[#FF453A]">
                          Loss
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <div className="notes-card-title flex items-center gap-1.5">
                    {note.pinned && <Pin className="w-3 h-3 text-[var(--notes-accent-yellow)] flex-shrink-0" />}
                    {note.locked && <Lock className="w-3 h-3 text-[var(--notes-text-tertiary)] flex-shrink-0" />}
                    <span className="truncate">{note.title || 'New Note'}</span>
                  </div>

                  {/* Preview */}
                  <p className="notes-card-preview">
                    {note.locked ? 'This note is locked' : extractPreview(note)}
                  </p>

                    {/* Meta Row: date, targets, confidence */}
                    <div className="notes-card-meta flex-wrap">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(note.modified)}</span>

                      {/* Live P&L */}
                      {note.scripCode && note.priceAtCreation && livePrices[note.scripCode] && (() => {
                        const pnl = computePnL(note.priceAtCreation, livePrices[note.scripCode].price)
                        if (!pnl) return null
                        return (
                          <>
                            <span className="text-[var(--notes-border-primary)]">·</span>
                            <Activity className="w-3 h-3" />
                            <span className={pnl.isPositive ? 'text-[#30D158] font-medium' : 'text-[#FF453A] font-medium'}>
                              {pnl.isPositive ? '+' : ''}{pnl.pnlPercent.toFixed(1)}%
                            </span>
                            <span className="text-[var(--notes-text-quaternary)]">
                              ₹{livePrices[note.scripCode].price.toLocaleString('en-IN')}
                            </span>
                          </>
                        )
                      })()}

                      {note.priceTarget && (
                      <>
                        <span className="text-[var(--notes-border-primary)]">·</span>
                        <Target className="w-3 h-3 text-[#30D158]" />
                        <span className="text-[#30D158]">T: {note.priceTarget.toLocaleString('en-IN')}</span>
                      </>
                    )}

                    {note.priceAtCreation && (
                      <>
                        <span className="text-[var(--notes-border-primary)]">·</span>
                        <span>Entry: {note.priceAtCreation.toLocaleString('en-IN')}</span>
                      </>
                    )}

                    {note.confidence && (
                      <>
                        <span className="text-[var(--notes-border-primary)]">·</span>
                        <ConfidenceStars level={note.confidence} />
                      </>
                    )}

                    {note.template && (
                      <>
                        <span className="text-[var(--notes-border-primary)]">·</span>
                        <span className="text-[var(--notes-accent-blue)] capitalize">{note.template}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={closeContextMenu} />
          <div
            className="notes-context-menu open"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {isTrash ? (
              <>
                <button
                  className="notes-context-item"
                  onClick={() => { onRestoreNote(contextMenu.noteId); closeContextMenu() }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
                <div className="notes-context-divider" />
                <button
                  className="notes-context-item danger"
                  onClick={() => { onDeleteNote(contextMenu.noteId, true); closeContextMenu() }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Permanently
                </button>
              </>
            ) : (
              <>
                <button
                  className="notes-context-item"
                  onClick={() => { onTogglePin(contextMenu.noteId); closeContextMenu() }}
                >
                  <Pin className="w-4 h-4" />
                  {notes.find(n => n.id === contextMenu.noteId)?.pinned ? 'Unpin' : 'Pin to Top'}
                </button>
                <button
                  className="notes-context-item"
                  onClick={() => { onDuplicateNote(contextMenu.noteId); closeContextMenu() }}
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <div className="notes-context-divider" />
                <button
                  className="notes-context-item danger"
                  onClick={() => { onDeleteNote(contextMenu.noteId); closeContextMenu() }}
                >
                  <Trash2 className="w-4 h-4" />
                  Move to Trash
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
