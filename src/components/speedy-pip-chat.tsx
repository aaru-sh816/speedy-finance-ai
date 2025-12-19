"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { 
  Send, Bot, User, X, FileText, Mic, MicOff, Globe, Paperclip,
  Loader2, ChevronRight, Sparkles, MessageCircle, Maximize2, Minimize2,
  ExternalLink, Clock, GripVertical, Layers, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, BarChart3, Calculator, AlertCircle, Zap,
  Target, PieChart, ArrowUpRight, ArrowDownRight, Check, Copy,
  ThumbsUp, ThumbsDown, Volume2, VolumeX, Download, Share2, Calendar,
  IndianRupee, Percent, Hash, Upload, Image as ImageIcon
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
}

interface WebSource {
  url: string
  title: string
  domain?: string
}

interface Attachment {
  name: string
  type: string
  size: number
  url?: string
  file?: File
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: PdfCitation[]
  webSources?: WebSource[]
  suggestedQuestions?: string[]
  metrics?: ExtractedMetric[]
  attachments?: Attachment[]
  hasTable?: boolean
  hasTimeline?: boolean
  rating?: 'up' | 'down' | null
  isStreaming?: boolean
}

interface ExtractedMetric {
  label: string
  value: string
  change?: number
  type: "currency" | "percentage" | "number" | "date"
}

interface SpeedyPipChatProps {
  announcement: BSEAnnouncement
  isOpen: boolean
  onClose: () => void
  companyAnnouncements?: BSEAnnouncement[]
  preSelectedDocIds?: string[] // IDs pre-selected from Recent Announcements section
  initialMaximized?: boolean // Open directly in full-screen mode
}

const KEYWORD_TAGS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  dividend: { label: "Dividend", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  bonus: { label: "Bonus", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  split: { label: "Split", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  acquisition: { label: "Acquisition", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  merger: { label: "Merger", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  buyback: { label: "Buyback", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  "rights issue": { label: "Rights Issue", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  qip: { label: "QIP", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  fpo: { label: "FPO", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  penalty: { label: "Penalty", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  order: { label: "Order", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  sebi: { label: "SEBI", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" }
}

type KeywordTagConfig = (typeof KEYWORD_TAGS)[string]

function getKeywordTags(content: string): { key: string; config: KeywordTagConfig }[] {
  const lower = content.toLowerCase()
  const tags: { key: string; config: KeywordTagConfig }[] = []

  for (const [key, config] of Object.entries(KEYWORD_TAGS)) {
    if (lower.includes(key)) {
      tags.push({ key, config })
    }
  }

  return tags
}

// Render markdown content with Grok-style formatting
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false
  let listItems: string[] = []
  let inList = false
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-zinc-300">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>{highlightFinancialData(item)}</span>
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
    inList = false
  }
  
  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0]
      const dataRows = tableRows.slice(1).filter(row => !row.every(cell => /^[-:]+$/.test(cell.trim())))
      
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-white/10">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-300">
                      {highlightFinancialData(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
    }
    inTable = false
  }
  
  // Highlight financial data (₹, %, dates)
  const highlightFinancialData = (text: string): React.ReactNode => {
    // Match currency, percentages, and dates
    const parts = text.split(/(₹[\d,]+(?:\.\d+)?(?:\s*(?:Cr|Crore|Lakh|L|K|M|B))?|[\d.]+%|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi)
    
    return parts.map((part, i) => {
      if (/^₹/.test(part)) {
        return <span key={i} className="text-emerald-400 font-semibold">{part}</span>
      }
      if (/\d+%/.test(part)) {
        const isNegative = part.includes('-')
        return <span key={i} className={`font-semibold ${isNegative ? 'text-rose-400' : 'text-cyan-400'}`}>{part}</span>
      }
      if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(part)) {
        return <span key={i} className="text-purple-400">{part}</span>
      }
      // Bold text
      if (part.includes('**')) {
        return part.split('**').map((p, j) => 
          j % 2 === 1 ? <strong key={`${i}-${j}`} className="text-white">{p}</strong> : p
        )
      }
      return part
    })
  }
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    
    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        flushList()
        inTable = true
      }
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim())
      tableRows.push(cells)
      return
    } else if (inTable) {
      flushTable()
    }
    
    // List item
    if (/^[-•*]\s/.test(trimmed)) {
      if (!inList) inList = true
      listItems.push(trimmed.replace(/^[-•*]\s/, ''))
      return
    } else if (inList) {
      flushList()
    }
    
    // Section header ### 
    if (trimmed.startsWith('### ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2 mt-3 mb-2 pb-1 border-b border-white/10">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500" />
          <h3 className="text-[12px] font-bold text-white">{trimmed.slice(4)}</h3>
        </div>
      )
      return
    }
    
    // Subheader ##
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-[13px] font-bold text-cyan-400 mt-3 mb-1">{trimmed.slice(3)}</h2>
      )
      return
    }
    
    // Header #
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="text-[14px] font-bold text-white mt-2 mb-1">{trimmed.slice(2)}</h1>
      )
      return
    }
    
    // Horizontal rule
    if (/^[-]{3,}$/.test(trimmed)) {
      elements.push(<hr key={idx} className="my-2 border-white/10" />)
      return
    }
    
    // Empty line
    if (!trimmed) {
      elements.push(<div key={idx} className="h-1" />)
      return
    }
    
    // Regular paragraph
    elements.push(
      <p key={idx} className="text-[13px] text-zinc-300 leading-relaxed">
        {highlightFinancialData(trimmed)}
      </p>
    )
  })
  
  // Flush remaining
  flushList()
  flushTable()
  
  return <div className="space-y-1">{elements}</div>
}

// Generate context-aware follow-up questions
function generateFollowUps(response: string, asked: string[]): string[] {
  const questions: string[] = []
  const lower = response.toLowerCase()
  
  if (lower.includes("mw") || lower.includes("capacity")) {
    questions.push("Timeline?", "Investment?")
  }
  if (lower.includes("crore") || lower.includes("revenue")) {
    questions.push("YoY growth?", "Margins?")
  }
  if (lower.includes("board") || lower.includes("approved")) {
    questions.push("Next steps?", "Effective date?")
  }
  if (lower.includes("dividend")) questions.push("Record date?")
  if (lower.includes("acquisition")) questions.push("Deal value?")
  if (questions.length < 2) {
    questions.push("Key risks?", "Summary?")
  }
  return questions.filter(q => !asked.includes(q)).slice(0, 3)
}

export function SpeedyPipChat({ announcement: initialAnnouncement, isOpen, onClose, companyAnnouncements = [], preSelectedDocIds = [], initialMaximized = false }: SpeedyPipChatProps) {
  // State
  const [activeAnnouncement, setActiveAnnouncement] = useState(initialAnnouncement)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [asked, setAsked] = useState<string[]>([])
  const [showDocs, setShowDocs] = useState(false)
  const [multiDocMode, setMultiDocMode] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMaximized, setIsMaximized] = useState(initialMaximized)
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false)
  
  // PIP State
  const [isExpanded, setIsExpanded] = useState(initialMaximized || false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  
  // Refs
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  
  const storageKey = `speedy-chat-${initialAnnouncement.scripCode}`

  // Stabilize preSelectedDocIds to prevent infinite loops
  const preSelectedDocIdsKey = JSON.stringify(preSelectedDocIds)

  // Same company announcements - get ALL of them
  const sameCompanyAnnouncements = companyAnnouncements.filter(
    a => a.scripCode === activeAnnouncement.scripCode && a.id !== activeAnnouncement.id
  )

  // We do not persist chat history across sessions anymore to keep each stock/session fresh
  useEffect(() => {
    setHasHydratedHistory(true)
  }, [])

  // Update when initial changes or pre-selected docs change
  useEffect(() => {
    setActiveAnnouncement(initialAnnouncement)
    // Reset all chat state when announcement changes
    setMessages([])
    setInput("")
    setAsked([])
    setAttachments([])
    setMultiDocMode(false)
    setShowDocs(false)
    setWebSearch(false)
    
    // If pre-selected docs provided, use them; otherwise just the current one
    if (preSelectedDocIds.length > 0) {
      setSelectedDocs(preSelectedDocIds)
      setMultiDocMode(true)
      setShowDocs(true)
      setIsExpanded(true)
    } else {
      setSelectedDocs([initialAnnouncement.id])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnnouncement.id, preSelectedDocIdsKey])

  // Init chat - only trigger when opening and no existing history
  useEffect(() => {
    if (!isOpen || !activeAnnouncement) return
    if (!hasHydratedHistory) return
    if (messages.length > 0) return

    const docsCount = selectedDocs.length
    const welcomeMsg = multiDocMode && docsCount > 1
      ? `Analyzing **${docsCount} documents** from ${activeAnnouncement.company}`
      : `Analyzing **${activeAnnouncement.company}**\n\n${activeAnnouncement.headline.slice(0, 60)}...`
    
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: welcomeMsg,
      timestamp: new Date(),
      suggestedQuestions: ["Key numbers?", "Important dates?", "Summary?"]
    }])
    setAsked([])
  }, [isOpen, activeAnnouncement?.id, hasHydratedHistory, messages.length, multiDocMode, selectedDocs.length])

  // Scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus
  useEffect(() => {
    if (isOpen && isExpanded) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen, isExpanded])

  // Keyboard shortcuts - use ref to avoid onClose dependency
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        if (isMaximized) {
          setIsMaximized(false)
        } else {
          onCloseRef.current()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isMaximized])

  // Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        dragOffset.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      }
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = window.innerWidth - e.clientX - (containerRef.current?.offsetWidth || 0) + dragOffset.current.x
      const newY = window.innerHeight - e.clientY - (containerRef.current?.offsetHeight || 0) + dragOffset.current.y
      setPosition({
        x: Math.max(10, Math.min(newX, window.innerWidth - 100)),
        y: Math.max(10, Math.min(newY, window.innerHeight - 100))
      })
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Switch announcement
  const switchAnnouncement = (ann: BSEAnnouncement) => {
    // When switching to another stock/announcement, start with a clean chat
    setActiveAnnouncement(ann)
    setMultiDocMode(false)
    setSelectedDocs([ann.id])
    setMessages([])
    setShowDocs(false)
  }

  // Toggle document selection for multi-doc mode
  const toggleDocSelection = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    )
  }

  // Enable multi-doc mode - select ALL documents
  const enableMultiDocMode = () => {
    const allDocIds = [activeAnnouncement.id, ...sameCompanyAnnouncements.map(a => a.id)]
    setMultiDocMode(true)
    setSelectedDocs(allDocIds)
    setMessages([{
      id: "multi-" + Date.now(),
      role: "assistant",
      content: `🔗 **Multi-Document Mode**\n\nAnalyzing **${allDocIds.length} announcements** from **${activeAnnouncement.company}**.\n\nI can now compare, find patterns, and answer questions across all selected documents.`,
      timestamp: new Date(),
      suggestedQuestions: ["Compare all?", "Find patterns?", "Timeline of events?"]
    }])
    setShowDocs(true) // Keep docs panel open to show all selected
  }

  // Voice recording
  const toggleVoice = async () => {
    if (isRecording) {
      recorderRef.current?.stop()
      setIsRecording(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" })
          const fd = new FormData()
          fd.append("audio", blob)
          fd.append("action", "transcribe")
          try {
            const res = await fetch("/api/ai/voice", { method: "POST", body: fd })
            if (res.ok) {
              const { text } = await res.json()
              if (text) setInput(text)
            }
          } catch (e) { console.error(e) }
          stream.getTracks().forEach(t => t.stop())
        }
        recorder.start()
        setIsRecording(true)
      } catch (e) { console.error(e) }
    }
  }

  // Append assistant message in one shot (no typewriter effect)
  const appendAssistantMessage = (
    fullText: string,
    meta: Omit<ChatMessage, "id" | "role" | "content" | "timestamp">
  ) => {
    const id = (Date.now() + Math.random()).toString()
    const timestamp = new Date()

    setMessages(prev => [
      ...prev,
      {
        id,
        role: "assistant",
        content: fullText,
        timestamp,
        rating: null,
        isStreaming: false,
        ...meta
      }
    ])
  }

  // Send message
  const send = async (custom?: string) => {
    const msg = custom || input.trim()
    if (!msg || isLoading) return

    setAsked(prev => [...prev, msg])
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    }])
    setInput("")
    setAttachments([])
    setIsLoading(true)

    let webSources: WebSource[] = []
    
    try {
      let extra = ""
      if (webSearch) {
        try {
          const sr = await fetch("/api/ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: msg, company: activeAnnouncement.company, ticker: activeAnnouncement.ticker })
          })
          if (sr.ok) {
            const d = await sr.json()
            if (d.content) extra = `\n\nWeb: ${d.content}`
            // Extract web citations
            if (d.citations && Array.isArray(d.citations)) {
              webSources = d.citations.map((c: any) => ({
                url: c.url,
                title: c.title || new URL(c.url).hostname,
                domain: new URL(c.url).hostname.replace('www.', '')
              }))
            }
          }
        } catch (e) {}
      }

      // Build context message for multi-doc mode
      let contextMsg = msg + extra
      if (multiDocMode && selectedDocs.length > 1) {
        const selectedAnns = [activeAnnouncement, ...sameCompanyAnnouncements].filter(a => selectedDocs.includes(a.id))
        contextMsg = `[Multi-document query across ${selectedDocs.length} announcements]\n\n${msg}${extra}`
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextMsg,
          announcement: {
            id: activeAnnouncement.id,
            company: activeAnnouncement.company,
            ticker: activeAnnouncement.ticker,
            scripCode: activeAnnouncement.scripCode,
            headline: activeAnnouncement.headline,
            summary: activeAnnouncement.summary,
            category: activeAnnouncement.category,
            subCategory: activeAnnouncement.subCategory,
            time: activeAnnouncement.time,
            impact: activeAnnouncement.impact,
            pdfUrl: activeAnnouncement.pdfUrl
          },
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          includePdfAnalysis: true,
          multiDocMode: multiDocMode,
          selectedDocIds: selectedDocs,
        })
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.response || "Could not generate response."
        const followUps = generateFollowUps(text, asked)
        const metrics = extractMetrics(text)
        const { hasTable, hasTimeline } = detectContentType(text)

        appendAssistantMessage(text, {
          citations: data.citations,
          webSources: webSources.length > 0 ? webSources : undefined,
          suggestedQuestions: followUps,
          metrics: metrics.length > 0 ? metrics : undefined,
          hasTable,
          hasTimeline
        })
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Error. Please try again.",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments = files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      file: f
    }))
    setAttachments(prev => [...prev, ...newAttachments])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Text-to-speech
  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        return
      }
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.onend = () => setIsSpeaking(false)
      speechSynthRef.current = utterance
      window.speechSynthesis.speak(utterance)
      setIsSpeaking(true)
    }
  }

  // Detect content type for smart formatting
  const detectContentType = (content: string) => {
    const hasTable = /\|.*\|.*\|/.test(content) || /(timeline|schedule|dates|quarter)/i.test(content)
    const hasTimeline = /(timeline|roadmap|schedule|phases|milestones)/i.test(content)
    return { hasTable, hasTimeline }
  }

  // Extract metrics from response
  const extractMetrics = (content: string): ExtractedMetric[] => {
    const metrics: ExtractedMetric[] = []
    
    // Currency (₹ or Cr or crore)
    const currencyMatches = content.match(/₹?\s*([\d,]+(?:\.\d+)?)\s*(Cr|crore|crores)/gi)
    if (currencyMatches) {
      currencyMatches.slice(0, 4).forEach(match => {
        const value = match.match(/([\d,]+(?:\.\d+)?)/)?.[0] || ''
        metrics.push({ label: 'Amount', value: `₹${value} Cr`, type: 'currency' })
      })
    }
    
    // Percentages
    const percentMatches = content.match(/([\d.]+)%/g)
    if (percentMatches) {
      percentMatches.slice(0, 3).forEach(match => {
        metrics.push({ label: 'Change', value: match, type: 'percentage' })
      })
    }
    
    // Dates
    const dateMatches = content.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi)
    if (dateMatches) {
      dateMatches.slice(0, 2).forEach(match => {
        metrics.push({ label: 'Date', value: match, type: 'date' })
      })
    }
    
    return metrics
  }

  // Copy message
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleRateMessage = (id: string, rating: 'up' | 'down') => {
    setMessages(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, rating: m.rating === rating ? null : rating }
          : m
      )
    )
  }

  // Export chat
  const exportChat = () => {
    const chatText = messages.map(m => 
      `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
    ).join('\n\n')
    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${activeAnnouncement.ticker}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  // Compact PIP mode
  if (!isExpanded) {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 cursor-pointer group"
        style={{ right: position.x, bottom: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div 
          onClick={() => setIsExpanded(true)}
          className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-110 transition-all flex items-center justify-center"
        >
          {/* Animated ring */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 opacity-50 animate-ping" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600" />
          
          {/* Icon */}
          <Sparkles className="relative h-6 w-6 text-white" />
          
          {/* Badge */}
          {messages.length > 1 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
              {messages.length - 1}
            </span>
          )}
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {activeAnnouncement.ticker} • Click to expand
        </div>
      </div>
    )
  }

  // Expanded chat mode
  return (
    <div
      ref={containerRef}
      className={`fixed z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden transition-all ${
        isMaximized ? 'rounded-none' : 'rounded-2xl'
      }`}
      style={isMaximized ? {
        inset: 0,
        width: '100vw',
        height: '100vh'
      } : { 
        right: position.x, 
        bottom: position.y,
        width: '400px',
        height: '560px'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with drag handle */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div className="drag-handle cursor-move p-1 rounded hover:bg-white/5">
            <GripVertical className="h-4 w-4 text-zinc-500" />
          </div>
          
          {/* Orb Avatar */}
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 opacity-40 blur-md animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {multiDocMode ? `${selectedDocs.length} Docs` : activeAnnouncement.ticker}
            </p>
            <p className="text-[9px] text-zinc-500 truncate">{activeAnnouncement.company}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          {/* Export */}
          <button
            onClick={exportChat}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
            title="Export chat"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          
          {/* Web Search */}
          <button
            onClick={() => setWebSearch(!webSearch)}
            className={`p-1.5 rounded-lg transition-colors ${webSearch ? "text-cyan-400 bg-cyan-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
            title="Web search"
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
          
          {/* Maximize/Restore */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          
          {/* Minimize to PIP */}
          {!isMaximized && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
              title="Minimize"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
          
          {/* Close */}
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Documents Panel */}
      <div className="border-b border-white/5">
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className="w-full px-3 py-2 flex items-center justify-between text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            {sameCompanyAnnouncements.length + 1} documents available
            {multiDocMode && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[8px]">MULTI</span>}
          </span>
          {showDocs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        
        {showDocs && (
          <div className="px-2 pb-2 space-y-1 max-h-52 overflow-y-auto">
            {/* Multi-doc mode button */}
            {!multiDocMode && (
              <button
                onClick={enableMultiDocMode}
                className="w-full p-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 hover:border-cyan-500/40 text-left transition-all"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <div>
                    <p className="text-[10px] font-medium text-cyan-400">Chat with ALL {sameCompanyAnnouncements.length + 1} documents</p>
                    <p className="text-[8px] text-zinc-500">Compare & analyze across all announcements</p>
                  </div>
                </div>
              </button>
            )}
            
            {/* Multi-doc mode header */}
            {multiDocMode && (
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-1">
                <p className="text-[10px] font-medium text-purple-400">
                  ✓ {selectedDocs.length} of {sameCompanyAnnouncements.length + 1} documents selected
                </p>
                <p className="text-[8px] text-zinc-500">Click to toggle selection</p>
              </div>
            )}
            
            {/* Current document - always first */}
            <button
              onClick={() => multiDocMode && toggleDocSelection(activeAnnouncement.id)}
              className={`w-full p-2 rounded-lg text-left transition-all ${
                selectedDocs.includes(activeAnnouncement.id)
                  ? "bg-cyan-500/10 border border-cyan-500/30"
                  : "bg-white/5 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                {multiDocMode && (
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedDocs.includes(activeAnnouncement.id) ? "bg-cyan-500 border-cyan-500" : "border-zinc-600"
                  }`}>
                    {selectedDocs.includes(activeAnnouncement.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-cyan-300 truncate">{activeAnnouncement.headline.slice(0, 40)}...</p>
                  <p className="text-[8px] text-cyan-500">Current • {activeAnnouncement.category}</p>
                </div>
              </div>
            </button>
            
            {/* Other documents */}
            {sameCompanyAnnouncements.map((a, index) => (
              <button
                key={a.id}
                onClick={() => multiDocMode ? toggleDocSelection(a.id) : switchAnnouncement(a)}
                className={`w-full p-2 rounded-lg text-left transition-all ${
                  selectedDocs.includes(a.id)
                    ? "bg-purple-500/10 border border-purple-500/30"
                    : "bg-white/5 hover:bg-white/10 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  {multiDocMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedDocs.includes(a.id) ? "bg-purple-500 border-purple-500" : "border-zinc-600"
                    }`}>
                      {selectedDocs.includes(a.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-300 truncate">{a.headline.slice(0, 38)}...</p>
                    <p className="text-[8px] text-zinc-600">#{index + 2} • {a.category}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-cyan-500 to-blue-600"
            }`}>
              {m.role === "user" ? <User className="h-3 w-3 text-zinc-400" /> : <Bot className="h-3 w-3 text-white" />}
            </div>

            <div className={`max-w-[90%] ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`group relative rounded-xl px-3 py-2.5 ${m.role === "user" ? "bg-white/10" : "bg-white/5 border border-white/5"}`}>
                {/* Use markdown renderer for assistant, simple text for user */}
                {m.role === "assistant" ? (
                  renderMarkdown(m.content)
                ) : (
                  <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>
                )}
                
                {/* Copy button */}
                {m.role === "assistant" && (
                  <button 
                    onClick={() => copyMessage(m.content)}
                    className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                  >
                    <Copy className="h-3 w-3 text-zinc-500" />
                  </button>
                )}
              </div>

              {/* PDF Citations - Enhanced Display */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <FileText className="h-3 w-3 text-cyan-400" />
                    </div>
                    <span className="text-[10px] font-medium text-cyan-400">📄 Sources from PDF</span>
                  </div>
                  <div className="grid gap-1.5">
                    {m.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-cyan-400">P{c.page}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-zinc-400 line-clamp-2">{c.snippet || `Content from page ${c.page}`}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Sources - Enhanced Display */}
              {m.webSources && m.webSources.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Globe className="h-3 w-3 text-purple-400" />
                    </div>
                    <span className="text-[10px] font-medium text-purple-400">🌐 Web Sources</span>
                    <span className="text-[8px] text-zinc-600">({m.webSources.length})</span>
                  </div>
                  <div className="grid gap-1.5">
                    {m.webSources.slice(0, 5).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all"
                      >
                        <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-purple-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-purple-300 truncate font-medium">{s.title}</p>
                          <p className="text-[8px] text-zinc-600 truncate">{s.domain}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Metrics Cards */}
              {m.role === "assistant" && m.metrics && m.metrics.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {m.metrics.map((metric, i) => (
                    <div key={i} className="p-2 rounded-lg bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border border-white/10">
                      <div className="flex items-center gap-1 mb-1">
                        {metric.type === 'currency' && <IndianRupee className="h-3 w-3 text-emerald-400" />}
                        {metric.type === 'percentage' && <Percent className="h-3 w-3 text-cyan-400" />}
                        {metric.type === 'date' && <Calendar className="h-3 w-3 text-purple-400" />}
                        {metric.type === 'number' && <Hash className="h-3 w-3 text-blue-400" />}
                        <span className="text-[8px] text-zinc-500">{metric.label}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-white">{metric.value}</p>
                      {metric.change !== undefined && (
                        <div className={`flex items-center gap-0.5 mt-0.5 text-[8px] ${
                          metric.change > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {metric.change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {Math.abs(metric.change)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Keyword Tags */}
              {m.role === "assistant" && getKeywordTags(m.content).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getKeywordTags(m.content).map(({ key, config }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${config.bg} ${config.border} ${config.color}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{config.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* User Attachments */}
              {m.role === "user" && m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {m.attachments.map((att, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[9px] text-zinc-300">
                      {att.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate max-w-[100px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* TTS Button for Assistant Messages */}
              {m.role === "assistant" && (
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => speakMessage(m.content)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all ${
                      isSpeaking ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                    title={isSpeaking ? "Stop speaking" : "Listen to response"}
                  >
                    {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    {isSpeaking ? 'Speaking...' : 'Listen'}
                  </button>
                </div>
              )}

              {/* Message Rating */}
              {m.role === "assistant" && !m.isStreaming && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <span>Was this helpful?</span>
                  <button
                    onClick={() => handleRateMessage(m.id, 'up')}
                    className={`p-1 rounded-full border flex items-center justify-center ${
                      m.rating === 'up'
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'border-transparent hover:bg-white/5 hover:text-emerald-300'
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleRateMessage(m.id, 'down')}
                    className={`p-1 rounded-full border flex items-center justify-center ${
                      m.rating === 'down'
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                        : 'border-transparent hover:bg-white/5 hover:text-rose-300'
                    }`}
                    title="Not helpful"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Follow-up Questions */}
              {m.role === "assistant" && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {m.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(q)}
                      disabled={isLoading}
                      className="group/btn inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-zinc-400 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all disabled:opacity-50"
                    >
                      <ChevronRight className="h-2 w-2 text-cyan-500 opacity-0 group-hover/btn:opacity-100" />
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Loader2 className="h-3 w-3 text-white animate-spin" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5 flex gap-2 overflow-x-auto">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
              {att.type.startsWith('image/') ? <ImageIcon className="h-3 w-3 text-purple-400" /> : <FileText className="h-3 w-3 text-purple-400" />}
              <span className="text-[9px] text-purple-300 max-w-[80px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-zinc-500 hover:text-white">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-2.5 border-t border-white/5 bg-zinc-900/30">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 focus-within:border-cyan-500/30 transition-colors">
          {/* File Attach Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-zinc-500 hover:text-purple-400 hover:bg-white/5 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything..."
            className="flex-1 px-2.5 py-2 bg-transparent text-white text-[11px] placeholder:text-zinc-500 outline-none"
            disabled={isLoading}
          />
          
          <button
            onClick={toggleVoice}
            className={`p-1.5 rounded-lg transition-colors ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
          >
            {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          
          <button
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-30 hover:opacity-90"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* Status */}
        <div className="flex items-center justify-center gap-2 mt-1.5">
          {webSearch && (
            <span className="text-[8px] text-cyan-400 flex items-center gap-0.5">
              <Globe className="h-2 w-2" /> Web
            </span>
          )}
          {multiDocMode && (
            <span className="text-[8px] text-purple-400 flex items-center gap-0.5">
              <Layers className="h-2 w-2" /> {selectedDocs.length} docs
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
