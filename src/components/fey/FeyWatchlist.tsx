"use client"

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search, Check, Plus, SlidersHorizontal,
    Bookmark, X, ArrowLeft, ChevronUp, ChevronDown,
    BarChart2, RefreshCw, Trash2, FolderPlus, Sparkles, AlertTriangle,
    Edit2
} from "lucide-react"
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors, DragEndEvent, DragOverlay, useDroppable
} from '@dnd-kit/core'
import {
    SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from "clsx"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { Sparkline } from "@/components/ui/sparkline"
import {
    getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist,
    saveWatchlist, getWatchlistGroups, createWatchlistGroup, deleteWatchlistGroup,
    updateWatchlistGroup,
    getSettings, updateSettings,
    type WatchlistItem, type WatchlistGroup
} from "@/lib/storage"
import { useWatchlist } from "@/hooks/useWatchlist"
import { WatchlistHoverCard } from "./WatchlistHoverCard"
import { WatchlistAnnouncements } from "./WatchlistAnnouncements"

const POPULAR_MOCKS = [
    { scripCode: '500325', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'BSE' },
    { scripCode: '532540', symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'BSE' },
    { scripCode: '500180', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'BSE' },
    { scripCode: '532174', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'BSE' },
    { scripCode: '500209', symbol: 'INFY', name: 'Infosys Ltd', exchange: 'BSE' },
    { scripCode: '500228', symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', exchange: 'BSE' }
]

// ── Types ──────────────────────────────────────────────────────────
type SortField = 'manual' | 'symbol' | 'price' | 'changePct' | 'changeAbs' | 'volume' | 'high' | 'low' | 'sinceAdded' | 'marketCap'
type SortDir = 'asc' | 'desc'

// ── Helpers ────────────────────────────────────────────────────────
function stockColor(t: string) {
    const c = ["bg-blue-500", "bg-emerald-500", "bg-red-500", "bg-orange-400", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-pink-500", "bg-amber-500", "bg-indigo-500"]
    let h = 0; for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h)
    return c[Math.abs(h) % c.length]
}
const fINR = (v: number, d = 2) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: d })}`
function fVol(v: number) {
    if (!v) return '—'
    if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`
    if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return `${v}`
}
function fMCap(v?: number) {
    if (!v || v <= 0) return '—'
    
    // API returns values already in Crores.
    // e.g. 1901583 = 19 Lakh Crores, so format >= 1,00,000 as LC
    if (v >= 1e5) {
        return `₹${(v / 1e5).toFixed(2)}L`
    }
    return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export const AVAILABLE_COLUMNS = [
    { id: 'chart', label: '7D Chart', width: '74px', hideClass: 'hidden sm:flex' },
    { id: 'dayRange', label: 'Day Range', width: '64px', hideClass: 'hidden xl:flex' },
    { id: 'volume', label: 'Volume', width: '64px', hideClass: 'hidden md:flex' },
    { id: 'marketCap', label: 'Mkt Cap (Cr)', width: '64px', hideClass: 'hidden lg:flex' },
    { id: 'sinceAdded', label: 'Since Added', width: '64px', hideClass: 'hidden lg:flex' },
]

// ── Sparkline history cache ─────────────────────────────────────────
// scripCode → number[]
const sparkCache: Record<string, number[]> = {}

async function fetchSpark(scripCode: string): Promise<number[]> {
    if (sparkCache[scripCode]) return sparkCache[scripCode]
    try {
        const r = await fetch(`/api/bse/history?scripCode=${scripCode}&days=30`)
        if (!r.ok) throw new Error()
        const d = await r.json()
        const prices: number[] = (d.data || d.history || [])
            .slice(-30)
            .map((pt: any) => pt.close || pt.price || pt.c || 0)
            .filter((n: number) => n > 0)
        if (prices.length >= 2) { sparkCache[scripCode] = prices; return prices }
    } catch { }
    // fallback: random walk seeded by ticker
    const seed = scripCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const fake = Array.from({ length: 20 }, (_, i) =>
        100 + Math.sin(i * 0.5 + seed) * 8 + (i / 20) * 10 + Math.sin(i * 1.3) * 3
    )
    sparkCache[scripCode] = fake
    return fake
}

// ── Price flash ────────────────────────────────────────────────────
function PriceFlash({ price, children }: { price: number; children: React.ReactNode }) {
    const prev = useRef(price)
    const [flash, setFlash] = useState<'up' | 'down' | null>(null)
    useEffect(() => {
        if (prev.current !== 0 && price !== prev.current) {
            setFlash(price > prev.current ? 'up' : 'down')
            const t = setTimeout(() => setFlash(null), 800)
            prev.current = price
            return () => clearTimeout(t)
        }
        prev.current = price
    }, [price])
    return (
        <span className={clsx("transition-colors duration-700",
            flash === 'up' && "text-emerald-300",
            flash === 'down' && "text-rose-300"
        )}>{children}</span>
    )
}

// ── Watchlist Row ──────────────────────────────────────────────────
import { useRouter } from "next/navigation"

interface RowProps {
    item: WatchlistItem
    quote?: ReturnType<typeof useWatchlist>['quotes'][string]
    sparkData: number[]
    onRemove: (sc: string) => void
    isDragging?: boolean
    dragProps?: Record<string, any>  // entire-row drag attributes
    onHover?: (item: WatchlistItem, ref: HTMLDivElement | null) => void
    onLeave?: () => void
    columns: string[]
}

function WatchlistRow({ item, quote, sparkData, onRemove, isDragging, dragProps, onHover, onLeave, columns }: RowProps) {
    const router = useRouter()
    const rowRef = useRef<HTMLDivElement>(null)
    const price = quote?.price ?? 0
    const pct = quote?.changePercent ?? 0
    const abs = quote?.change ?? 0
    const vol = quote?.volume ?? 0
    const high = quote?.high ?? 0
    const low = quote?.low ?? 0
    const isPos = pct >= 0
    const loading = quote?.isLoading ?? false
    const color = stockColor(item.symbol)

    return (
        <div
            ref={rowRef}
            {...dragProps}
            onClick={() => router.push(`/company/${item.scripCode}`)}
            className={clsx(
                "flex items-center gap-3 py-3 px-4 -mx-4 rounded-2xl group transition-all select-none border border-transparent",
                "cursor-pointer active:cursor-grabbing hover:scale-[1.005] active:scale-[0.995]",
                isDragging ? "opacity-30 scale-95" : "hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-white/5"
            )}
        >
            {/* Avatar */}
            <div className={clsx("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white relative overflow-hidden", color)}>
                <img
                    src={`https://financialmodelingprep.com/image-stock/${item.symbol}.NS.png`}
                    alt={item.symbol}
                    className="w-full h-full object-cover z-10 bg-white"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
                <span className="absolute z-0">{item.symbol.slice(0, 2)}</span>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-white tracking-tight">{item.symbol}</span>
                    {/* Removed fallback for volume */}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[#5D6574] truncate max-w-[110px] hidden sm:block">{item.name}</span>
                    {quote?.price && quote.marketCap > 0 && !columns.includes('marketCap') && (
                        <span className="text-[10px] text-[#2A3040] hidden lg:block">MCap {fMCap(quote.marketCap)}</span>
                    )}
                </div>
            </div>

            {/* Dynamic Columns */}
            {AVAILABLE_COLUMNS.map(c => {
                if (!columns.includes(c.id)) return null;

                return (
                    <div key={c.id} className={clsx("flex-shrink-0 flex-col items-end justify-center", c.hideClass)} style={{ width: c.width }}>
                        {c.id === 'chart' && (
                            <div
                                className="w-[74px] h-[28px] rounded hover:bg-white/5 transition-colors flex items-center justify-center cursor-crosshair"
                                onMouseEnter={(e) => { e.stopPropagation(); onHover?.(item, rowRef.current) }}
                                onMouseLeave={(e) => { e.stopPropagation(); onLeave?.() }}
                            >
                                {sparkData.length >= 2 ? (
                                    <Sparkline data={sparkData} width={70} height={26} showDot={false} />
                                ) : (
                                    <div className="w-3 h-3 rounded-full border border-[#3A4050] border-t-transparent animate-spin" />
                                )}
                            </div>
                        )}
                        {c.id === 'volume' && (
                            <span className="text-[12.5px] font-semibold text-[#E2E8F0] tracking-tight">{fVol(vol)}</span>
                        )}
                        {c.id === 'marketCap' && (
                            <span className="text-[12.5px] font-semibold text-[#E2E8F0] tracking-tight">{fMCap(quote?.marketCap)}</span>
                        )}
                        {c.id === 'dayRange' && (
                            <div className="flex flex-col items-end leading-[1.2] opacity-80">
                                <span className="text-[11.5px] font-semibold tracking-tight text-[#E2E8F0]">{fINR(high, 0)}</span>
                                <span className="text-[10px] font-medium tracking-tight text-[#64748B] pr-[1px]">{fINR(low, 0)}</span>
                            </div>
                        )}
                        {c.id === 'sinceAdded' && (
                            item.addedPrice && price > 0 ? (() => {
                                const ret = ((price - item.addedPrice) / item.addedPrice) * 100
                                const isPosRet = ret >= 0
                                return (
                                    <div className="flex flex-col items-end justify-center">
                                        <span className="text-[8.5px] uppercase tracking-wider text-[#5D6574] font-semibold mb-[1px]">Added</span>
                                        <span className={clsx("text-[11px] font-bold tracking-tight", isPosRet ? "text-[#10b981]" : "text-[#ef4444]")}>
                                            {isPosRet ? "+" : ""}{ret.toFixed(2)}%
                                        </span>
                                    </div>
                                )
                            })() : (
                                <div className="flex flex-col items-end opacity-40">
                                    <span className="text-[8.5px] uppercase tracking-wider text-[#5D6574] font-semibold mb-[1px]">Added</span>
                                    <span className="text-[11px] text-[#3A4050] font-bold tracking-tight">—</span>
                                </div>
                            )
                        )}
                    </div>
                )
            })}

            {/* Price */}
            <div className="flex-shrink-0 text-right w-[62px]">
                {loading ? (
                    <span className="text-[12px] text-[#3A4050] animate-pulse">—</span>
                ) : (
                    <PriceFlash price={price}>
                        <span className="text-[13px] font-semibold text-white">
                            {price > 0 ? fINR(price) : '—'}
                        </span>
                    </PriceFlash>
                )}
                {/* Removed fallback for dayRange */}
            </div>

            {/* Change badge */}
            <div className={clsx(
                "flex-shrink-0 min-w-[64px] px-2.5 py-1 rounded-lg text-[11.5px] font-bold text-center border transition-colors",
                isPos 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20" 
                    : "bg-rose-500/15 text-rose-400 border-rose-500/20 group-hover:bg-rose-500/25"
            )}>
                {pct !== 0 ? `${isPos ? "+" : ""}${pct.toFixed(2)}%` : '—%'}
            </div>

            {/* Remove (hover only) */}
            <button
                onClick={e => { e.stopPropagation(); onRemove(item.scripCode) }}
                className="flex-shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500/15 text-[#3A4050] hover:text-rose-400 transition-all"
                onPointerDown={e => e.stopPropagation()}
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

function SearchRow({ stock, isTop, isInList, onToggle }: { stock: any, isTop?: boolean, isInList: boolean, onToggle: () => void }) {
    const router = useRouter()
    return (
        <div
            onClick={() => router.push(`/company/${stock.scripCode}`)}
            className={clsx(
                "flex items-center gap-3 py-4 cursor-pointer transition-colors border-b border-white/5",
                isTop ? "bg-white/[0.06] -mx-6 px-6 relative z-10" : "hover:bg-white/[0.03] -mx-6 px-6"
            )}
        >
            <div className="w-8 h-8 rounded-full flex-shrink-0 bg-[#0A0A0A] flex items-center justify-center overflow-hidden relative border border-white/5">
                <span className="text-[10px] text-[#4B5563] font-bold absolute tracking-tighter uppercase">{stock.symbol.slice(0, 2)}</span>
                <img
                    src={`https://financialmodelingprep.com/image-stock/${stock.symbol}.NS.png`}
                    alt={stock.symbol}
                    className="w-full h-full object-cover relative z-10 bg-white"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
            </div>

            <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
                <span className="text-[15px] font-bold text-white tracking-tight leading-none">{stock.symbol}</span>
                <span className="text-[14px] font-normal text-[#6B7280] truncate leading-none">{stock.name}</span>
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={clsx(
                    "w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors",
                    isInList ? "text-[#3B82F6]" : "text-[#4B5563] hover:text-[#6B7280]"
                )}
            >
                <Bookmark className={clsx("w-5 h-5", isInList && "fill-[#3B82F6]")} strokeWidth={2} />
            </button>
        </div>
    )
}

// ── Sortable wrapper ───────────────────────────────────────────────
function SortableRow({ item, quote, sparkData, onRemove, activeDragId, onHover, onLeave, columns }: {
    item: WatchlistItem
    quote?: ReturnType<typeof useWatchlist>['quotes'][string]
    sparkData: number[]
    onRemove: (sc: string) => void
    activeDragId: string | null
    onHover?: (item: WatchlistItem, ref: HTMLDivElement | null) => void
    onLeave?: () => void
    columns: string[]
}) {
    const dndId = `row-${item.scripCode}`
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 180ms ease",
        zIndex: isDragging ? 50 : 1
    }
    return (
        <div ref={setNodeRef} style={style}>
            <WatchlistRow
                item={item}
                quote={quote}
                sparkData={sparkData}
                onRemove={onRemove}
                isDragging={activeDragId === dndId && !isDragging ? false : isDragging}
                dragProps={{ ...attributes, ...listeners }}
                onHover={onHover}
                onLeave={onLeave}
                columns={columns}
            />
        </div>
    )
}

// ── Sector chart data ──────────────────────────────────────────────
const MOCK_MARKET = Array.from({ length: 60 }, (_, i) => ({
    d: i, w: 30 + (i / 60) * 40 + Math.sin(i * 0.2) * 4, p: 30 + (i / 60) * 100 + Math.sin(i * 0.4) * 15
}))

function DroppableGroup({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `group-${id}`,
    })
    return (
        <div ref={setNodeRef} className={clsx(className, isOver && "bg-white/[0.02] rounded-xl transition-colors ring-1 ring-white/[0.05]")}>
            {children}
        </div>
    )
}

function inferSector(name: string, sym: string) {
    const n = (name + sym).toLowerCase()
    if (/bank|hdfc|sbi|kotak|axis|icici/.test(n)) return "Banking"
    if (/infy|tcs|wipro|hcl|tech mahindra|mphasis|ltim/.test(n)) return "IT Services"
    if (/pharma|sun pharma|divi|cipla|dr.reddy|biocon/.test(n)) return "Pharma"
    if (/steel|metal|hindalco|vedanta|nalco|jindal/.test(n)) return "Metals"
    if (/motor|auto|maruti|hero|bajaj auto|eicher|m&m/.test(n)) return "Auto"
    if (/oil|gas|ongc|reliance|bpcl|hpcl|gail/.test(n)) return "Energy"
    if (/itc|nestle|hul|britannia|marico|dabur/.test(n)) return "FMCG"
    if (/power|ntpc|tata power|adani power/.test(n)) return "Infrastructure"
    if (/telecom|airtel|ji/.test(n)) return "Telecom"
    if (/fin|nse|bse|hdfc life|sbi life/.test(n)) return "Financial Services"
    return "Technology"
}

const SECTORS = ["Banking", "IT Services", "Pharma", "Metals", "Auto", "Energy", "FMCG", "Infrastructure", "Telecom", "Financial Services", "Technology", "Consumer"]

// ── Main Component ─────────────────────────────────────────────────
export function FeyWatchlist() {
    const { items, quotes, isLoading, add, remove, refresh } = useWatchlist(60000)
    const [groups, setGroups] = useState<WatchlistGroup[]>([])
    const [rightPanel, setRightPanel] = useState<'closed' | 'search' | 'assign'>('closed')
    const [searchQ, setSearchQ] = useState("")
    const [searchRes, setSearchRes] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [assigningStock, setAssigningStock] = useState<any | null>(null)
    const [sortField, setSortField] = useState<SortField>('manual')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [showSortMenu, setShowSortMenu] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [showGroupModal, setShowGroupModal] = useState(false)
    const [newGroupName, setNewGroupName] = useState("")
    const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
    const [viewMode, setViewMode] = useState<'stocks' | 'announcements'>('stocks')
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")

    // Configurable Columns
    const [columns, setColumns] = useState<string[]>(['chart', 'dayRange', 'sinceAdded'])
    const [showColMenu, setShowColMenu] = useState(false)

    // Sync settings
    useEffect(() => {
        setColumns(getSettings().watchlistColumns)
        const h = (e: any) => setColumns(e.detail.watchlistColumns)
        window.addEventListener('settings-updated', h)
        return () => window.removeEventListener('settings-updated', h)
    }, [])

    const toggleColumn = useCallback((colId: string) => {
        const current = getSettings().watchlistColumns || []
        const next = current.includes(colId) ? current.filter(c => c !== colId) : [...current, colId]
        updateSettings({ watchlistColumns: next })
    }, [])

    // Hover Card State
    const [hoveredItem, setHoveredItem] = useState<{ item: WatchlistItem, ref: HTMLDivElement } | null>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleHover = useCallback((item: WatchlistItem, el: HTMLDivElement | null) => {
        if (!el) return
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem({ item, ref: el })
        }, 600) // 600ms intent delay
    }, [])

    const handleLeave = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null)
        }, 150) // Small margin to move cursor into card
    }, [])

    // Load groups
    useEffect(() => {
        setGroups(getWatchlistGroups())
        const h = () => setGroups(getWatchlistGroups())
        window.addEventListener('watchlist-groups-updated', h)
        return () => window.removeEventListener('watchlist-groups-updated', h)
    }, [])

    const handleRenameGroup = useCallback((id: string, newName: string) => {
        if (!newName.trim()) return
        updateWatchlistGroup(id, { name: newName.trim() })
        setEditingGroupId(null)
    }, [])

    const handleDeleteGroup = useCallback((id: string) => {
        if (id === 'default') return
        if (confirm("Are you sure? All stocks in this group will also be removed.")) {
            deleteWatchlistGroup(id)
        }
    }, [])

    // Track refresh time
    useEffect(() => {
        if (!isLoading && items.length > 0) setLastRefreshed(new Date())
    }, [isLoading, items.length])

    // Fetch sparklines for all items
    useEffect(() => {
        items.forEach(item => {
            if (!sparklines[item.scripCode]) {
                fetchSpark(item.scripCode).then(data => {
                    setSparklines(prev => ({ ...prev, [item.scripCode]: data }))
                })
            }
        })
    }, [items])

    // Search
    useEffect(() => {
        if (!searchQ) { setSearchRes([]); return }
        setIsSearching(true)
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`/api/bse/search?q=${encodeURIComponent(searchQ)}`)
                if (r.ok) {
                    const d = await r.json()
                    setSearchRes((d.results || []).slice(0, 25).map((s: any) => ({
                        scripCode: s.scripCode || '',
                        symbol: s.symbol,
                        name: s.name || s.symbol,
                        exchange: s.exchange || 'BSE'
                    })))
                }
            } catch { }
            setIsSearching(false)
        }, 220)
        return () => clearTimeout(t)
    }, [searchQ])

    useEffect(() => {
        if (rightPanel === 'closed') { setSearchQ(""); setSearchRes([]); setAssigningStock(null) }
    }, [rightPanel])

    const handleAdd = useCallback((stock: any, groupId: string) => {
        add({ scripCode: stock.scripCode, symbol: stock.symbol, name: stock.name, groupId })
        setRightPanel('closed')
        // pre-fetch sparkline
        fetchSpark(stock.scripCode).then(data =>
            setSparklines(prev => ({ ...prev, [stock.scripCode]: data }))
        )
    }, [add])

    const getSorted = useCallback((list: WatchlistItem[]) => {
        if (sortField === 'manual') return list;
        return [...list].sort((a, b) => {
            const qa = quotes[a.scripCode], qb = quotes[b.scripCode]
            let va: any = 0, vb: any = 0
            if (sortField === 'symbol') { va = a.symbol; vb = b.symbol }
            else if (sortField === 'price') { va = qa?.price ?? 0; vb = qb?.price ?? 0 }
            else if (sortField === 'changePct') { va = qa?.changePercent ?? 0; vb = qb?.changePercent ?? 0 }
            else if (sortField === 'changeAbs') { va = Math.abs(qa?.change ?? 0); vb = Math.abs(qb?.change ?? 0) }
            else if (sortField === 'volume') { va = qa?.volume ?? 0; vb = qb?.volume ?? 0 }
            else if (sortField === 'marketCap') { va = qa?.marketCap ?? 0; vb = qb?.marketCap ?? 0 }
            else if (sortField === 'high') { va = qa?.high ?? 0; vb = qb?.high ?? 0 }
            else if (sortField === 'low') { va = qa?.low ?? 0; vb = qb?.low ?? 0 }
            else if (sortField === 'sinceAdded') {
                va = a.addedPrice && qa?.price > 0 ? ((qa.price - a.addedPrice) / a.addedPrice) : -9999
                vb = b.addedPrice && qb?.price > 0 ? ((qb.price - b.addedPrice) / b.addedPrice) : -9999
            }
            if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return sortDir === 'asc' ? va - vb : vb - va
        })
    }, [quotes, sortField, sortDir])

    const handleSort = (f: SortField) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(f); setSortDir('desc') }
        setShowSortMenu(false)
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    function handleDragEnd(e: DragEndEvent) {
        setActiveDragId(null)
        const { active, over } = e
        if (!over || active.id === over.id) return
        
        const fromSc = String(active.id).replace('row-', '')
        const toId = String(over.id)
        
        const all = getWatchlist()
        const fi = all.findIndex(i => i.scripCode === fromSc)
        if (fi < 0) return

        const newAll = [...all]
        let targetGroupId = newAll[fi].groupId

        // If dropped over a specific item
        if (toId.startsWith('row-')) {
            const toSc = toId.replace('row-', '')
            const ti = newAll.findIndex(i => i.scripCode === toSc)
            if (ti >= 0) {
                targetGroupId = newAll[ti].groupId
                newAll[fi].groupId = targetGroupId // Update group explicitly
                
                // Now reorder
                const reordered = arrayMove(newAll, fi, ti).map((it, idx) => ({ ...it, order: idx }))
                saveWatchlist(reordered)
                setSortField('manual')
                return
            }
        } 
        
        // If dropped over a group container (we will add 'group-{id}' later)
        if (toId.startsWith('group-')) {
            targetGroupId = toId.replace('group-', '')
            newAll[fi].groupId = targetGroupId
            saveWatchlist(newAll)
            setSortField('manual')
            return
        }
    }

    const groupedItems = useMemo(() => {
        const by: Record<string, WatchlistItem[]> = {}
        groups.forEach(g => { by[g.id] = [] })
        items.forEach(i => {
            const gid = i.groupId || groups[0]?.id || 'default'
            if (!by[gid]) by[gid] = []
            by[gid].push(i)
        })
        return by
    }, [items, groups])

    const stats = useMemo(() => {
        const qs = Object.values(quotes)
        return {
            gainers: qs.filter(q => (q.changePercent ?? 0) > 0).length,
            losers: qs.filter(q => (q.changePercent ?? 0) < 0).length,
            avg: qs.length > 0 ? qs.reduce((s, q) => s + (q.changePercent ?? 0), 0) / qs.length : 0
        }
    }, [quotes])

    const sectorData = useMemo(() => {
        const total = items.length
        const cnt: Record<string, number> = {}
        items.forEach(i => {
            const s = inferSector(i.name, i.symbol)
            cnt[s] = (cnt[s] || 0) + 1
        })
        return SECTORS.map(n => ({ name: n, w: total > 0 ? ((cnt[n] || 0) / total) * 100 : 0 }))
            .filter(s => s.w > 0)
    }, [items])

    const isRightOpen = rightPanel !== 'closed'
    const sortOptions: { field: SortField; label: string }[] = [
        { field: 'manual', label: 'Custom Order' },
        { field: 'symbol', label: 'Name (A–Z)' },
        { field: 'price', label: 'Price' },
        { field: 'changePct', label: '% Change' },
        { field: 'changeAbs', label: '₹ Change' },
        { field: 'volume', label: 'Volume' },
        { field: 'marketCap', label: 'Market Cap' },
        { field: 'sinceAdded', label: 'Since Added' },
        { field: 'high', label: 'Day High' },
        { field: 'low', label: 'Day Low' },
    ]

    return (
        <div className="w-full h-full relative overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black">
            {/* Backdrop */}
            <AnimatePresence>
                {isRightOpen && (
                    <motion.div
                        key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20"
                        onClick={() => setRightPanel('closed')}
                    />
                )}
            </AnimatePresence>

            <div className="w-full h-full flex relative">
                {/* ══ BASE LAYER ══ */}
                <motion.div
                    className="flex-1 flex min-w-0 relative"
                    animate={{
                        filter: isRightOpen ? 'brightness(0.4) blur(1px)' : 'brightness(1) blur(0px)',
                        scale: isRightOpen ? 0.97 : 1,
                    }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                    {/* ── Col 1: Analytics ── */}
                    <div className="w-[300px] xl:w-[340px] flex-shrink-0 flex flex-col p-5 pr-0 hidden lg:flex">
                        <h2 className="text-[13.5px] font-semibold text-[#F4F7FD] mb-5 tracking-tight">Watchlist vs markets</h2>

                        {/* Chart */}
                        <div className="h-[150px] w-full mb-10 relative">
                            <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-between text-[9.5px] text-[#2A3040] py-0.5">
                                <span>+140%</span><span>+70%</span><span>0%</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={MOCK_MARKET} margin={{ top: 2, right: 18, bottom: 2, left: 2 }}>
                                    <Line type="monotone" dataKey="w" stroke="#4A5568" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="p" stroke="#F68D3C" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                            <div className="absolute -bottom-6 left-0 flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-[10px] h-[2px] bg-[#4A5568]" />
                                    <span className="text-[10px] text-[#5D6574] uppercase tracking-wider">Nifty 50</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-[10px] h-[2px] bg-[#F68D3C]" />
                                    <span className="text-[10px] text-[#5D6574] uppercase tracking-wider">Watchlist</span>
                                </div>
                            </div>
                        </div>

                        {/* Live stats */}
                        {items.length > 0 && (
                            <div className="flex items-center gap-2 mb-6">
                                <div className="flex-1 glass-card rounded-xl p-3.5 border-white/5 shadow-lg">
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Avg 1-day</p>
                                    <p className={clsx("text-lg font-bold mt-1 tabular-nums", stats.avg >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(2)}%
                                    </p>
                                </div>
                                <div className="flex-1 glass-card rounded-xl p-3.5 border-white/5 shadow-lg">
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">G / L</p>
                                    <p className="text-lg font-bold mt-1">
                                        <span className="text-emerald-400">{stats.gainers}</span>
                                        <span className="text-zinc-700 mx-1.5 font-normal">/</span>
                                        <span className="text-rose-400">{stats.losers}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Sector allocation */}
                        {sectorData.length > 0 && (
                            <>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Sector allocation</p>
                                <div className="space-y-3.5 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                    {sectorData.map(s => (
                                        <div key={s.name} className="flex items-center gap-3">
                                            <span className="text-[11.5px] text-zinc-400 w-[90px] flex-shrink-0 truncate font-medium">{s.name}</span>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all duration-700"
                                                        style={{ width: `${s.w}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10.5px] text-zinc-500 tabular-nums w-8 flex-shrink-0 text-right font-medium">
                                                    {s.w.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px bg-[#0E1318] flex-shrink-0 hidden lg:block" />

                    {/* ── Col 2: Watchlist ── */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 lg:px-7 py-4 flex-shrink-0 border-b border-[#0E1318]">
                            <div className="flex items-center gap-4">
                                <div className="flex bg-[#07090C] p-[3px] rounded-xl border border-[#1A1F26]">
                                    <button
                                        onClick={() => setViewMode('stocks')}
                                        className={clsx("px-4 py-1.5 text-[11.5px] font-bold tracking-wide uppercase rounded-lg transition-all", viewMode === 'stocks' ? "bg-[#1A1F26] text-[#F4F7FD]" : "text-[#5D6574] hover:text-[#A3ACBE]")}
                                    >
                                        Stocks
                                    </button>
                                    <button
                                        onClick={() => setViewMode('announcements')}
                                        className={clsx("px-4 py-1.5 text-[11.5px] font-bold tracking-wide uppercase rounded-lg transition-all", viewMode === 'announcements' ? "bg-[#1A1F26] text-[#F4F7FD]" : "text-[#5D6574] hover:text-[#A3ACBE]")}
                                    >
                                        Insights
                                    </button>
                                </div>
                                <div className="flex items-center gap-2.5 ml-1 border-l border-[#1A1F26] pl-5 hidden md:flex">
                                    {items.length > 0 && (
                                        <span className="text-[10px] uppercase font-bold text-[#A3ACBE] bg-[#1A1F26]/50 px-2 py-0.5 rounded">{items.length} saved</span>
                                    )}
                                    {lastRefreshed && (
                                        <span className="text-[9.5px] font-medium text-[#4A5568]">
                                            Last {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={async () => { setIsRefreshing(true); await refresh(); setLastRefreshed(new Date()); setIsRefreshing(false) }}
                                    disabled={isRefreshing}
                                    className="p-1.5 rounded-lg text-[#3A4050] hover:text-[#A3ACBE] hover:bg-white/[0.04] transition-all disabled:opacity-30"
                                    title="Refresh"
                                >
                                    <RefreshCw className={clsx("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                                </button>
                                <button
                                    onClick={() => setShowGroupModal(true)}
                                    className="p-1.5 rounded-lg text-[#3A4050] hover:text-[#A3ACBE] hover:bg-white/[0.04] transition-all"
                                    title="New group"
                                >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSortMenu(v => !v)}
                                        className={clsx("p-1.5 rounded-lg transition-all",
                                            showSortMenu ? "bg-[#F68D3C]/10 text-[#F68D3C]" : "text-[#3A4050] hover:text-[#A3ACBE] hover:bg-white/[0.04]")}
                                    >
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <AnimatePresence>
                                        {showSortMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                                transition={{ duration: 0.12 }}
                                                className="absolute right-0 top-full mt-1.5 w-44 bg-[#0C0F14] border border-[#1A1F26] rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                                            >
                                                {sortOptions.map(o => (
                                                    <button key={o.field} onClick={() => handleSort(o.field)}
                                                        className="w-full flex items-center justify-between px-4 py-2 text-[12px] hover:bg-white/[0.04] transition-colors">
                                                        <span className={sortField === o.field ? "text-[#F68D3C]" : "text-[#A3ACBE]"}>{o.label}</span>
                                                        {sortField === o.field && (sortDir === 'asc'
                                                            ? <ChevronUp className="w-3 h-3 text-[#F68D3C]" />
                                                            : <ChevronDown className="w-3 h-3 text-[#F68D3C]" />)}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button
                                    onClick={() => { setShowSortMenu(false); setRightPanel('search') }}
                                    className="p-1.5 rounded-lg text-[#3A4050] hover:text-[#A3ACBE] hover:bg-white/[0.04] transition-all"
                                    title="Add stock"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        {viewMode === 'announcements' ? (
                            <WatchlistAnnouncements items={items} />
                        ) : (
                            <>
                                {/* Column headers */}
                                <div className="flex items-center justify-between px-5 lg:px-7 py-2 flex-shrink-0">
                                    <span className="text-[10px] font-medium text-[#2A3040] uppercase tracking-wider">Stock</span>
                                    <div className="flex items-center gap-3 text-[10px] font-medium text-[#2A3040] uppercase tracking-wider">

                                        {AVAILABLE_COLUMNS.map(c => {
                                            if (!columns.includes(c.id)) return null;
                                            const sortIdMap: Record<string, SortField> = { 'volume': 'volume', 'marketCap': 'marketCap', 'sinceAdded': 'sinceAdded' }
                                            const sortId = sortIdMap[c.id]

                                            return (
                                                <span
                                                    key={c.id}
                                                    className={clsx("group relative flex flex-col items-end justify-center", c.hideClass, sortId && "cursor-pointer hover:text-[#5D6574]")}
                                                    style={{ width: c.width }}
                                                    onClick={() => sortId && handleSort(sortId)}
                                                >
                                                    <span className="flex items-center gap-1 group-hover:opacity-0 transition-opacity bg-transparent">
                                                        {c.label} {sortId && sortField === sortId ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleColumn(c.id); }}
                                                        title="Hide column"
                                                        className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 hover:text-rose-300"
                                                    >
                                                        <X className="w-3 h-3 mr-1" strokeWidth={2.5} />
                                                    </button>
                                                </span>
                                            );
                                        })}

                                        <span className="cursor-pointer hover:text-[#5D6574] w-[62px] text-right" onClick={() => handleSort('price')}>
                                            Price {sortField === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                                        </span>
                                        <span className="cursor-pointer hover:text-[#5D6574] w-[58px] text-right" onClick={() => handleSort('changePct')}>
                                            1-day {sortField === 'changePct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                                        </span>

                                        {/* Add Column Dropdown */}
                                        <div className="relative w-[28px] flex justify-end items-center">
                                            <button
                                                onClick={() => setShowColMenu(!showColMenu)}
                                                className={clsx("p-1 rounded-sm transition-colors mb-[1px]", showColMenu ? "bg-white/10 text-white" : "text-[#4B5563] hover:text-[#A3ACBE] hover:bg-white/5")}
                                                title="Customize Columns"
                                            >
                                                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                            </button>
                                            <AnimatePresence>
                                                {showColMenu && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                        transition={{ duration: 0.12 }}
                                                        className="absolute right-0 top-[24px] w-48 bg-[#0C0F14] border border-[#1A1F26] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5"
                                                    >
                                                        <div className="px-3 py-1.5 text-[9.5px] uppercase tracking-wider text-[#5D6574] font-bold border-b border-[#1A1F26]/60 mb-1">
                                                            Data Columns
                                                        </div>
                                                        {AVAILABLE_COLUMNS.map(c => {
                                                            const active = columns.includes(c.id);
                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => toggleColumn(c.id)}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-[12.5px] font-medium hover:bg-white/[0.04] transition-colors normal-case tracking-normal"
                                                                >
                                                                    <span className={active ? "text-white" : "text-[#A3ACBE]"}>{c.label}</span>
                                                                    {active && <Check className="w-3.5 h-3.5 text-[#3B82F6]" strokeWidth={2.5} />}
                                                                </button>
                                                            );
                                                        })}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto min-h-0 px-4 lg:px-5 pb-4">
                                    {items.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-[#0C0F14] border border-[#1A1F26] flex items-center justify-center">
                                                <BarChart2 className="w-6 h-6 text-[#3A4050]" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[14px] font-medium text-[#5D6574]">Your watchlist is empty</p>
                                                <p className="text-[12px] text-[#3A4050] mt-1">Search any BSE/NSE stock to start tracking</p>
                                            </div>
                                            <button
                                                onClick={() => setRightPanel('search')}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F68D3C]/10 text-[#F68D3C] border border-[#F68D3C]/20 hover:bg-[#F68D3C]/20 transition-all text-[13px] font-medium"
                                            >
                                                <Search className="w-3.5 h-3.5" />
                                                Search & add stocks
                                            </button>
                                        </div>
                                    ) : (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragStart={e => setActiveDragId(String(e.active.id))}
                                            onDragEnd={handleDragEnd}
                                            onDragCancel={() => setActiveDragId(null)}
                                        >
                                            {groups.map(group => {
                                                const gItems = getSorted(groupedItems[group.id] || [])
                                                return (
                                                    <DroppableGroup key={group.id} id={group.id} className="mb-3 rounded-b-xl pb-1">
                                                        {groups.length > 1 && (
                                                            <div className="flex items-center gap-2 mb-3 mt-2 px-1 group/header">
                                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]" style={{ backgroundColor: group.color }} />
                                                                
                                                                {editingGroupId === group.id ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        value={editName}
                                                                        onChange={e => setEditName(e.target.value)}
                                                                        onBlur={() => handleRenameGroup(group.id, editName)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleRenameGroup(group.id, editName)
                                                                            if (e.key === 'Escape') setEditingGroupId(null)
                                                                        }}
                                                                        className="bg-transparent border-b border-orange-500/50 outline-none text-[11px] font-bold text-white uppercase tracking-widest w-32"
                                                                    />
                                                                ) : (
                                                                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{group.name}</span>
                                                                )}

                                                                <div className="flex items-center gap-1.5 opacity-0 group-hover/header:opacity-100 transition-opacity ml-1">
                                                                    <button 
                                                                        onClick={() => { setEditingGroupId(group.id); setEditName(group.name) }}
                                                                        className="p-1 hover:bg-white/5 rounded text-zinc-600 hover:text-zinc-400"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    {group.id !== 'default' && (
                                                                        <button 
                                                                            onClick={() => handleDeleteGroup(group.id)}
                                                                            className="p-1 hover:bg-rose-500/10 rounded text-zinc-600 hover:text-rose-400"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="h-px flex-1 bg-white/5 ml-2" />
                                                                <span className="text-[10px] text-zinc-600 font-bold bg-white/5 px-2 py-0.5 rounded-full">{gItems.length}</span>
                                                            </div>
                                                        )}
                                                        <SortableContext items={gItems.map(i => `row-${i.scripCode}`)} strategy={verticalListSortingStrategy}>
                                                            {gItems.map(item => (
                                                                <SortableRow
                                                                    key={item.scripCode}
                                                                    item={item}
                                                                    quote={quotes[item.scripCode]}
                                                                    sparkData={sparklines[item.scripCode] || []}
                                                                    onRemove={remove}
                                                                    activeDragId={activeDragId}
                                                                    onHover={handleHover}
                                                                    onLeave={handleLeave}
                                                                    columns={columns}
                                                                />
                                                            ))}
                                                        </SortableContext>
                                                        {gItems.length === 0 && groups.length > 1 && (
                                                            <div className="text-[11px] text-[#3A4050] px-3 py-4 mt-1 border border-dashed border-[#1A1F26] rounded-xl flex items-center justify-center bg-white/[0.01]">
                                                                Drop stocks here
                                                            </div>
                                                        )}
                                                    </DroppableGroup>
                                                )
                                            })}
                                            <DragOverlay>
                                                {activeDragId && (() => {
                                                    const sc = activeDragId.replace('row-', '')
                                                    const item = items.find(i => i.scripCode === sc)
                                                    if (!item) return null
                                                    return (
                                                        <div className="opacity-90 shadow-2xl ring-1 ring-white/10 rounded-xl">
                                                            <WatchlistRow
                                                                item={item}
                                                                quote={quotes[item.scripCode]}
                                                                sparkData={sparklines[item.scripCode] || []}
                                                                onRemove={() => { }}
                                                                columns={columns}
                                                            />
                                                        </div>
                                                    )
                                                })()}
                                            </DragOverlay>
                                        </DndContext>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>

                {/* ══ RIGHT PANEL (Search / Assign) ══ */}
                <AnimatePresence>
                    {isRightOpen && (
                        <motion.div
                            key="rp"
                            initial={{ x: "100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "100%", opacity: 0 }}
                            transition={{ type: "spring", stiffness: 420, damping: 36 }}
                            className="absolute right-0 top-0 bottom-0 w-full sm:w-[360px] md:w-[400px] bg-[#07090C]/95 backdrop-blur-xl border-l border-[#1A1F26] z-30 flex flex-col shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {rightPanel === 'search' && (
                                <div className="h-full flex flex-col bg-[#0D0D0D] text-white">
                                    {/* Search Input Area */}
                                    <div className="flex items-center px-6 pt-8 pb-4 border-b border-white/5 flex-shrink-0">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Search symbols"
                                            value={searchQ}
                                            onChange={e => setSearchQ(e.target.value)}
                                            className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[20px] font-normal text-white placeholder-[#4B5563] caret-blue-500"
                                        />
                                        <button
                                            onClick={() => setRightPanel('closed')}
                                            className="ml-4 text-[15px] font-medium text-[#3B82F6] hover:text-[#60A5FA] transition-colors flex-shrink-0"
                                        >
                                            Done
                                        </button>
                                    </div>

                                    {/* Results / Empty States Area */}
                                    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 custom-scrollbar">
                                        {isSearching ? (
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 border-[#3A4050] border-t-[#3B82F6] animate-spin" />
                                            </div>
                                        ) : searchQ.length > 0 ? (
                                            /* Active Search State */
                                            <div>
                                                <h4 className="text-[13px] text-[#6B7280] font-medium tracking-[0.05em] mb-2">RESULTS</h4>
                                                {searchRes.length === 0 ? (
                                                    <p className="text-[14px] text-[#6B7280] py-4">No results found.</p>
                                                ) : (
                                                    searchRes.map((stock, idx) => (
                                                        <SearchRow
                                                            key={stock.scripCode}
                                                            stock={stock}
                                                            isTop={idx === 0}
                                                            isInList={isInWatchlist(stock.scripCode)}
                                                            onToggle={() => {
                                                                if (!isInWatchlist(stock.scripCode)) {
                                                                    handleAdd(stock, groups[0]?.id || 'default')
                                                                } else {
                                                                    remove(stock.scripCode)
                                                                }
                                                            }}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        ) : (
                                            /* Empty State */
                                            <div className="space-y-8 mt-2">
                                                {/* Recent (Mock using existing items) */}
                                                <div>
                                                    <h4 className="text-[13px] text-[#6B7280] font-medium tracking-[0.05em] mb-2">RECENT</h4>
                                                    {items.length > 0 ? (
                                                        items.slice().reverse().slice(0, 3).map(stock => (
                                                            <SearchRow
                                                                key={stock.scripCode}
                                                                stock={stock}
                                                                isInList={isInWatchlist(stock.scripCode)}
                                                                onToggle={() => {
                                                                    if (!isInWatchlist(stock.scripCode)) {
                                                                        handleAdd(stock, groups[0]?.id || 'default')
                                                                    } else {
                                                                        remove(stock.scripCode)
                                                                    }
                                                                }}
                                                            />
                                                        ))
                                                    ) : (
                                                        <p className="text-[14px] text-[#6B7280] py-2">No recent searches</p>
                                                    )}
                                                </div>

                                                {/* Popular */}
                                                <div>
                                                    <h4 className="text-[13px] text-[#6B7280] font-medium tracking-[0.05em] mb-2">POPULAR</h4>
                                                    {POPULAR_MOCKS.map(stock => (
                                                        <SearchRow
                                                            key={stock.scripCode}
                                                            stock={stock}
                                                            isInList={isInWatchlist(stock.scripCode)}
                                                            onToggle={() => {
                                                                if (!isInWatchlist(stock.scripCode)) {
                                                                    handleAdd(stock, groups[0]?.id || 'default')
                                                                } else {
                                                                    remove(stock.scripCode)
                                                                }
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rightPanel === 'assign' && assigningStock && (
                                <div className="flex-1 flex flex-col bg-[#07090C] text-white">
                                    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#0E1318]">
                                        <button onClick={() => setRightPanel('search')}
                                            className="text-[#5D6574] hover:text-[#A3ACBE] transition-colors">
                                            <ArrowLeft className="w-4 h-4" />
                                        </button>
                                        <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0", stockColor(assigningStock.symbol))}>
                                            {assigningStock.symbol.slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="text-[13.5px] font-semibold text-[#F4F7FD]">{assigningStock.symbol}</p>
                                            <p className="text-[11px] text-[#5D6574] truncate">{assigningStock.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-4">
                                        <p className="text-[10px] font-semibold text-[#3A4050] uppercase tracking-wider mb-3">Add to watchlist</p>
                                        {groups.map(g => (
                                            <button key={g.id}
                                                onClick={() => handleAdd(assigningStock, g.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-[#1A1F26] transition-all mb-1.5">
                                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                                                <span className="text-[13.5px] font-medium text-[#F4F7FD] flex-1 text-left">{g.name}</span>
                                                <span className="text-[11px] text-[#3A4050]">{(groupedItems[g.id] || []).length}</span>
                                                {groupedItems[g.id]?.some(i => i.scripCode === assigningStock.scripCode) && (
                                                    <Check className="w-3.5 h-3.5 text-[#2A3040]" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ══ Group Create Modal ══ */}
            <AnimatePresence>
                {
                    showGroupModal && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm"
                            onClick={() => setShowGroupModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                className="bg-[#0C0F14] border border-[#1A1F26] rounded-2xl p-6 w-80 shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            >
                                <h3 className="text-[15px] font-semibold text-[#F4F7FD] mb-1">New watchlist</h3>
                                <p className="text-[11.5px] text-[#5D6574] mb-5">Organise stocks by strategy or sector</p>
                                <input
                                    autoFocus type="text"
                                    placeholder="e.g. Tech bets, 401(k), Swing trades…"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim()) { const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']; createWatchlistGroup(newGroupName.trim(), colors[groups.length % colors.length]); setNewGroupName(""); setShowGroupModal(false) } }}
                                    className="w-full px-4 py-3 bg-[#070A0E] border border-[#1C2430] rounded-xl text-[13px] text-[#F4F7FD] placeholder-[#3A4050] outline-none focus:border-[#F68D3C]/40 transition-colors mb-4"
                                />
                                <div className="flex gap-2.5">
                                    <button onClick={() => setShowGroupModal(false)}
                                        className="flex-1 py-2.5 rounded-xl text-[13px] text-[#5D6574] hover:text-[#A3ACBE] border border-[#1A1F26] hover:bg-white/[0.04] transition-all">
                                        Cancel
                                    </button>
                                    <button
                                        disabled={!newGroupName.trim()}
                                        onClick={() => { const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']; createWatchlistGroup(newGroupName.trim(), colors[groups.length % colors.length]); setNewGroupName(""); setShowGroupModal(false) }}
                                        className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#F68D3C] text-black hover:bg-[#F5A060] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        Create
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

            {/* ══ Hover Card Portal ══ */}
            {
                hoveredItem && (
                    <WatchlistHoverCard
                        item={hoveredItem.item}
                        currentPrice={quotes[hoveredItem.item.scripCode]?.price ?? 0}
                        anchorRef={{ current: hoveredItem.ref }}
                        onMouseEnter={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                        }}
                        onMouseLeave={handleLeave}
                    />
                )
            }
        </div >
    )
}
