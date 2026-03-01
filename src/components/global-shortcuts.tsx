'use client'

import { useEffect, useState } from 'react'
import { ResearchNoteOverlay } from '@/components/research-note-overlay'

export function GlobalShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+N = global new research note
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        // Only open if not already inside an input/textarea (those get Esc to close)
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <ResearchNoteOverlay
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  )
}
