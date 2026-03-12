"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, FileText, ChevronRight, Download, Sparkles, Maximize2 } from "lucide-react"
import type { WatchlistItem } from "@/lib/storage"
import type { BSEAnnouncement } from "@/lib/bse/types"
import { clsx } from "clsx"

interface Props {
    items: WatchlistItem[]
}

interface EnrichedAnn extends BSEAnnouncement {
    stock: WatchlistItem
    sentiment: 'positive' | 'negative' | 'neutral'
    smartCategory: string
}

function classifyAnnouncement(a: BSEAnnouncement): { category: string, sentiment: 'positive' | 'negative' | 'neutral' } {
    const raw = (a.category + ' ' + a.headline).toLowerCase()

    if (raw.includes('result') || raw.includes('financial')) return { category: 'Financial Results', sentiment: 'neutral' }
    if (raw.includes('dividend') || raw.includes('bonus')) return { category: 'Corporate Action', sentiment: 'positive' }
    if (raw.includes('order') || raw.includes('contract') || raw.includes('award')) return { category: 'Order Book', sentiment: 'positive' }
    if (raw.includes('resignation') || raw.includes('management')) return { category: 'Management Change', sentiment: 'negative' }
    if (raw.includes('board meeting')) return { category: 'Board Meeting', sentiment: 'neutral' }
    if (raw.includes('allotment')) return { category: 'Capital Structure', sentiment: 'positive' }

    return { category: 'Other Situations', sentiment: 'neutral' }
}

const sentimentColors = {
    positive: "bg-emerald-500",
    negative: "bg-rose-500",
    neutral: "bg-amber-400"
}

export function WatchlistAnnouncements({ items }: Props) {
    const [announcements, setAnnouncements] = useState<EnrichedAnn[]>([])
    const [loading, setLoading] = useState(true)
    const [viewType, setViewType] = useState<'summary' | 'raw'>('summary')

    useEffect(() => {
        let mounted = true
        if (items.length === 0) {
            setAnnouncements([])
            setLoading(false)
            return
        }

        setLoading(true)
        // Fetch individually for each scrip to get recent ones (simulate bulk fetch if API doesn't support bulk)
        // Since the BSE API Route `?scripCode=...` only takes one, we'll multi-fetch and slice.
        Promise.all(items.map(stock =>
            fetch(`/api/bse/announcements?scripCode=${stock.scripCode}&days=7`)
                .then(r => r.json())
                .then(d => (d.announcements || []).map((a: BSEAnnouncement) => {
                    const { category, sentiment } = classifyAnnouncement(a)
                    return { ...a, stock, sentiment, smartCategory: category }
                }))
                .catch(() => [])
        )).then(results => {
            if (!mounted) return
            const all = results.flat()
            // Sort by time descending
            all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            setAnnouncements(all.slice(0, 100))
            setLoading(false)
        })

        return () => { mounted = false }
    }, [items])

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin text-[#3A4050]" />
                <p className="text-[12px] text-[#5D6574] mt-4 uppercase tracking-widest font-semibold">Scanning Exchanges...</p>
            </div>
        )
    }

    if (announcements.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <FileText className="w-10 h-10 text-[#1A1F26] mb-4" />
                <p className="text-[13px] text-[#A3ACBE] font-medium">No recent announcements</p>
                <p className="text-[11.5px] text-[#5D6574] mt-1 text-center max-w-[280px]">We couldn't find any recent exchange filings for the stocks in this watchlist.</p>
            </div>
        )
    }

    // Grouping by date
    const grouped = useMemo(() => {
        const groups: Record<string, EnrichedAnn[]> = {}
        announcements.forEach(a => {
            const dateStr = new Date(a.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            let label = dateStr

            // Nice relative labels
            const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            const yest = new Date(Date.now() - 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            if (dateStr === today) label = 'TODAY'
            else if (dateStr === yest) label = 'YESTERDAY'

            if (!groups[label]) groups[label] = []
            groups[label].push(a)
        })
        return groups
    }, [announcements])

    return (
        <div className="flex-1 overflow-y-auto px-5 lg:px-7 py-6 pb-20 custom-scrollbar relative">

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-1 bg-[#1A1F26]/60 p-1 rounded-xl border border-white/5 backdrop-blur-md">
                    <button
                        onClick={() => setViewType('summary')}
                        className={clsx("px-4 py-1.5 text-[11px] font-bold tracking-wide rounded-lg transition-all uppercase", viewType === 'summary' ? "bg-[#2A3040] text-white shadow-sm" : "text-[#5D6574] hover:text-[#A3ACBE]")}
                    >
                        Summary View
                    </button>
                    <button
                        onClick={() => setViewType('raw')}
                        className={clsx("px-4 py-1.5 text-[11px] font-bold tracking-wide rounded-lg transition-all uppercase", viewType === 'raw' ? "bg-[#2A3040] text-white shadow-sm" : "text-[#5D6574] hover:text-[#A3ACBE]")}
                    >
                        Raw View
                    </button>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#A3ACBE]">Live Feed</span>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                {Object.entries(grouped).map(([dayLabel, anns]) => (
                    <div key={dayLabel} className="mb-10 last:mb-0">
                        <h3 className="text-[11px] font-bold text-[#5D6574] uppercase tracking-[0.2em] mb-4 pl-1">
                            {dayLabel}
                        </h3>

                        <div className="flex flex-col gap-4">
                            {anns.map(a => (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {viewType === 'summary' ? (
                                        <div className="glass-card rounded-2xl p-5 mb-4 border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-200">
                                                        {a.stock.symbol}
                                                    </span>
                                                    <span className="text-xs text-zinc-500 truncate max-w-[180px] md:max-w-xs">
                                                        {a.stock.name}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                                                    <span className="text-lg">📝</span>
                                                    <span>News summary</span>
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {a.sentiment && (
                                                        <div className={clsx(
                                                            "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium",
                                                            a.sentiment === 'positive' ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                                                            a.sentiment === 'negative' ? "bg-rose-500/15 border-rose-500/30 text-rose-400" :
                                                            "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                                        )}>
                                                            <span className="opacity-80">Sentiment:</span>
                                                            <span className="font-bold capitalize">{a.sentiment}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-zinc-500 hidden sm:inline">What This Means for Investors</span>
                                                    <button className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all" title="Open Full-Screen AI Chat">
                                                        <Maximize2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="text-xs text-zinc-500 mb-2">
                                                {new Date(a.time).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </p>

                                            <div className="text-[15px] text-zinc-100 leading-relaxed font-medium">
                                                {a.headline}
                                            </div>

                                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-[11px]">
                                                <div className={clsx(
                                                    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 border",
                                                    a.sentiment === 'positive' ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" :
                                                    a.sentiment === 'negative' ? "bg-rose-500/10 text-rose-300 border-rose-500/20" :
                                                    "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                                )}>
                                                    <div className="flex items-center gap-0.5">
                                                        {Array.from({length: 12}).map((_, i) => (
                                                            <span key={i} className={clsx(
                                                                "h-1 w-1.5 rounded-sm",
                                                                i < (a.sentiment === 'positive' ? 8 : (a.sentiment === 'negative' ? 4 : 6))
                                                                    ? (a.sentiment === 'positive' ? "bg-emerald-500" : (a.sentiment === 'negative' ? "bg-rose-500" : "bg-amber-500"))
                                                                    : "bg-zinc-700"
                                                            )} />
                                                        ))}
                                                    </div>
                                                    <span className="font-bold capitalize">{a.sentiment === 'positive' ? 'High' : (a.sentiment === 'negative' ? 'Critical' : 'Moderate')} Impact</span>
                                                </div>
                                                <span className="text-zinc-500">
                                                    {a.summary || "Routine update with standard reporting structure."}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl bg-black/40 border border-white/5 px-4 py-3 md:px-5 hover:bg-white/[0.03] transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center flex-shrink-0">
                                                    <FileText className="h-4 w-4 text-zinc-400" />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[13px] font-semibold text-white leading-snug whitespace-normal">
                                                        <span className="text-blue-400 mr-1.5">{a.stock.symbol}</span>
                                                        {a.headline}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400 mt-1 font-medium">{a.stock.name} · {a.smartCategory}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-2 md:mt-0">
                                                {a.pdfUrl && (
                                                    <a href={a.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all">
                                                        <Download className="h-3.5 w-3.5" />
                                                        <span>View PDF</span>
                                                    </a>
                                                )}
                                                <button className="relative group px-5 py-2 rounded-full bg-zinc-950 border border-white/10 text-[11px] font-bold text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.05)] hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:border-cyan-500/50">
                                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                                    <div className="relative flex items-center gap-2 tracking-tight">
                                                        <div className="relative">
                                                            <Sparkles className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform duration-500" />
                                                            <div className="absolute inset-0 h-3.5 w-3.5 bg-cyan-400 blur-[8px] opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                                        </div>
                                                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400 group-hover:from-white group-hover:to-white transition-colors">Analyze with Speedy AI</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
