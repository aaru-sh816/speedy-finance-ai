'use client'

import { useState, useEffect, useRef } from 'react'
import { useNotes } from '@/hooks/useNotes'
import { Search, Plus, X, Command, Tag, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ResearchPage() {
  const { notes, createNote, updateNote, deleteNote, searchQuery, setSearchQuery } = useNotes()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  // Filter and sort notes (latest first)
  const filteredNotes = notes
    .filter(n => !n.deleted)
    .filter(n => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        n.title?.toLowerCase().includes(q) ||
        n.plainText?.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q)) ||
        n.symbol?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.modified - a.modified)

  const selectedNote = notes.find(n => n.id === selectedNoteId)

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedNoteId) {
        setSelectedNoteId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNoteId])

  // Content Editable sync
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Optional: Auto-resize textarea in the modal
    if (contentRef.current) {
      contentRef.current.style.height = 'auto'
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px'
    }
  }, [selectedNote?.content])

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Research</h1>
            <p className="text-zinc-500 font-medium">Your global, auto-tagged intelligence vault.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search research..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-full py-3 pl-12 pr-4 text-sm font-medium outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-zinc-600"
              />
            </div>

            <button
              onClick={() => {
                const note = createNote(undefined, '', '')
                setSelectedNoteId(note.id)
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-zinc-200 transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
          </div>
        </div>

        {/* Global Cmd+K Hint */}
        {filteredNotes.length === 0 && !searchQuery && (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
            <Command className="w-16 h-16 mb-6" />
            <h3 className="text-xl font-bold mb-2">Empty Vault</h3>
            <p className="text-sm font-medium max-w-sm">
              Press <kbd className="px-2 py-1 rounded bg-white/10 font-mono text-xs mx-1">Cmd + K</kbd> anywhere in the app to instantly drop a thought into this vault.
            </p>
          </div>
        )}

        {/* Masonry Grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className="break-inside-avoid relative group cursor-pointer"
            >
              {/* Glass Card */}
              <div className="bg-[#0f0f12]/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 transition-all duration-500 hover:bg-[#15151a]/90 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_20px_40px_rgba(34,211,238,0.05)]">

                {/* Ticker / Tags */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {note.symbol && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
                      <Activity className="w-3 h-3" />
                      {note.symbol}
                    </span>
                  )}
                  {note.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/50 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold mb-2 leading-tight group-hover:text-cyan-400 transition-colors">
                  {note.title || 'Untitled'}
                </h3>

                {/* Content Preview */}
                <p className="text-sm text-zinc-500 line-clamp-6 leading-relaxed mb-6">
                  {note.plainText || note.content?.replace(/<[^>]*>?/gm, '') || 'Empty note...'}
                </p>

                {/* Footer Metadata */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mt-auto">
                  <span>{formatDistanceToNow(note.modified, { addSuffix: true })}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Modal Overlay */}
      {selectedNote && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setSelectedNoteId(null)}
          />

          <div className="relative w-full max-w-4xl max-h-full bg-[#0a0a0a] rounded-[2rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                {selectedNote.symbol && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm font-bold border border-cyan-500/20">
                    <Activity className="w-4 h-4" />
                    {selectedNote.symbol}
                  </span>
                )}
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {formatDistanceToNow(selectedNote.modified, { addSuffix: true })}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    deleteNote(selectedNote.id)
                    setSelectedNoteId(null)
                  }}
                  className="text-xs font-bold text-zinc-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedNoteId(null)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Frameless Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 notes-scrollbar relative">
              <input
                type="text"
                value={selectedNote.title || ''}
                onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                placeholder="Title"
                className="w-full bg-transparent text-4xl md:text-5xl font-black tracking-tighter outline-none mb-8 placeholder:text-zinc-800"
              />

              <textarea
                ref={contentRef}
                value={selectedNote.content || ''}
                onChange={(e) => {
                  updateNote(selectedNote.id, {
                    content: e.target.value
                  })
                  if (contentRef.current) {
                    contentRef.current.style.height = 'auto'
                    contentRef.current.style.height = contentRef.current.scrollHeight + 'px'
                  }
                }}
                placeholder="Start typing in markdown..."
                className="w-full bg-transparent text-lg md:text-xl text-zinc-300 font-medium leading-relaxed outline-none resize-none placeholder:text-zinc-800 min-h-[50vh]"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
