"use client"

import { useState, useRef, useEffect } from "react"
import { 
  Sparkles, Send, X, ChevronUp, Loader2, 
  TrendingUp, TrendingDown, User, Building2,
  Search, Mic, MicOff
} from "lucide-react"
import Link from "next/link"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  suggestions?: { type: "person" | "company"; name: string; code?: string }[]
}

interface BulkDealsAIBarProps {
  totalDeals: number
  dateRange: { from: Date; to: Date }
}

export function BulkDealsAIBar({ totalDeals, dateRange }: BulkDealsAIBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    setMessages(prev => [...prev, userMessage])
    const query = input.trim()
    setInput("")
    setIsLoading(true)

    try {
      // Call bulk deals AI endpoint
      const res = await fetch("/api/bulk-deals/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          dateRange: {
            start: dateRange.from.toISOString().split("T")[0],
            end: dateRange.to.toISOString().split("T")[0],
          },
          totalDeals,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "I couldn't find relevant information.",
          suggestions: data.suggestions,
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error("Failed")
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process that request. Try asking about specific investors, companies, or deal patterns.",
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickPrompts = [
    "Who are the top buyers today?",
    "Which stocks are being accumulated?",
    "Show big money deals",
    "Find FII activity",
  ]

  return (
    <>
      {/* Floating Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-6 right-6 z-50 group"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
            
            {/* Button */}
            <div className="relative flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-zinc-900 to-zinc-800 border border-white/10 rounded-2xl shadow-2xl hover:border-cyan-500/50 transition-all">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-white">Ask Speedy AI</span>
            </div>
          </div>
        </button>
      )}

      {/* Expanded Chat Panel */}
      {isExpanded && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Speedy AI</h3>
                  <p className="text-[10px] text-zinc-500">{totalDeals.toLocaleString()} deals in context</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-[320px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-cyan-400" />
                  </div>
                  <h4 className="text-sm font-medium text-white mb-2">Ask about bulk deals</h4>
                  <p className="text-xs text-zinc-500 mb-6">
                    I can help you find investors, analyze patterns, and discover opportunities.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt)
                          inputRef.current?.focus()
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-cyan-500/30 transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                        <div className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border border-cyan-500/20"
                            : "bg-white/5 border border-white/10"
                        }`}>
                          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>

                        {/* Suggestions */}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.suggestions.slice(0, 4).map((s, i) => (
                              <Link
                                key={i}
                                href={s.type === "person" 
                                  ? `/bulk-deals/person/${encodeURIComponent(s.name)}`
                                  : `/bulk-deals/company/${encodeURIComponent(s.code || s.name)}`
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 text-xs text-purple-300 hover:text-white hover:border-purple-500/40 transition-all"
                              >
                                {s.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                                {s.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                          <span className="text-sm text-zinc-400">Analyzing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5 bg-black/40">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Ask about investors, deals, patterns..."
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${isRecording ? "text-red-400 bg-red-500/20" : "text-zinc-400 hover:text-white"} transition-all`}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
