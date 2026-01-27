'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  StockNote,
  getNotes,
  getNotesByScripCode,
  addNote,
  updateNote,
  deleteNote,
  toggleNotePin,
} from '@/lib/storage'

export interface UseStockNotesReturn {
  notes: StockNote[]
  isLoading: boolean
  add: (note: Omit<StockNote, 'id' | 'createdAt' | 'updatedAt'>) => void
  update: (id: string, updates: Partial<Omit<StockNote, 'id' | 'createdAt'>>) => void
  remove: (id: string) => void
  togglePin: (id: string) => void
  getByTag: (tag: string) => StockNote[]
  getBySentiment: (sentiment: StockNote['sentiment']) => StockNote[]
  search: (query: string) => StockNote[]
  getAllTags: () => string[]
}

export function useStockNotes(scripCode?: string): UseStockNotesReturn {
  const [notes, setNotes] = useState<StockNote[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadNotes = useCallback(() => {
    const allNotes = scripCode ? getNotesByScripCode(scripCode) : getNotes()
    const sorted = allNotes.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    setNotes(sorted)
    setIsLoading(false)
  }, [scripCode])

  useEffect(() => {
    loadNotes()

    const handleNotesUpdate = () => loadNotes()
    window.addEventListener('notes-updated', handleNotesUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === 'speedy-notes-v2') handleNotesUpdate()
    })

    return () => {
      window.removeEventListener('notes-updated', handleNotesUpdate)
    }
  }, [loadNotes])

  const add = useCallback((note: Omit<StockNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    addNote(note)
    loadNotes()
  }, [loadNotes])

  const update = useCallback((id: string, updates: Partial<Omit<StockNote, 'id' | 'createdAt'>>) => {
    updateNote(id, updates)
    loadNotes()
  }, [loadNotes])

  const remove = useCallback((id: string) => {
    deleteNote(id)
    loadNotes()
  }, [loadNotes])

  const togglePin = useCallback((id: string) => {
    toggleNotePin(id)
    loadNotes()
  }, [loadNotes])

  const getByTag = useCallback((tag: string) => {
    return notes.filter(n => n.tags.includes(tag))
  }, [notes])

  const getBySentiment = useCallback((sentiment: StockNote['sentiment']) => {
    return notes.filter(n => n.sentiment === sentiment)
  }, [notes])

  const search = useCallback((query: string) => {
    const q = query.toLowerCase()
    return notes.filter(n => 
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.symbol.toLowerCase().includes(q) ||
      n.companyName.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [notes])

  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [notes])

  return {
    notes,
    isLoading,
    add,
    update,
    remove,
    togglePin,
    getByTag,
    getBySentiment,
    search,
    getAllTags,
  }
}
