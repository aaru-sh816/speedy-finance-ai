// Apple Notes Clone - Storage Operations

import {
  Note,
  Folder,
  NoteVersion,
  NotesState,
  SortOption,
  SYSTEM_FOLDERS,
  SMART_FOLDERS,
  NOTES_STORAGE_KEY,
} from './notes-types'

// ============================================
// Utility Functions
// ============================================

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function generateId(): string {
  return crypto.randomUUID()
}

function extractPlainText(html: string): string {
  if (!isBrowser()) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ============================================
// Default Data
// ============================================

function getDefaultFolders(): Folder[] {
  return [
    {
      id: SYSTEM_FOLDERS.ALL_NOTES,
      name: 'All Notes',
      icon: 'FileText',
      color: '#0A84FF',
      parentId: null,
      order: 0,
      expanded: true,
      isSystem: true,
    },
    {
      id: SYSTEM_FOLDERS.FAVORITES,
      name: 'Favorites',
      icon: 'Star',
      color: '#FFD60A',
      parentId: null,
      order: 1,
      expanded: true,
      isSystem: true,
    },
    {
      id: 'notes',
      name: 'Notes',
      icon: 'Folder',
      color: '#30D158',
      parentId: null,
      order: 2,
      expanded: true,
      isSystem: false,
    },
    {
      id: SYSTEM_FOLDERS.RECENTLY_DELETED,
      name: 'Recently Deleted',
      icon: 'Trash2',
      color: '#FF453A',
      parentId: null,
      order: 999,
      expanded: false,
      isSystem: true,
    },
  ]
}

function getDefaultState(): NotesState {
  return {
    notes: [],
    folders: getDefaultFolders(),
    selectedNoteId: null,
    selectedFolderId: SYSTEM_FOLDERS.ALL_NOTES,
    searchQuery: '',
    sortBy: 'modified',
    sortDirection: 'desc',
    viewMode: 'list',
    sidebarCollapsed: false,
    listCollapsed: false,
  }
}

// ============================================
// Storage Operations
// ============================================

export function getNotesState(): NotesState {
  if (!isBrowser()) return getDefaultState()
  try {
    const data = localStorage.getItem(NOTES_STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      // Merge with defaults to handle new fields
      return {
        ...getDefaultState(),
        ...parsed,
        folders: parsed.folders?.length > 0 ? parsed.folders : getDefaultFolders(),
      }
    }
    return getDefaultState()
  } catch {
    return getDefaultState()
  }
}

export function saveNotesState(state: NotesState): void {
  if (!isBrowser()) return
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('apple-notes-updated', { detail: state }))
}

// ============================================
// Note Operations
// ============================================

export function getAllNotes(): Note[] {
  return getNotesState().notes.filter(n => !n.deleted)
}

export function getDeletedNotes(): Note[] {
  return getNotesState().notes.filter(n => n.deleted)
}

export function getNoteById(id: string): Note | undefined {
  return getNotesState().notes.find(n => n.id === id)
}

export function getNotesByFolder(folderId: string): Note[] {
  const state = getNotesState()
  const notes = state.notes.filter(n => !n.deleted)
  
  switch (folderId) {
    case SYSTEM_FOLDERS.ALL_NOTES:
      return notes
    case SYSTEM_FOLDERS.FAVORITES:
      return notes.filter(n => n.pinned)
    case SYSTEM_FOLDERS.RECENTLY_DELETED:
      return state.notes.filter(n => n.deleted)
    // Smart folders
    case SMART_FOLDERS.BULLISH:
      return notes.filter(n => n.sentiment === 'bullish')
    case SMART_FOLDERS.BEARISH:
      return notes.filter(n => n.sentiment === 'bearish')
    case SMART_FOLDERS.HIGH_CONVICTION:
      return notes.filter(n => n.confidence && n.confidence >= 4)
    case SMART_FOLDERS.ACTIVE_THESES:
      return notes.filter(n => n.thesisStatus === 'active')
    case SMART_FOLDERS.WITH_TARGETS:
      return notes.filter(n => n.priceTarget != null)
    default:
      // Check if it's a stock-specific folder (stock-SCRIPCODE)
      if (folderId.startsWith('stock-')) {
        const scripCode = folderId.replace('stock-', '')
        return notes.filter(n => n.scripCode === scripCode)
      }
      return notes.filter(n => n.folderId === folderId)
  }
}

export function getStockGroups(): { scripCode: string; symbol: string; companyName: string; count: number }[] {
  const notes = getAllNotes().filter(n => n.scripCode)
  const groups = new Map<string, { symbol: string; companyName: string; count: number }>()
  
  for (const note of notes) {
    if (!note.scripCode) continue
    const existing = groups.get(note.scripCode)
    if (existing) {
      existing.count++
    } else {
      groups.set(note.scripCode, {
        symbol: note.symbol || note.scripCode,
        companyName: note.companyName || '',
        count: 1,
      })
    }
  }
  
  return Array.from(groups.entries()).map(([scripCode, data]) => ({
    scripCode,
    ...data,
  })).sort((a, b) => b.count - a.count)
}

export function getThesisStats(): {
  active: number
  closedWin: number
  closedLoss: number
  invalidated: number
  winRate: number
  totalPnlPercent: number
} {
  const notes = getAllNotes()
  const active = notes.filter(n => n.thesisStatus === 'active').length
  const closedWin = notes.filter(n => n.thesisStatus === 'closed-win').length
  const closedLoss = notes.filter(n => n.thesisStatus === 'closed-loss').length
  const invalidated = notes.filter(n => n.thesisStatus === 'invalidated').length
  const totalClosed = closedWin + closedLoss
  const winRate = totalClosed > 0 ? (closedWin / totalClosed) * 100 : 0
  
  // Calculate total P&L from closed theses
  let totalPnlPercent = 0
  notes.filter(n => (n.thesisStatus === 'closed-win' || n.thesisStatus === 'closed-loss') && n.priceAtCreation && n.closedPrice).forEach(n => {
    totalPnlPercent += ((n.closedPrice! - n.priceAtCreation!) / n.priceAtCreation!) * 100
  })
  
  return { active, closedWin, closedLoss, invalidated, winRate, totalPnlPercent }
}

export function createNote(
  folderId: string = 'notes',
  title: string = '',
  content: string = ''
): Note {
  const state = getNotesState()
  const now = Date.now()
  const plainText = extractPlainText(content)
  
  const newNote: Note = {
    id: generateId(),
    title: title || 'New Note',
    content,
    plainText,
    folderId: folderId === SYSTEM_FOLDERS.ALL_NOTES || 
              folderId === SYSTEM_FOLDERS.FAVORITES ||
              folderId === SYSTEM_FOLDERS.RECENTLY_DELETED 
              ? 'notes' : folderId,
    tags: [],
    pinned: false,
    locked: false,
    created: now,
    modified: now,
    wordCount: countWords(plainText),
    versions: [],
  }
  
  state.notes = [newNote, ...state.notes]
  state.selectedNoteId = newNote.id
  saveNotesState(state)
  
  return newNote
}

export function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'tags' | 'pinned' | 'locked' | 'passwordHash' | 'scripCode' | 'symbol' | 'companyName' | 'sentiment' | 'priceAtCreation' | 'priceTarget' | 'stopLoss' | 'confidence' | 'timeframe' | 'template' | 'linkedAnnouncements' | 'linkedNoteIds' | 'thesisStatus' | 'closedAt' | 'closedPrice'>>
): Note | undefined {
  const state = getNotesState()
  const noteIndex = state.notes.findIndex(n => n.id === id)
  
  if (noteIndex === -1) return undefined
  
  const note = state.notes[noteIndex]
  const now = Date.now()
  
  // Create version if content changed significantly
  if (updates.content !== undefined && updates.content !== note.content) {
    const timeSinceLastVersion = note.versions.length > 0 
      ? now - note.versions[0].timestamp 
      : Infinity
    
    // Save version if more than 5 minutes since last version
    if (timeSinceLastVersion > 5 * 60 * 1000) {
      const newVersion: NoteVersion = {
        id: generateId(),
        content: note.content,
        plainText: note.plainText,
        timestamp: now,
        description: 'Auto-saved version',
      }
      note.versions = [newVersion, ...note.versions].slice(0, 10) // Keep last 10
    }
  }
  
  // Apply updates
  const plainText = updates.content !== undefined 
    ? extractPlainText(updates.content) 
    : note.plainText
    
  const updatedNote: Note = {
    ...note,
    ...updates,
    plainText,
    wordCount: countWords(plainText),
    modified: now,
  }
  
  state.notes[noteIndex] = updatedNote
  saveNotesState(state)
  
  return updatedNote
}

export function deleteNote(id: string, permanent: boolean = false): boolean {
  const state = getNotesState()
  const noteIndex = state.notes.findIndex(n => n.id === id)
  
  if (noteIndex === -1) return false
  
  if (permanent) {
    // Permanent delete
    state.notes = state.notes.filter(n => n.id !== id)
  } else {
    // Soft delete (move to trash)
    state.notes[noteIndex] = {
      ...state.notes[noteIndex],
      deleted: true,
      deletedAt: Date.now(),
    }
  }
  
  // Clear selection if deleted note was selected
  if (state.selectedNoteId === id) {
    state.selectedNoteId = null
  }
  
  saveNotesState(state)
  return true
}

export function restoreNote(id: string): boolean {
  const state = getNotesState()
  const noteIndex = state.notes.findIndex(n => n.id === id)
  
  if (noteIndex === -1) return false
  
  state.notes[noteIndex] = {
    ...state.notes[noteIndex],
    deleted: false,
    deletedAt: undefined,
  }
  
  saveNotesState(state)
  return true
}

export function emptyTrash(): number {
  const state = getNotesState()
  const deletedCount = state.notes.filter(n => n.deleted).length
  state.notes = state.notes.filter(n => !n.deleted)
  saveNotesState(state)
  return deletedCount
}

export function toggleNotePin(id: string): boolean {
  const state = getNotesState()
  const noteIndex = state.notes.findIndex(n => n.id === id)
  
  if (noteIndex === -1) return false
  
  state.notes[noteIndex] = {
    ...state.notes[noteIndex],
    pinned: !state.notes[noteIndex].pinned,
    modified: Date.now(),
  }
  
  saveNotesState(state)
  return state.notes[noteIndex].pinned
}

export function duplicateNote(id: string): Note | undefined {
  const originalNote = getNoteById(id)
  if (!originalNote) return undefined
  
  const state = getNotesState()
  const now = Date.now()
  
  const duplicatedNote: Note = {
    ...originalNote,
    id: generateId(),
    title: `${originalNote.title} (Copy)`,
    created: now,
    modified: now,
    pinned: false,
    locked: false,
    passwordHash: undefined,
    versions: [],
  }
  
  state.notes = [duplicatedNote, ...state.notes]
  state.selectedNoteId = duplicatedNote.id
  saveNotesState(state)
  
  return duplicatedNote
}

// ============================================
// Folder Operations
// ============================================

export function getAllFolders(): Folder[] {
  return getNotesState().folders
}

export function getFolderById(id: string): Folder | undefined {
  return getNotesState().folders.find(f => f.id === id)
}

export function createFolder(
  name: string,
  color: string = '#0A84FF',
  icon: string = 'Folder',
  parentId: string | null = null
): Folder {
  const state = getNotesState()
  const maxOrder = Math.max(...state.folders.filter(f => !f.isSystem || f.id !== SYSTEM_FOLDERS.RECENTLY_DELETED).map(f => f.order), 0)
  
  const newFolder: Folder = {
    id: generateId(),
    name,
    icon,
    color,
    parentId,
    order: maxOrder + 1,
    expanded: true,
    isSystem: false,
  }
  
  // Insert before Recently Deleted
  const recentlyDeletedIndex = state.folders.findIndex(f => f.id === SYSTEM_FOLDERS.RECENTLY_DELETED)
  if (recentlyDeletedIndex !== -1) {
    state.folders.splice(recentlyDeletedIndex, 0, newFolder)
  } else {
    state.folders.push(newFolder)
  }
  
  saveNotesState(state)
  return newFolder
}

export function updateFolder(
  id: string,
  updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'expanded' | 'parentId' | 'order'>>
): Folder | undefined {
  const state = getNotesState()
  const folderIndex = state.folders.findIndex(f => f.id === id)
  
  if (folderIndex === -1) return undefined
  
  // Don't allow updating system folder names
  const folder = state.folders[folderIndex]
  if (folder.isSystem && updates.name) {
    delete updates.name
  }
  
  state.folders[folderIndex] = {
    ...folder,
    ...updates,
  }
  
  saveNotesState(state)
  return state.folders[folderIndex]
}

export function deleteFolder(id: string): boolean {
  const state = getNotesState()
  const folder = state.folders.find(f => f.id === id)
  
  // Don't delete system folders
  if (!folder || folder.isSystem) return false
  
  // Move notes in this folder to "Notes" folder
  state.notes = state.notes.map(n => 
    n.folderId === id ? { ...n, folderId: 'notes' } : n
  )
  
  // Remove folder
  state.folders = state.folders.filter(f => f.id !== id)
  
  // If this folder was selected, select All Notes
  if (state.selectedFolderId === id) {
    state.selectedFolderId = SYSTEM_FOLDERS.ALL_NOTES
  }
  
  saveNotesState(state)
  return true
}

export function toggleFolderExpanded(id: string): boolean {
  const state = getNotesState()
  const folderIndex = state.folders.findIndex(f => f.id === id)
  
  if (folderIndex === -1) return false
  
  state.folders[folderIndex] = {
    ...state.folders[folderIndex],
    expanded: !state.folders[folderIndex].expanded,
  }
  
  saveNotesState(state)
  return state.folders[folderIndex].expanded
}

// ============================================
// UI State Operations
// ============================================

export function setSelectedNote(noteId: string | null): void {
  const state = getNotesState()
  state.selectedNoteId = noteId
  saveNotesState(state)
}

export function setSelectedFolder(folderId: string): void {
  const state = getNotesState()
  state.selectedFolderId = folderId
  state.selectedNoteId = null // Clear note selection when changing folders
  saveNotesState(state)
}

export function setSearchQuery(query: string): void {
  const state = getNotesState()
  state.searchQuery = query
  saveNotesState(state)
}

export function setSortBy(sortBy: SortOption): void {
  const state = getNotesState()
  state.sortBy = sortBy
  saveNotesState(state)
}

export function setSortDirection(direction: 'asc' | 'desc'): void {
  const state = getNotesState()
  state.sortDirection = direction
  saveNotesState(state)
}

export function setViewMode(mode: 'list' | 'grid'): void {
  const state = getNotesState()
  state.viewMode = mode
  saveNotesState(state)
}

export function toggleSidebar(): boolean {
  const state = getNotesState()
  state.sidebarCollapsed = !state.sidebarCollapsed
  saveNotesState(state)
  return state.sidebarCollapsed
}

export function toggleListCollapsed(): boolean {
  const state = getNotesState()
  state.listCollapsed = !state.listCollapsed
  saveNotesState(state)
  return state.listCollapsed
}

// ============================================
// Search Operations
// ============================================

export function searchNotes(query: string): Note[] {
  if (!query.trim()) return getAllNotes()
  
  const normalizedQuery = query.toLowerCase().trim()
  const notes = getAllNotes()
  
  return notes.filter(note => {
    const titleMatch = note.title.toLowerCase().includes(normalizedQuery)
    const contentMatch = note.plainText.toLowerCase().includes(normalizedQuery)
    const tagMatch = note.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    return titleMatch || contentMatch || tagMatch
  }).sort((a, b) => {
    // Prioritize title matches
    const aTitle = a.title.toLowerCase().includes(normalizedQuery)
    const bTitle = b.title.toLowerCase().includes(normalizedQuery)
    if (aTitle && !bTitle) return -1
    if (!aTitle && bTitle) return 1
    return b.modified - a.modified
  })
}

// Fuzzy search for better UX
export function fuzzySearchNotes(query: string): Note[] {
  if (!query.trim()) return getAllNotes()
  
  const normalizedQuery = query.toLowerCase().trim()
  const notes = getAllNotes()
  
  const scoredNotes = notes.map(note => {
    let score = 0
    const titleLower = note.title.toLowerCase()
    const contentLower = note.plainText.toLowerCase()
    
    // Exact match in title (highest priority)
    if (titleLower.includes(normalizedQuery)) {
      score += 100
      // Bonus for starts with
      if (titleLower.startsWith(normalizedQuery)) score += 50
    }
    
    // Exact match in content
    if (contentLower.includes(normalizedQuery)) {
      score += 50
    }
    
    // Tag match
    if (note.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
      score += 30
    }
    
    // Fuzzy character matching in title
    let charIndex = 0
    for (const char of normalizedQuery) {
      const foundIndex = titleLower.indexOf(char, charIndex)
      if (foundIndex !== -1) {
        score += 2
        charIndex = foundIndex + 1
      }
    }
    
    return { note, score }
  })
  
  return scoredNotes
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ note }) => note)
}

// ============================================
// Sorting Operations
// ============================================

export function sortNotes(notes: Note[], sortBy: SortOption, direction: 'asc' | 'desc'): Note[] {
  const multiplier = direction === 'asc' ? 1 : -1
  const sentimentOrder = { bullish: 3, neutral: 2, bearish: 1 }
  
  return [...notes].sort((a, b) => {
    // Pinned notes always first
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    
    switch (sortBy) {
      case 'modified':
        return (a.modified - b.modified) * multiplier
      case 'created':
        return (a.created - b.created) * multiplier
      case 'title':
        return a.title.localeCompare(b.title) * multiplier
      case 'wordCount':
        return (a.wordCount - b.wordCount) * multiplier
      case 'sentiment': {
        const aVal = sentimentOrder[a.sentiment || 'neutral'] || 2
        const bVal = sentimentOrder[b.sentiment || 'neutral'] || 2
        return (aVal - bVal) * multiplier
      }
      case 'symbol':
        return (a.symbol || '').localeCompare(b.symbol || '') * multiplier
      case 'confidence':
        return ((a.confidence || 0) - (b.confidence || 0)) * multiplier
      default:
        return 0
    }
  })
}

// ============================================
// Import/Export Operations
// ============================================

export function exportNotesData(): string {
  const state = getNotesState()
  return JSON.stringify({
    notes: state.notes,
    folders: state.folders.filter(f => !f.isSystem),
    exportedAt: new Date().toISOString(),
    version: 1,
  }, null, 2)
}

export function importNotesData(jsonString: string): { success: boolean; imported: number; error?: string } {
  try {
    const data = JSON.parse(jsonString)
    const state = getNotesState()
    
    let importedCount = 0
    
    // Import notes
    if (Array.isArray(data.notes)) {
      for (const note of data.notes) {
        // Check for duplicate by ID
        if (!state.notes.some(n => n.id === note.id)) {
          state.notes.push({
            ...note,
            folderId: note.folderId || 'notes',
          })
          importedCount++
        }
      }
    }
    
    // Import custom folders
    if (Array.isArray(data.folders)) {
      for (const folder of data.folders) {
        if (!folder.isSystem && !state.folders.some(f => f.id === folder.id)) {
          state.folders.push(folder)
        }
      }
    }
    
    saveNotesState(state)
    return { success: true, imported: importedCount }
  } catch (error) {
    return { 
      success: false, 
      imported: 0, 
      error: error instanceof Error ? error.message : 'Invalid JSON format' 
    }
  }
}

// ============================================
// Cleanup Operations
// ============================================

export function cleanupOldTrash(daysOld: number = 30): number {
  const state = getNotesState()
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
  
  const notesToDelete = state.notes.filter(
    n => n.deleted && n.deletedAt && n.deletedAt < cutoffTime
  )
  
  state.notes = state.notes.filter(
    n => !(n.deleted && n.deletedAt && n.deletedAt < cutoffTime)
  )
  
  saveNotesState(state)
  return notesToDelete.length
}

// ============================================
// Statistics
// ============================================

export function getNotesStats(): {
  totalNotes: number
  totalFolders: number
  totalWords: number
  pinnedNotes: number
  trashedNotes: number
} {
  const state = getNotesState()
  const activeNotes = state.notes.filter(n => !n.deleted)
  
  return {
    totalNotes: activeNotes.length,
    totalFolders: state.folders.filter(f => !f.isSystem).length,
    totalWords: activeNotes.reduce((sum, n) => sum + n.wordCount, 0),
    pinnedNotes: activeNotes.filter(n => n.pinned).length,
    trashedNotes: state.notes.filter(n => n.deleted).length,
  }
}
