"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { 
  Send, Sparkles, Bot, User, X, MessageSquare, FileText, 
  Plus, ChevronDown, Zap, Brain, Shield, TrendingUp,
  Upload, Paperclip, Image, File, Check, Clock, Search,
  Building2, ArrowRight, Star, Layers, Activity, Volume2,
  VolumeX, Mic, MicOff, Globe, Download, Copy, ExternalLink,
  ChevronLeft, ChevronRight, Loader2, Play, Pause, RefreshCw
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
  score?: number
}

interface WebCitation {
  url: string
  title: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: PdfCitation[]
  webCitations?: WebCitation[]
  pdfUrl?: string | null
  attachments?: { name: string; type: string; url?: string }[]
  isSearching?: boolean
  isReading?: boolean
  audioUrl?: string
}

interface SelectedDocument {
  id: string
  name: string
  company: string
  pdfUrl: string
  type: "announcement" | "upload"
  ticker?: string
}

interface SpeedyAIChatProps {
  announcement: BSEAnnouncement
  isOpen: boolean
  onClose: () => void
  recentAnnouncements?: BSEAnnouncement[]
}

export function SpeedyAIChat({ announcement, isOpen, onClose, recentAnnouncements = [] }: SpeedyAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocument[]>([])
  const [showDocPanel, setShowDocPanel] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [showWebSearch, setShowWebSearch] = useState(false)
  const [stockPrice, setStockPrice] = useState<{ price: number; change: number } | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize with current announcement
  useEffect(() => {
    if (isOpen && announcement) {
      setSelectedDocs([{
        id: announcement.id,
        name: announcement.headline.slice(0, 50) + "...",
        company: announcement.company,
        pdfUrl: announcement.pdfUrl || "",
        type: "announcement",
        ticker: announcement.ticker
      }])
      
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `# 🚀 Speedy AI - Financial Intelligence

Welcome! I'm your **AI-powered financial analyst** for **${announcement.company}**.

## What I Can Do:
- 📄 **Read & analyze PDFs** with page-level citations
- 🌐 **Search the web** for latest news & market data
- 🎤 **Voice interaction** - speak to me or listen to responses
- 📊 **Extract key metrics** instantly from documents
- 🔄 **Compare multiple announcements** side by side

## Current Context:
- **Document**: ${announcement.headline.slice(0, 60)}...
- **Category**: ${announcement.category}
${announcement.pdfUrl ? "- **PDF**: Ready for analysis ✅" : "- **PDF**: Not available"}

**Ask me anything about this announcement or the company!**`,
        timestamp: new Date()
      }])
      
      // Fetch stock price
      fetchStockPrice(announcement.ticker)
    }
  }, [isOpen, announcement?.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch stock price
  const fetchStockPrice = async (ticker: string) => {
    try {
      const res = await fetch(`/api/bse/quote?symbol=${ticker}`)
      if (res.ok) {
        const data = await res.json()
        if (data.price) {
          setStockPrice({ price: data.price, change: data.change || 0 })
        }
      }
    } catch (e) {
      console.error("Failed to fetch stock price:", e)
    }
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (e) {
      console.error("Failed to start recording:", e)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)
      formData.append("action", "transcribe")

      const res = await fetch("/api/ai/voice", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.text) {
          setInput(data.text)
          inputRef.current?.focus()
        }
      }
    } catch (e) {
      console.error("Transcription failed:", e)
    }
  }

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true)
      const formData = new FormData()
      formData.append("action", "speak")
      formData.append("text", text.slice(0, 4000)) // TTS limit
      formData.append("voice", "nova")

      const res = await fetch("/api/ai/voice", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.audio) {
          const audioSrc = `data:audio/mp3;base64,${data.audio}`
          if (audioRef.current) {
            audioRef.current.src = audioSrc
            audioRef.current.play()
          }
        }
      }
    } catch (e) {
      console.error("TTS failed:", e)
    } finally {
      setIsSpeaking(false)
    }
  }

  // Web search
  const performWebSearch = async (query: string) => {
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          company: announcement.company,
          ticker: announcement.ticker,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return {
          content: data.content,
          citations: data.citations,
        }
      }
    } catch (e) {
      console.error("Web search failed:", e)
    }
    return null
  }

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      attachments: uploadedFiles.map(f => ({ name: f.name, type: f.type })),
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input.trim()
    setInput("")
    setUploadedFiles([])
    setIsLoading(true)

    // Check if user wants web search
    const wantsSearch = showWebSearch || 
      currentInput.toLowerCase().includes("latest") ||
      currentInput.toLowerCase().includes("news") ||
      currentInput.toLowerCase().includes("today") ||
      currentInput.toLowerCase().includes("current price")

    try {
      let webSearchResult = null
      
      // Add thinking message
      const thinkingId = Date.now().toString() + "-thinking"
      setMessages(prev => [...prev, {
        id: thinkingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isSearching: wantsSearch,
        isReading: !wantsSearch && !!announcement.pdfUrl,
      }])

      // Perform web search if needed
      if (wantsSearch) {
        webSearchResult = await performWebSearch(currentInput)
      }

      // Call main chat API with enhanced context
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput + (webSearchResult ? `\n\nWeb Search Results:\n${webSearchResult.content}` : ""),
          announcement: {
            id: announcement.id,
            company: announcement.company,
            ticker: announcement.ticker,
            scripCode: announcement.scripCode,
            headline: announcement.headline,
            summary: announcement.summary,
            category: announcement.category,
            subCategory: announcement.subCategory,
            time: announcement.time,
            impact: announcement.impact,
            pdfUrl: announcement.pdfUrl
          },
          history: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          })),
          includePdfAnalysis: true,
          includeRelatedAnnouncements: true,
          includeMarketDynamics: true, // New flag for backend to fetch bulk deals/corp actions
        })
      })

      // Remove thinking message
      setMessages(prev => prev.filter(m => m.id !== thinkingId))

      if (response.ok) {
        const data = await response.json()
        
        // Add stock price to response if relevant
        let enhancedContent = data.response || "I couldn't generate a response."
        if (stockPrice && (currentInput.toLowerCase().includes("price") || currentInput.toLowerCase().includes("stock"))) {
          enhancedContent += `\n\n📊 **Live Stock Data**: ${announcement.ticker} ₹${stockPrice.price.toFixed(2)} (${stockPrice.change >= 0 ? "+" : ""}${stockPrice.change.toFixed(2)}%)`
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: enhancedContent,
          timestamp: new Date(),
          citations: Array.isArray(data.citations) ? data.citations : undefined,
          webCitations: webSearchResult?.citations,
          pdfUrl: data.pdfUrl || announcement.pdfUrl,
        }
        setMessages(prev => [...prev, assistantMessage])

        // Auto-speak if enabled
        if (autoSpeak) {
          speakText(data.response)
        }
      } else {
        throw new Error("Failed to get response")
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => !m.isSearching && !m.isReading))
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ I encountered an error. Please try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Quick actions
  const quickActions = [
    { label: "📊 Key Numbers", query: "List all key numbers, amounts and percentages from this PDF" },
    { label: "📅 Important Dates", query: "What are all the important dates mentioned in this document?" },
    { label: "🏢 Company Details", query: "What company information and details are mentioned?" },
    { label: "⚖️ Regulatory Info", query: "What regulatory or compliance information is in this document?" },
    { label: "🌐 Latest News", query: "What is the latest news about this company?" },
  ]

  // Add document
  const addDocument = (ann: BSEAnnouncement) => {
    if (!selectedDocs.find(d => d.id === ann.id)) {
      setSelectedDocs(prev => [...prev, {
        id: ann.id,
        name: ann.headline.slice(0, 50) + "...",
        company: ann.company,
        pdfUrl: ann.pdfUrl || "",
        type: "announcement",
        ticker: ann.ticker
      }])
    }
  }

  const removeDocument = (id: string) => {
    setSelectedDocs(prev => prev.filter(d => d.id !== id))
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} />
      
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      {/* Main Container */}
      <div className="relative z-10 w-full h-full flex">
        
        {/* Document Sidebar */}
        <div className={`${showDocPanel ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden bg-zinc-950/80 border-r border-white/5`}>
          <div className="h-full flex flex-col p-4">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                Documents
              </h3>
              <span className="text-xs text-zinc-500">{selectedDocs.length} active</span>
            </div>

            {/* Selected Documents */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {selectedDocs.map((doc, idx) => (
                <div 
                  key={doc.id}
                  className="group p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{doc.company}</p>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{doc.name}</p>
                    </div>
                    <button 
                      onClick={() => removeDocument(doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                    >
                      <X className="h-3 w-3 text-zinc-400" />
                    </button>
                  </div>
                  {doc.pdfUrl && (
                    <a 
                      href={doc.pdfUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      <FileText className="h-3 w-3" />
                      <span>View PDF</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Add from Recent */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Recent Announcements</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {recentAnnouncements.slice(0, 5).map((ann) => (
                  <button
                    key={ann.id}
                    onClick={() => addDocument(ann)}
                    disabled={selectedDocs.some(d => d.id === ann.id)}
                    className="w-full p-2 text-left rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <p className="text-[10px] text-zinc-300 truncate">{ann.company}</p>
                    <p className="text-[9px] text-zinc-500 truncate">{ann.headline.slice(0, 40)}...</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex items-center justify-center gap-2 text-zinc-400 hover:text-cyan-400"
            >
              <Upload className="h-4 w-4" />
              <span className="text-xs">Upload PDF</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setShowDocPanel(!showDocPanel)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-zinc-800 border border-white/10 rounded-r-lg hover:bg-zinc-700 transition-all"
          style={{ left: showDocPanel ? "288px" : "0" }}
        >
          {showDocPanel ? <ChevronLeft className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
        </button>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40">
            <div className="flex items-center gap-4">
              {/* AI Avatar */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-purple-500/30">
                  <div className="w-full h-full rounded-2xl bg-zinc-900 flex items-center justify-center">
                    <Brain className="h-7 w-7 text-cyan-400" />
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </span>
              </div>
              
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Speedy AI
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-[10px] text-cyan-400 font-medium">
                    PRO
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-emerald-400" />
                    Data-Verified
                  </span>
                  <span>•</span>
                  <span>{announcement.ticker}</span>
                  {stockPrice && (
                    <>
                      <span>•</span>
                      <span className={`flex items-center gap-1 ${stockPrice.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        <TrendingUp className="h-3 w-3" />
                        ₹{stockPrice.price.toFixed(2)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* Voice Toggle */}
              <button
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={`p-2.5 rounded-xl transition-all ${autoSpeak ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                title={autoSpeak ? "Auto-speak ON" : "Auto-speak OFF"}
              >
                {autoSpeak ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
              
              {/* Web Search Toggle */}
              <button
                onClick={() => setShowWebSearch(!showWebSearch)}
                className={`p-2.5 rounded-xl transition-all ${showWebSearch ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                title={showWebSearch ? "Web Search ON" : "Web Search OFF"}
              >
                <Globe className="h-5 w-5" />
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user" 
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
                    : "bg-gradient-to-br from-purple-500 to-pink-600"
                } shadow-lg`}>
                  {msg.role === "user" ? (
                    <User className="h-5 w-5 text-white" />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`max-w-[75%] ${msg.role === "user" ? "text-right" : ""}`}>
                  {/* Loading State */}
                  {(msg.isSearching || msg.isReading) && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                      <span className="text-sm text-zinc-300">
                        {msg.isSearching ? "Searching the web..." : "Reading PDF document..."}
                      </span>
                    </div>
                  )}

                  {/* Regular Message */}
                  {!msg.isSearching && !msg.isReading && (
                    <>
                      <div className={`rounded-2xl px-5 py-4 ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                          : "bg-white/5 border border-white/10"
                      }`}>
                        <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none">
                          {msg.content.split('\n').map((line, i) => {
                            if (line.startsWith('# ')) {
                              return <h1 key={i} className="text-xl font-bold text-white mt-2 mb-3">{line.slice(2)}</h1>
                            }
                            if (line.startsWith('## ')) {
                              return <h2 key={i} className="text-lg font-semibold text-cyan-400 mt-3 mb-2">{line.slice(3)}</h2>
                            }
                            if (line.startsWith('- **')) {
                              const parts = line.slice(2).split('**')
                              return <p key={i} className="text-sm my-1">• <strong className="text-white">{parts[1]}</strong>{parts[2]}</p>
                            }
                            if (line.startsWith('- ')) {
                              return <p key={i} className="text-sm my-1">• {line.slice(2)}</p>
                            }
                            if (line.includes('**')) {
                              const parts = line.split('**')
                              return <p key={i} className="my-1">{parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part)}</p>
                            }
                            return line ? <p key={i} className="my-1">{line}</p> : <br key={i} />
                          })}
                        </div>

                        {/* PDF Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              PDF Sources
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.citations.map((c, idx) => (
                                <a
                                  key={idx}
                                  href={c.openUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all"
                                >
                                  <span className="text-[10px] text-cyan-400 font-medium">Page {c.page}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Web Citations */}
                        {msg.webCitations && msg.webCitations.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              Web Sources
                            </p>
                            <div className="space-y-1">
                              {msg.webCitations.slice(0, 3).map((c, idx) => (
                                <a
                                  key={idx}
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-[11px] text-purple-400 hover:text-purple-300"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate">{c.title || c.url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Message Actions */}
                      {msg.role === "assistant" && !msg.isSearching && !msg.isReading && (
                        <div className="flex items-center gap-2 mt-2 px-2">
                          <button
                            onClick={() => copyToClipboard(msg.content)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => speakText(msg.content)}
                            disabled={isSpeaking}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all disabled:opacity-50"
                            title="Listen"
                          >
                            {isSpeaking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                          <span className="text-[10px] text-zinc-600">
                            {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && !messages.some(m => m.isSearching || m.isReading) && (
              <div className="flex gap-4 animate-in fade-in">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-zinc-400">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="px-6 py-3 border-t border-white/5 flex gap-2 overflow-x-auto scrollbar-hide">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInput(action.query)
                    inputRef.current?.focus()
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/10 hover:border-cyan-500/30 whitespace-nowrap transition-all"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className="px-6 py-2 border-t border-white/5 flex gap-2 overflow-x-auto">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <File className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-300 max-w-[100px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="text-zinc-400 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/40">
            <div className="flex items-end gap-3">
              {/* Attach Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Ask anything about this announcement..."
                  rows={1}
                  className="w-full px-5 py-3.5 pr-24 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                  disabled={isLoading}
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {/* Voice Input */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-xl transition-all ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
                    title={isRecording ? "Stop recording" : "Voice input"}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  
                  {/* Send */}
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 px-2">
              <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  GPT-4o Powered
                </span>
                {showWebSearch && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Globe className="h-3 w-3" />
                    Web Search Active
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-600">
                Speedy Finance AI • Press Enter to send
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export the chat button component
export function SpeedyAIChatButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-semibold shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] transition-all overflow-hidden ${className}`}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <Brain className="h-5 w-5" />
        </div>
        <span>Chat with Speedy AI</span>
        <Sparkles className="h-4 w-4 opacity-70 group-hover:opacity-100 animate-pulse" />
      </div>
    </button>
  )
}
