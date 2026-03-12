'use client'

import { useState, useEffect, useRef } from 'react'
import { useNotes } from '@/hooks/useNotes'
import { X, Plus, FileText, ChevronRight, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'

interface NotesDrawerProps {
    scripCode: string
    isOpen: boolean
    onClose: () => void
}

export function NotesDrawer({ scripCode, isOpen, onClose }: NotesDrawerProps) {
    const { notes, createNote, updateNote } = useNotes()
    const router = useRouter()
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

    // Close drawer on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (selectedNoteId) {
                    setSelectedNoteId(null)
                    e.stopPropagation()
                } else {
                    onClose()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, selectedNoteId, onClose])

    const companyNotes = notes
        .filter(n => !n.deleted && n.scripCode === scripCode)
        .sort((a, b) => b.modified - a.modified)

    const selectedNote = notes.find(n => n.id === selectedNoteId)
    const contentRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.style.height = 'auto'
            contentRef.current.style.height = contentRef.current.scrollHeight + 'px'
        }
    }, [selectedNote?.content])

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[160] bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out"
                style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold tracking-tight text-white">Research Hub</h2>
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
                            {companyNotes.length} Note{companyNotes.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 notes-scrollbar">
                    {selectedNoteId && selectedNote ? (
                        // Editor View
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                            <button
                                onClick={() => setSelectedNoteId(null)}
                                className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm font-semibold mb-6 uppercase tracking-wider"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180" />
                                Back to Notes
                            </button>

                            <div className="flex-1 flex flex-col">
                                <input
                                    type="text"
                                    value={selectedNote.title || ''}
                                    onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                                    placeholder="Note Title..."
                                    className="w-full bg-transparent text-3xl font-black tracking-tighter outline-none mb-6 text-white placeholder:text-zinc-800"
                                />
                                <textarea
                                    ref={contentRef}
                                    value={selectedNote.content || ''}
                                    onChange={(e) => {
                                        updateNote(selectedNote.id, { content: e.target.value })
                                    }}
                                    placeholder="Start typing your research..."
                                    className="flex-1 w-full bg-transparent text-lg text-zinc-300 font-medium leading-relaxed outline-none resize-none placeholder:text-zinc-800 min-h-[50vh]"
                                />
                            </div>
                        </div>
                    ) : (
                        // List View
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <button
                                onClick={() => {
                                    // Wait, actually I need the company symbol to auto-tag. Assuming we just need scripCode to attach.
                                    const note = createNote(undefined, '', '')
                                    updateNote(note.id, { scripCode })
                                    setSelectedNoteId(note.id)
                                }}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-white/20 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all group"
                            >
                                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-sm">Create New Note</span>
                            </button>

                            {companyNotes.length === 0 ? (
                                <div className="py-20 text-center opacity-40">
                                    <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
                                    <p className="text-sm font-medium max-w-[200px] mx-auto leading-relaxed">
                                        No research notes found for this company yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 pt-2">
                                    {companyNotes.map(note => (
                                        <div
                                            key={note.id}
                                            onClick={() => setSelectedNoteId(note.id)}
                                            className="group p-5 rounded-2xl bg-[#121215] border border-white/5 hover:bg-[#18181c] hover:border-cyan-500/30 hover:-translate-y-0.5 transition-all cursor-pointer"
                                        >
                                            <h3 className="font-bold text-white mb-2 leading-tight group-hover:text-cyan-400 transition-colors">
                                                {note.title || 'Untitled Note'}
                                            </h3>
                                            <p className="text-sm text-zinc-500 line-clamp-3 mb-4 leading-relaxed">
                                                {note.content?.replace(/<[^>]*>?/gm, '') || 'Empty note...'}
                                            </p>
                                            <div className="flex items-center justify-between mt-auto">
                                                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-600">
                                                    {formatDistanceToNow(note.modified, { addSuffix: true })}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
