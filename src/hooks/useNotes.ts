'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Note,
  Folder,
  NotesState,
  SortOption,
  SYSTEM_FOLDERS,
  SMART_FOLDERS,
} from '@/lib/notes-types'
import {
  getNotesState,
  saveNotesState,
  getAllNotes,
  getNoteById,
  getNotesByFolder,
  getStockGroups,
  getThesisStats,
  createNote as createNoteStorage,
  updateNote as updateNoteStorage,
  deleteNote as deleteNoteStorage,
  restoreNote as restoreNoteStorage,
  toggleNotePin as toggleNotePinStorage,
  duplicateNote as duplicateNoteStorage,
  emptyTrash as emptyTrashStorage,
  getAllFolders,
  getFolderById,
  createFolder as createFolderStorage,
  updateFolder as updateFolderStorage,
  deleteFolder as deleteFolderStorage,
  toggleFolderExpanded as toggleFolderExpandedStorage,
  setSelectedNote as setSelectedNoteStorage,
  setSelectedFolder as setSelectedFolderStorage,
  setSearchQuery as setSearchQueryStorage,
  setSortBy as setSortByStorage,
  setSortDirection as setSortDirectionStorage,
  setViewMode as setViewModeStorage,
  toggleSidebar as toggleSidebarStorage,
  toggleListCollapsed as toggleListCollapsedStorage,
  searchNotes,
  fuzzySearchNotes,
  sortNotes,
  getNotesStats,
  exportNotesData,
  importNotesData,
  cleanupOldTrash,
} from '@/lib/notes-storage'

type NoteUpdateFields = Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'tags' | 'pinned' | 'locked' | 'passwordHash' | 'scripCode' | 'symbol' | 'companyName' | 'sentiment' | 'priceAtCreation' | 'priceTarget' | 'stopLoss' | 'confidence' | 'timeframe' | 'template' | 'linkedAnnouncements' | 'linkedNoteIds' | 'thesisStatus' | 'closedAt' | 'closedPrice'>>

export interface UseNotesReturn {
  // State
  notes: Note[]
  folders: Folder[]
  selectedNote: Note | null
  selectedFolder: Folder | null
  searchQuery: string
  sortBy: SortOption
  sortDirection: 'asc' | 'desc'
  viewMode: 'list' | 'grid'
  sidebarCollapsed: boolean
  listCollapsed: boolean
  isLoading: boolean
  
  // Computed
  filteredNotes: Note[]
  folderNoteCounts: Record<string, number>
  stats: ReturnType<typeof getNotesStats>
  stockGroups: ReturnType<typeof getStockGroups>
  thesisStats: ReturnType<typeof getThesisStats>
  
  // Note Actions
  createNote: (folderId?: string, title?: string, content?: string) => Note
  updateNote: (id: string, updates: NoteUpdateFields) => void
  deleteNote: (id: string, permanent?: boolean) => void
  restoreNote: (id: string) => void
  toggleNotePin: (id: string) => void
  duplicateNote: (id: string) => void
  emptyTrash: () => number
  
  // Folder Actions
  createFolder: (name: string, color?: string, icon?: string, parentId?: string | null) => Folder
  updateFolder: (id: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'expanded' | 'parentId' | 'order'>>) => void
  deleteFolder: (id: string) => void
  toggleFolderExpanded: (id: string) => void
  
  // Selection Actions
  selectNote: (noteId: string | null) => void
  selectFolder: (folderId: string) => void
  
  // UI Actions
  setSearchQuery: (query: string) => void
  setSortBy: (sortBy: SortOption) => void
  setSortDirection: (direction: 'asc' | 'desc') => void
  setViewMode: (mode: 'list' | 'grid') => void
  toggleSidebar: () => void
  toggleListCollapsed: () => void
  
  // Import/Export
  exportData: () => string
  importData: (json: string) => { success: boolean; imported: number; error?: string }
  
  // Refresh
  refresh: () => void
}

export function useNotes(): UseNotesReturn {
  const [state, setState] = useState<NotesState>(() => getNotesState())
  const [isLoading, setIsLoading] = useState(true)

  // Load initial state
  const refresh = useCallback(() => {
    const newState = getNotesState()
    setState(newState)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    
    // Cleanup old trash on mount
    cleanupOldTrash(30)

    // Listen for storage updates
    const handleUpdate = (e: CustomEvent<NotesState>) => {
      setState(e.detail)
    }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'apple-notes-data-v1') {
        refresh()
      }
    }

    window.addEventListener('apple-notes-updated', handleUpdate as EventListener)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('apple-notes-updated', handleUpdate as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [refresh])

  // Computed values
  const selectedNote = useMemo(() => 
    state.selectedNoteId ? getNoteById(state.selectedNoteId) || null : null,
    [state.selectedNoteId, state.notes]
  )

  const selectedFolder = useMemo(() => 
    getFolderById(state.selectedFolderId) || null,
    [state.selectedFolderId, state.folders]
  )

  const filteredNotes = useMemo(() => {
    let notes: Note[]
    
    // Get notes based on search or folder
    if (state.searchQuery) {
      notes = fuzzySearchNotes(state.searchQuery)
    } else {
      notes = getNotesByFolder(state.selectedFolderId)
    }
    
    // Sort notes
    return sortNotes(notes, state.sortBy, state.sortDirection)
  }, [state.notes, state.selectedFolderId, state.searchQuery, state.sortBy, state.sortDirection])

  const folderNoteCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const activeNotes = state.notes.filter(n => !n.deleted)
    const deletedNotes = state.notes.filter(n => n.deleted)
    
    // System folders
    counts[SYSTEM_FOLDERS.ALL_NOTES] = activeNotes.length
    counts[SYSTEM_FOLDERS.FAVORITES] = activeNotes.filter(n => n.pinned).length
    counts[SYSTEM_FOLDERS.RECENTLY_DELETED] = deletedNotes.length
    
    // Smart folders
    counts[SMART_FOLDERS.BULLISH] = activeNotes.filter(n => n.sentiment === 'bullish').length
    counts[SMART_FOLDERS.BEARISH] = activeNotes.filter(n => n.sentiment === 'bearish').length
    counts[SMART_FOLDERS.HIGH_CONVICTION] = activeNotes.filter(n => n.confidence && n.confidence >= 4).length
    counts[SMART_FOLDERS.ACTIVE_THESES] = activeNotes.filter(n => n.thesisStatus === 'active').length
    counts[SMART_FOLDERS.WITH_TARGETS] = activeNotes.filter(n => n.priceTarget != null).length
    
    // Custom folders
    state.folders.filter(f => !f.isSystem).forEach(folder => {
      counts[folder.id] = activeNotes.filter(n => n.folderId === folder.id).length
    })
    
    // Stock-specific folders
    const stockGroups = new Map<string, number>()
    activeNotes.forEach(n => {
      if (n.scripCode) {
        stockGroups.set(n.scripCode, (stockGroups.get(n.scripCode) || 0) + 1)
      }
    })
    stockGroups.forEach((count, scripCode) => {
      counts[`stock-${scripCode}`] = count
    })
    
    return counts
  }, [state.notes, state.folders])

  const stats = useMemo(() => getNotesStats(), [state.notes])
  const stockGroups = useMemo(() => getStockGroups(), [state.notes])
  const thesisStats = useMemo(() => getThesisStats(), [state.notes])

  // Note Actions
  const createNote = useCallback((folderId?: string, title?: string, content?: string) => {
    const note = createNoteStorage(folderId || state.selectedFolderId, title, content)
    refresh()
    return note
  }, [state.selectedFolderId, refresh])

  const updateNote = useCallback((id: string, updates: NoteUpdateFields) => {
    updateNoteStorage(id, updates)
    refresh()
  }, [refresh])

  const deleteNote = useCallback((id: string, permanent: boolean = false) => {
    deleteNoteStorage(id, permanent)
    refresh()
  }, [refresh])

  const restoreNote = useCallback((id: string) => {
    restoreNoteStorage(id)
    refresh()
  }, [refresh])

  const toggleNotePin = useCallback((id: string) => {
    toggleNotePinStorage(id)
    refresh()
  }, [refresh])

  const duplicateNote = useCallback((id: string) => {
    duplicateNoteStorage(id)
    refresh()
  }, [refresh])

  const emptyTrash = useCallback(() => {
    const count = emptyTrashStorage()
    refresh()
    return count
  }, [refresh])

  // Folder Actions
  const createFolder = useCallback((name: string, color?: string, icon?: string, parentId?: string | null) => {
    const folder = createFolderStorage(name, color, icon, parentId)
    refresh()
    return folder
  }, [refresh])

  const updateFolder = useCallback((id: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'expanded' | 'parentId' | 'order'>>) => {
    updateFolderStorage(id, updates)
    refresh()
  }, [refresh])

  const deleteFolder = useCallback((id: string) => {
    deleteFolderStorage(id)
    refresh()
  }, [refresh])

  const toggleFolderExpanded = useCallback((id: string) => {
    toggleFolderExpandedStorage(id)
    refresh()
  }, [refresh])

  // Selection Actions
  const selectNote = useCallback((noteId: string | null) => {
    setSelectedNoteStorage(noteId)
    refresh()
  }, [refresh])

  const selectFolder = useCallback((folderId: string) => {
    setSelectedFolderStorage(folderId)
    refresh()
  }, [refresh])

  // UI Actions
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryStorage(query)
    refresh()
  }, [refresh])

  const setSortBy = useCallback((sortBy: SortOption) => {
    setSortByStorage(sortBy)
    refresh()
  }, [refresh])

  const setSortDirection = useCallback((direction: 'asc' | 'desc') => {
    setSortDirectionStorage(direction)
    refresh()
  }, [refresh])

  const setViewMode = useCallback((mode: 'list' | 'grid') => {
    setViewModeStorage(mode)
    refresh()
  }, [refresh])

  const toggleSidebar = useCallback(() => {
    toggleSidebarStorage()
    refresh()
  }, [refresh])

  const toggleListCollapsed = useCallback(() => {
    toggleListCollapsedStorage()
    refresh()
  }, [refresh])

  // Import/Export
  const exportData = useCallback(() => exportNotesData(), [])
  
  const importData = useCallback((json: string) => {
    const result = importNotesData(json)
    refresh()
    return result
  }, [refresh])

  return {
    // State
    notes: state.notes,
    folders: state.folders,
    selectedNote,
    selectedFolder,
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    viewMode: state.viewMode,
    sidebarCollapsed: state.sidebarCollapsed,
    listCollapsed: state.listCollapsed,
    isLoading,
    
    // Computed
    filteredNotes,
    folderNoteCounts,
    stats,
    stockGroups,
    thesisStats,
    
    // Note Actions
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    toggleNotePin,
    duplicateNote,
    emptyTrash,
    
    // Folder Actions
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded,
    
    // Selection Actions
    selectNote,
    selectFolder,
    
    // UI Actions
    setSearchQuery,
    setSortBy,
    setSortDirection,
    setViewMode,
    toggleSidebar,
    toggleListCollapsed,
    
    // Import/Export
    exportData,
    importData,
    
    // Refresh
    refresh,
  }
}
