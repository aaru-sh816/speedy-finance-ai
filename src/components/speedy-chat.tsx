"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Send, Bot, User, X, FileText, Mic, MicOff, Globe, Paperclip,
  Loader2, ChevronRight, Sparkles, MessageCircle, PanelRightOpen, 
  PanelRightClose, ExternalLink, Clock, ArrowRight, Volume2, VolumeX
} from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
}

interface Attachment {
  name: string
  type: string
  size: number
  file: File
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: PdfCitation[]
  suggestedQuestions?: string[]
  attachments?: Attachment[]
}

interface SpeedyChatProps {
  announcement: BSEAnnouncement
  isOpen: boolean
  onClose: () => void
  mode?: "popup" | "sidebar"
  companyAnnouncements?: BSEAnnouncement[]
}

// Generate context-aware follow-up questions
function generateFollowUps(
  response: string, 
  announcement: BSEAnnouncement,
  asked: string[]
): string[] {
  const questions: string[] = []
  const lower = response.toLowerCase()
  const category = (announcement.category || "").toLowerCase()
  
  if (lower.includes("mw") || lower.includes("capacity")) {
    questions.push("Project timeline?")
    questions.push("Investment amount?")
  }
  if (lower.includes("crore") || lower.includes("revenue") || lower.includes("profit")) {
    questions.push("Compare to last quarter?")
    questions.push("YoY growth?")
  }
  if (lower.includes("board") || lower.includes("approved")) {
    questions.push("Next steps?")
    questions.push("Effective date?")
  }
  if (lower.includes("acquisition") || lower.includes("merger")) {
    questions.push("Deal value?")
  }
  if (lower.includes("dividend") || lower.includes("bonus")) {
    questions.push("Record date?")
  }
  if (category.includes("result") && !asked.some(q => q.includes("EPS"))) {
    questions.push("EPS?")
  }
  if (category.includes("result") && !asked.some(q => q.includes("margin"))) {
    questions.push("Margins?")
  }
  if (questions.length < 2) {
    if (!asked.some(q => q.includes("risk"))) questions.push("Risks?")
    if (!asked.some(q => q.includes("summar"))) questions.push("Summary?")
  }
  
  return questions
    .filter(q => !asked.some(a => a.toLowerCase().includes(q.toLowerCase().slice(0, 6))))
    .slice(0, 3)
}

export function SpeedyChat({ 
  announcement: initialAnnouncement, 
  isOpen, 
  onClose, 
  mode = "popup",
  companyAnnouncements = []
}: SpeedyChatProps) {
  const [activeAnnouncement, setActiveAnnouncement] = useState(initialAnnouncement)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [currentMode, setCurrentMode] = useState(mode)
  const [asked, setAsked] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Filter to SAME company only
  const sameCompanyAnnouncements = companyAnnouncements.filter(
    a => a.scripCode === activeAnnouncement.scripCode && a.id !== activeAnnouncement.id
  ).slice(0, 6)

  // Update active announcement when initial changes
  useEffect(() => {
    setActiveAnnouncement(initialAnnouncement)
  }, [initialAnnouncement.id])

  // Init chat when announcement changes
  useEffect(() => {
    if (isOpen && activeAnnouncement) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Analyzing **${activeAnnouncement.company}**\n\n${activeAnnouncement.headline.slice(0, 80)}...`,
        timestamp: new Date(),
        suggestedQuestions: ["Key numbers?", "Important dates?", "Summarize"]
      }])
      setAsked([])
      setAttachments([])
      setCurrentMode(mode)
    }
  }, [isOpen, activeAnnouncement?.id, mode])

  // Switch to different announcement
  const switchAnnouncement = (ann: BSEAnnouncement) => {
    setActiveAnnouncement(ann)
    setMessages([{
      id: "switch-" + Date.now(),
      role: "assistant",
      content: `Switched to **${ann.company}**\n\n${ann.headline.slice(0, 80)}...`,
      timestamp: new Date(),
      suggestedQuestions: ["Key numbers?", "Compare with previous?", "Summarize"]
    }])
    setAsked([])
    setAttachments([])
    setShowRecent(false)
  }

  // Handle file attachment
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

  // Scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  // Voice
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

  // Send
  const send = async (custom?: string) => {
    const msg = custom || input.trim()
    if (!msg || isLoading) return

    setAsked(prev => [...prev, msg])
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date()
    }])
    setInput("")
    setIsLoading(true)

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
          }
        } catch (e) {}
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg + extra,
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
        })
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.response || "Could not generate response."
        const followUps = generateFollowUps(text, activeAnnouncement, asked)
        
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: text,
          timestamp: new Date(),
          citations: data.citations,
          suggestedQuestions: followUps
        }])
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

  if (!isOpen) return null

  const isSidebar = currentMode === "sidebar"

  return (
    <>
      {/* Backdrop for popup */}
      {!isSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      )}
      
      <div className={`fixed z-50 flex flex-col bg-zinc-950 ${
        isSidebar 
          ? "right-0 top-0 h-full w-80 border-l border-white/10" 
          : "bottom-4 right-4 w-[380px] h-[540px] rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
      }`}>
        
        {/* Header - Minimal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            {/* Orb */}
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 opacity-40 blur-md animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-white">{activeAnnouncement.ticker}</p>
              <p className="text-[9px] text-zinc-500 truncate max-w-[140px]">{activeAnnouncement.company}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentMode(isSidebar ? "popup" : "sidebar")}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"
              title={isSidebar ? "Popup" : "Sidebar"}
            >
              {isSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setWebSearch(!webSearch)}
              className={`p-1.5 rounded-lg ${webSearch ? "text-cyan-400 bg-cyan-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
              title="Web search"
            >
              <Globe className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Same Company Recent Announcements - Clickable */}
        {sameCompanyAnnouncements.length > 0 && (
          <div className="border-b border-white/5">
            <button 
              onClick={() => setShowRecent(!showRecent)}
              className="w-full px-3 py-2 flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {sameCompanyAnnouncements.length} more from {activeAnnouncement.company.split(' ')[0]}
              </span>
              <ChevronRight className={`h-3 w-3 transition-transform ${showRecent ? 'rotate-90' : ''}`} />
            </button>
            
            {showRecent && (
              <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
                {sameCompanyAnnouncements.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => switchAnnouncement(a)}
                    className="w-full p-2 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 text-left transition-all group"
                  >
                    <p className="text-[10px] text-zinc-300 group-hover:text-white truncate">{a.headline.slice(0, 50)}...</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">{a.category}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-cyan-500 to-blue-600"
              }`}>
                {m.role === "user" ? <User className="h-3 w-3 text-zinc-400" /> : <Bot className="h-3 w-3 text-white" />}
              </div>

              <div className={`max-w-[85%] ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`rounded-xl px-3 py-2 ${m.role === "user" ? "bg-white/10" : "bg-white/5"}`}>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {m.content.split('**').map((p, i) => 
                      i % 2 === 1 ? <strong key={i} className="text-white">{p}</strong> : p
                    )}
                  </p>
                </div>

                {/* Citations */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-1.5 flex gap-1 flex-wrap">
                    {m.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/10 text-[9px] text-cyan-400 hover:bg-cyan-500/20"
                      >
                        <FileText className="h-2 w-2" /> p.{c.page}
                      </a>
                    ))}
                  </div>
                )}

                {/* Dynamic Follow-up Questions */}
                {m.role === "assistant" && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {m.suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => send(q)}
                        disabled={isLoading}
                        className="group inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-400 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all disabled:opacity-50"
                      >
                        <ChevronRight className="h-2.5 w-2.5 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <div className="px-3 py-2 rounded-xl bg-white/5 text-xs text-zinc-500">
                Thinking...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-3 py-2 border-t border-white/5 flex gap-2 overflow-x-auto">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                <FileText className="h-3 w-3 text-cyan-400" />
                <span className="text-[9px] text-cyan-300 max-w-[80px] truncate">{att.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-zinc-500 hover:text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input - Premium Minimal */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 focus-within:border-cyan-500/30 transition-colors">
            {/* Attach */}
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              title="Attach file"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
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
              className="flex-1 px-2 py-2 bg-transparent text-white text-xs placeholder:text-zinc-500 outline-none"
              disabled={isLoading}
            />
            
            {/* Voice */}
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-lg transition-colors ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
              title={isRecording ? "Stop" : "Voice input"}
            >
              {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            
            {/* Send */}
            <button
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          
          {/* Status Bar */}
          <div className="flex items-center justify-center gap-3 mt-2">
            {webSearch && (
              <span className="text-[8px] text-cyan-400 flex items-center gap-1">
                <Globe className="h-2 w-2" /> Web
              </span>
            )}
            {attachments.length > 0 && (
              <span className="text-[8px] text-purple-400 flex items-center gap-1">
                <Paperclip className="h-2 w-2" /> {attachments.length} file{attachments.length > 1 ? 's' : ''}
              </span>
            )}
            {activeAnnouncement.pdfUrl && (
              <a 
                href={activeAnnouncement.pdfUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-[8px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="h-2 w-2" /> PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Floating Button
export function SpeedyChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 transition-all"
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  )
}
