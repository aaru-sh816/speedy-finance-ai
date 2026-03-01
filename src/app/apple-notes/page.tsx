'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNotes } from '@/hooks/useNotes'
import { DEFAULT_TEMPLATES } from '@/lib/notes-types'
import NotesSidebar from '@/components/notes/NotesSidebar'
import NotesList from '@/components/notes/NotesList'
import NoteEditor from '@/components/notes/NoteEditor'
import { Sun, Moon, Menu, ArrowLeft } from 'lucide-react'

export default function AppleNotesPage() {
  const [theme, setTheme] = useState<'notes-dark' | 'notes-light'>('notes-dark')
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  
  const {
    notes,
    folders,
    selectedNote,
    selectedFolder,
    filteredNotes,
    folderNoteCounts,
    searchQuery,
    sortBy,
    sortDirection,
    viewMode,
    sidebarCollapsed,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    toggleNotePin,
    duplicateNote,
    emptyTrash,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded,
    selectNote,
    selectFolder,
    setSearchQuery,
    setSortBy,
    setSortDirection,
    setViewMode,
    toggleSidebar,
    stats,
    stockGroups,
    thesisStats,
  } = useNotes()

  // Theme persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('apple-notes-theme') as 'notes-dark' | 'notes-light' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('notes-light')
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'notes-dark' ? 'notes-light' : 'notes-dark'
    setTheme(newTheme)
    localStorage.setItem('apple-notes-theme', newTheme)
  }, [theme])

  const handleNoteSelect = useCallback((noteId: string) => {
    selectNote(noteId)
    setIsMobileEditorOpen(true)
  }, [selectNote])

  const handleMobileBack = useCallback(() => {
    setIsMobileEditorOpen(false)
    selectNote(null)
  }, [selectNote])

  const handleNewNote = useCallback(() => {
    const newNote = createNote()
    setIsMobileEditorOpen(true)
    return newNote
  }, [createNote])

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      const newNote = createNote(undefined, template.name, template.content)
      if (template.template) {
        updateNote(newNote.id, { 
          template: template.template,
          tags: template.tags,
        })
      }
      setIsMobileEditorOpen(true)
    }
  }, [createNote, updateNote])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      if (cmdKey && e.key === 'n') {
        e.preventDefault()
        handleNewNote()
      }
      if (cmdKey && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('.notes-search-input') as HTMLInputElement
        searchInput?.focus()
      }
      if (cmdKey && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        toggleTheme()
      }
      if (cmdKey && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewNote, toggleTheme, toggleSidebar])

  if (isLoading) {
    return (
      <div className="apple-notes" data-theme={theme}>
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[var(--notes-accent-blue)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[var(--notes-text-tertiary)] text-sm">Loading research notes...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="apple-notes" data-theme={theme}>
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-4 h-[52px] border-b border-[var(--notes-border-tertiary)] bg-[var(--notes-bg-secondary)]">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="notes-toolbar-btn"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-[var(--notes-text-primary)] font-semibold">
          {selectedFolder?.name || 'Research Notes'}
        </h1>
        <button onClick={toggleTheme} className="notes-theme-toggle">
          {theme === 'notes-dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Main Layout */}
      <div className="notes-layout relative">
        {/* Sidebar */}
        <aside 
          className={`notes-sidebar notes-scrollbar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobileSidebarOpen ? 'open' : ''}`}
        >
          <NotesSidebar
            folders={folders}
            selectedFolderId={selectedFolder?.id || 'all-notes'}
            folderNoteCounts={folderNoteCounts}
            onSelectFolder={(folderId) => {
              selectFolder(folderId)
              setIsMobileSidebarOpen(false)
            }}
            onCreateFolder={createFolder}
            onUpdateFolder={updateFolder}
            onDeleteFolder={deleteFolder}
            onToggleExpanded={toggleFolderExpanded}
            onToggleTheme={toggleTheme}
            theme={theme}
            stats={stats}
            stockGroups={stockGroups}
            thesisStats={thesisStats}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Notes List */}
        <div className={`notes-list-pane ${isMobileEditorOpen ? 'hidden lg:flex' : 'flex'}`}>
          <NotesList
            notes={filteredNotes}
            selectedNoteId={selectedNote?.id || null}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortDirection={sortDirection}
            viewMode={viewMode}
            onSelectNote={handleNoteSelect}
            onCreateNote={handleNewNote}
            onCreateFromTemplate={handleCreateFromTemplate}
            onDeleteNote={deleteNote}
            onTogglePin={toggleNotePin}
            onDuplicateNote={duplicateNote}
            onRestoreNote={restoreNote}
            onSetSearchQuery={setSearchQuery}
            onSetSortBy={setSortBy}
            onSetSortDirection={setSortDirection}
            onSetViewMode={setViewMode}
            selectedFolderId={selectedFolder?.id || 'all-notes'}
            onEmptyTrash={emptyTrash}
          />
        </div>

        {/* Editor */}
        <div className={`notes-editor-pane ${isMobileEditorOpen ? 'active' : ''}`}>
          {/* Mobile Back Button */}
          {isMobileEditorOpen && (
            <div className="lg:hidden flex items-center px-4 h-[44px] border-b border-[var(--notes-border-tertiary)] bg-[var(--notes-bg-secondary)]">
              <button 
                onClick={handleMobileBack}
                className="flex items-center gap-2 text-[var(--notes-accent-blue)] text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          )}

          <NoteEditor
            note={selectedNote}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            onTogglePin={toggleNotePin}
            onDuplicateNote={duplicateNote}
          />
        </div>
      </div>
    </div>
  )
}
