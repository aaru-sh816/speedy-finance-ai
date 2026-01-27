'use client'

import { useEffect, useCallback, createContext, useContext, useState, ReactNode } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
  scope?: 'global' | 'watchlist' | 'notes' | 'company'
}

interface KeyboardShortcutsContextType {
  registerShortcut: (shortcut: Shortcut) => void
  unregisterShortcut: (key: string) => void
  shortcuts: Shortcut[]
  showHelp: boolean
  setShowHelp: (show: boolean) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null)

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider')
  }
  return context
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode
  onOpenSearch?: () => void
  onOpenWatchlist?: () => void
  onOpenNotes?: () => void
  onQuickNote?: () => void
}

export function KeyboardShortcutsProvider({ 
  children, 
  onOpenSearch,
  onOpenWatchlist,
  onOpenNotes,
  onQuickNote,
}: KeyboardShortcutsProviderProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [showHelp, setShowHelp] = useState(false)

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts(prev => {
      const exists = prev.some(s => 
        s.key === shortcut.key && 
        s.ctrl === shortcut.ctrl && 
        s.shift === shortcut.shift && 
        s.alt === shortcut.alt
      )
      if (exists) return prev
      return [...prev, shortcut]
    })
  }, [])

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts(prev => prev.filter(s => s.key !== key))
  }, [])

  useEffect(() => {
    // Register default shortcuts
    const defaultShortcuts: Shortcut[] = [
      {
        key: 'k',
        ctrl: true,
        description: 'Open search',
        action: () => onOpenSearch?.(),
        scope: 'global',
      },
      {
        key: 'w',
        description: 'Toggle watchlist panel',
        action: () => onOpenWatchlist?.(),
        scope: 'global',
      },
      {
        key: 'n',
        description: 'Quick note',
        action: () => onQuickNote?.(),
        scope: 'global',
      },
      {
        key: 'g',
        shift: true,
        description: 'Go to notes page',
        action: () => onOpenNotes?.(),
        scope: 'global',
      },
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(true),
        scope: 'global',
      },
      {
        key: 'Escape',
        description: 'Close modal/panel',
        action: () => setShowHelp(false),
        scope: 'global',
      },
    ]

    defaultShortcuts.forEach(registerShortcut)

    return () => {
      defaultShortcuts.forEach(s => unregisterShortcut(s.key))
    }
  }, [registerShortcut, unregisterShortcut, onOpenSearch, onOpenWatchlist, onOpenNotes, onQuickNote])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        // But allow Escape
        if (e.key !== 'Escape') return
      }

      const matchingShortcut = shortcuts.find(s => {
        const keyMatch = s.key.toLowerCase() === e.key.toLowerCase()
        const ctrlMatch = !s.ctrl || (e.ctrlKey || e.metaKey)
        const shiftMatch = !s.shift || e.shiftKey
        const altMatch = !s.alt || e.altKey
        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (matchingShortcut) {
        e.preventDefault()
        matchingShortcut.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])

  return (
    <KeyboardShortcutsContext.Provider value={{ registerShortcut, unregisterShortcut, shortcuts, showHelp, setShowHelp }}>
      {children}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} shortcuts={shortcuts} />}
    </KeyboardShortcutsContext.Provider>
  )
}

function KeyboardShortcutsHelp({ onClose, shortcuts }: { onClose: () => void; shortcuts: Shortcut[] }) {
  const groupedShortcuts = shortcuts.reduce((acc, s) => {
    const scope = s.scope || 'global'
    if (!acc[scope]) acc[scope] = []
    acc[scope].push(s)
    return acc
  }, {} as Record<string, Shortcut[]>)

  const formatKey = (s: Shortcut) => {
    const parts: string[] = []
    if (s.ctrl) parts.push('⌘')
    if (s.shift) parts.push('⇧')
    if (s.alt) parts.push('⌥')
    parts.push(s.key.toUpperCase())
    return parts.join(' + ')
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([scope, scopeShortcuts]) => (
            <div key={scope} className="mb-6 last:mb-0">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {scope === 'global' ? 'Global' : scope.charAt(0).toUpperCase() + scope.slice(1)}
              </h3>
              <div className="space-y-2">
                {scopeShortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50">
                    <span className="text-sm text-zinc-300">{s.description}</span>
                    <kbd className="px-2 py-1 rounded bg-zinc-700 text-xs font-mono text-zinc-300 border border-zinc-600">
                      {formatKey(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  )
}

// Hook for component-specific shortcuts
export function useShortcut(shortcut: Omit<Shortcut, 'action'>, action: () => void) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts()

  useEffect(() => {
    const fullShortcut: Shortcut = { ...shortcut, action }
    registerShortcut(fullShortcut)
    return () => unregisterShortcut(shortcut.key)
  }, [shortcut.key, action, registerShortcut, unregisterShortcut])
}
