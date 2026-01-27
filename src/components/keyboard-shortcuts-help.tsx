'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Keyboard, 
  Command,
  Star,
  Search,
  FileText,
  BarChart3,
  Home,
  ArrowUp,
  ArrowDown,
  CornerDownLeft
} from 'lucide-react'

interface ShortcutGroup {
  title: string
  shortcuts: Array<{
    keys: string[]
    description: string
    icon?: React.ReactNode
  }>
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette', icon: <Search className="h-3.5 w-3.5" /> },
      { keys: ['W'], description: 'Toggle watchlist panel', icon: <Star className="h-3.5 w-3.5" /> },
      { keys: ['H'], description: 'Go to home', icon: <Home className="h-3.5 w-3.5" /> },
      { keys: ['?'], description: 'Show keyboard shortcuts', icon: <Keyboard className="h-3.5 w-3.5" /> },
    ]
  },
  {
    title: 'Watchlist',
    shortcuts: [
      { keys: ['S'], description: 'Add current stock to watchlist' },
      { keys: ['N'], description: 'Add note to current stock', icon: <FileText className="h-3.5 w-3.5" /> },
      { keys: ['C'], description: 'Compare stocks' },
    ]
  },
  {
    title: 'Command Palette',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate results' },
      { keys: ['Enter'], description: 'Select item', icon: <CornerDownLeft className="h-3.5 w-3.5" /> },
      { keys: ['Esc'], description: 'Close palette' },
    ]
  },
  {
    title: 'Quick Actions',
    shortcuts: [
      { keys: ['B'], description: 'Go to bulk deals', icon: <BarChart3 className="h-3.5 w-3.5" /> },
      { keys: ['M'], description: 'Go to market overview' },
      { keys: ['R'], description: 'Refresh current page' },
    ]
  }
]

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Keyboard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
                <p className="text-xs text-zinc-500">Navigate like a pro</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
            {shortcutGroups.map((group, i) => (
              <div key={i} className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, j) => (
                    <div 
                      key={j} 
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {shortcut.icon && (
                          <span className="text-zinc-500">{shortcut.icon}</span>
                        )}
                        <span className="text-sm text-zinc-300">{shortcut.description}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, k) => (
                          <span key={k}>
                            <kbd className="px-2 py-1 rounded-lg bg-zinc-700 border border-zinc-600 text-xs text-zinc-300 font-mono shadow-sm">
                              {key}
                            </kbd>
                            {k < shortcut.keys.length - 1 && (
                              <span className="text-zinc-600 mx-0.5">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <p className="text-xs text-zinc-500 flex items-center gap-2">
              Press <kbd className="px-2 py-0.5 rounded bg-zinc-800 font-mono">?</kbd> anytime to toggle this help
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Small hint button that shows in corner
export function KeyboardShortcutsHint() {
  return (
    <div className="fixed bottom-6 right-6 z-30">
      <button
        onClick={() => {
          const event = new KeyboardEvent('keydown', { key: '?' })
          window.dispatchEvent(event)
        }}
        className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 hover:border-amber-500/50 shadow-lg transition-all"
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-4 w-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 font-mono group-hover:text-amber-400 transition-colors">?</kbd>
      </button>
    </div>
  )
}
