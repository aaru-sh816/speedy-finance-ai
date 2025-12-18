"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, Bot, User, Loader2, X, MessageSquare, Mic, MicOff, FileText } from "lucide-react"
import type { BSEAnnouncement } from "@/lib/bse/types"

interface PdfCitation {
  page: number
  snippet: string
  openUrl: string
  score?: number
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: PdfCitation[]
  pdfUrl?: string | null
}

interface ChatPanelProps {
  announcement: BSEAnnouncement
  isOpen: boolean
  onClose: () => void
}

export function ChatPanel({ announcement, isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset messages when announcement changes
  useEffect(() => {
    if (isOpen) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `👋 Hello! I'm Speedy AI, your data-first assistant for the **${announcement.company}** announcement.\n\nI work strictly with the information available in the announcement and its PDF.\n\nI can help you:\n• Extract key facts, numbers, dates and names directly from the document\n• Tell you whether specific information is present or not in the provided data\n• Highlight important clauses, conditions and disclosures from the text\n• Show you which PDF page each fact is sourced from\n\nAsk me anything about what is written in this announcement or its PDF.`,
        timestamp: new Date()
      }])
    }
  }, [isOpen, announcement.id])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
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
        })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "I apologize, but I couldn't generate a response. Please try again.",
          timestamp: new Date(),
          citations: Array.isArray(data.citations) ? data.citations : undefined,
          pdfUrl: typeof data.pdfUrl === "string" || data.pdfUrl === null ? data.pdfUrl : announcement.pdfUrl,
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error("Failed to get response")
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "❌ I encountered an error. Please ensure your OpenAI API key is configured in `.env.local` and try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Quick suggestions
  const suggestions = [
    "List all key numbers and dates mentioned in this PDF.",
    "What project names and locations are mentioned in the document?",
    "Is there any information about capacity (MW) in the PDF?",
    "Is anything about regulatory approvals specified in the announcement/PDF?"
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Chat Panel */}
      <div className="relative z-10 w-full max-w-2xl h-[85vh] max-h-[700px] flex flex-col glass-card rounded-3xl overflow-hidden shadow-2xl shadow-cyan-500/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-bold text-white text-lg">Speedy AI Chat</h3>
                <p className="text-xs text-zinc-400">{announcement.ticker} • {announcement.category}</p>
              </div>
              {announcement.pdfUrl && (
                <a
                  href={announcement.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] text-zinc-100 hover:bg-white/20 hover:border-cyan-400/60 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  <span>Open PDF</span>
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Announcement Context */}
        <div className="px-5 py-3 border-b border-white/5 bg-gradient-to-r from-cyan-500/5 to-transparent">
          <p className="text-sm text-zinc-300 line-clamp-2 font-medium">{announcement.headline}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                msg.role === "user" 
                  ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/20" 
                  : "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20"
              }`}>
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 text-cyan-50"
                    : "bg-white/5 border border-white/5 text-zinc-200"
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <Sparkles className="h-3 w-3 text-purple-400" />
                        <span>Sources from PDF</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, idx) => (
                          <a
                            key={`${msg.id}-cit-${idx}`}
                            href={c.openUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/40 transition-colors"
                          >
                            <span className="text-[10px] text-zinc-300">
                              Page {c.page}: {c.snippet.slice(0, 80)}...
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5 px-2">
                  {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3 text-zinc-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-sm">Speedy AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        {messages.length <= 1 && (
          <div className="px-5 py-3 border-t border-white/5 flex gap-2 overflow-x-auto scrollbar-hide">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  inputRef.current?.focus()
                }}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/10 hover:border-cyan-500/30 whitespace-nowrap transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this announcement..."
                className="w-full px-5 py-3.5 pr-14 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <p className="text-[10px] text-zinc-500">
              Powered by OpenAI GPT • Speedy Finance AI
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Floating chat button for detail view
export function ChatButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all ${className}`}
    >
      <MessageSquare className="h-5 w-5" />
      <span>Chat with AI</span>
      <Sparkles className="h-4 w-4 opacity-70 group-hover:opacity-100" />
    </button>
  )
}
