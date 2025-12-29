"use client"

import { useState, useRef, useEffect } from "react"
import { FileText, ExternalLink, X, ChevronLeft, ChevronRight, Maximize2, Copy, Check } from "lucide-react"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
  docId?: string
  headline?: string
  score?: number
}

interface CitationPopoverProps {
  citation: PdfCitation
  onClose?: () => void
}

export function CitationPopover({ citation, onClose }: CitationPopoverProps) {
  const [copied, setCopied] = useState(false)
  
  const copySnippet = () => {
    navigator.clipboard.writeText(citation.snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <span className="text-sm font-bold text-cyan-400">P{citation.page}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {citation.headline ? citation.headline.slice(0, 50) + "..." : `Page ${citation.page}`}
              </h3>
              <p className="text-[10px] text-zinc-500">
                {citation.score ? `${(citation.score * 100).toFixed(0)}% relevance` : "PDF Citation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={copySnippet}
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Copy snippet"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <a
              href={citation.openUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-cyan-400 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
            <blockquote className="pl-4 text-sm text-zinc-300 leading-relaxed italic border-l-0">
              "{citation.snippet}"
            </blockquote>
          </div>
          
          <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <p className="text-xs text-cyan-400">
              This excerpt was extracted from Page {citation.page} of the PDF document.
              Click "Open in new tab" to view the full page context.
            </p>
          </div>
        </div>
        
        <div className="px-4 py-3 border-t border-white/10 bg-zinc-900/30 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">Source: BSE Corporate Filing</span>
          <a
            href={citation.openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            View Full PDF Page
          </a>
        </div>
      </div>
    </div>
  )
}

interface CitationCardProps {
  citation: PdfCitation
  index: number
  multiDocMode?: boolean
}

export function CitationCard({ citation, index, multiDocMode = false }: CitationCardProps) {
  const [showPopover, setShowPopover] = useState(false)
  
  return (
    <>
      <button
        onClick={() => setShowPopover(true)}
        className="group flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all text-left w-full"
      >
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-cyan-400">P{citation.page}</span>
        </div>
        <div className="flex-1 min-w-0">
          {multiDocMode && citation.headline && (
            <p className="text-[10px] text-cyan-500 font-medium mb-1 truncate">
              {citation.headline}...
            </p>
          )}
          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-normal">
            {citation.snippet || `Content from page ${citation.page}`}
          </p>
          {citation.score && (
            <p className="text-[9px] text-zinc-600 mt-1">
              {(citation.score * 100).toFixed(0)}% relevance
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      </button>
      
      {showPopover && (
        <CitationPopover citation={citation} onClose={() => setShowPopover(false)} />
      )}
    </>
  )
}

interface CitationGridProps {
  citations: PdfCitation[]
  multiDocMode?: boolean
}

export function CitationGrid({ citations, multiDocMode = false }: CitationGridProps) {
  if (!citations || citations.length === 0) return null
  
  return (
    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <FileText className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <span className="text-xs font-medium text-cyan-400">
          Sources from PDF{multiDocMode && citations.some(c => c.headline) ? 's' : ''} ({citations.length})
        </span>
      </div>
      <div className="grid gap-2">
        {citations.map((c, i) => (
          <CitationCard key={i} citation={c} index={i} multiDocMode={multiDocMode} />
        ))}
      </div>
    </div>
  )
}
