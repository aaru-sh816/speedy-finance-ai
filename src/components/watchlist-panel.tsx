"use client"

import React, { useSyncExternalStore, useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { Plus, X, Search, BarChart2, Bookmark, Edit2, Trash2 } from "lucide-react"
import { clsx } from "clsx"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, useDroppable
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWatchlist } from "@/hooks/useWatchlist"
import {
  getWatchlistGroups, addToWatchlist, removeFromWatchlist, isInWatchlist,
  deleteWatchlistGroup, updateWatchlistGroup, saveWatchlist, getWatchlist,
  type WatchlistItem, type WatchlistGroup
} from "@/lib/storage"
import { watchlistPanelStore } from "@/lib/watchlist-panel-store"
import { Sparkline } from "@/components/ui/sparkline"

// ── Sparkline cache ────────────────────────────────────────────────
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
  // seeded fallback
  const seed = scripCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const fake = Array.from({ length: 20 }, (_, i) =>
    100 + Math.sin(i * 0.5 + seed) * 8 + (i / 20) * 10 + Math.sin(i * 1.3) * 3
  )
  sparkCache[scripCode] = fake
  return fake
}

// ── Helpers ────────────────────────────────────────────────────────
function stockColor(t: string) {
  const c = ["bg-blue-500", "bg-emerald-500", "bg-red-500", "bg-orange-400", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-pink-500", "bg-amber-500", "bg-indigo-500"]
  let h = 0; for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
const fINR = (v: number, d = 2) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: d })}`

const POPULAR = [
  { scripCode: '500325', symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { scripCode: '532540', symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
  { scripCode: '500180', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { scripCode: '532174', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { scripCode: '500209', symbol: 'INFY', name: 'Infosys Ltd' },
  { scripCode: '500228', symbol: 'JSWSTEEL', name: 'JSW Steel Ltd' },
]

// ── Stock Logo ─────────────────────────────────────────────────────
function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false)
  const color = stockColor(symbol)
  return (
    <div
      className={clsx("rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden relative", color)}
      style={{ width: 28, height: 28 }}
    >
      <span className="absolute z-0 text-[9px] font-bold text-white select-none">{symbol.slice(0, 2)}</span>
      {!failed && (
        <img
          src={`https://financialmodelingprep.com/image-stock/${symbol}.NS.png`}
          alt={symbol}
          className="w-full h-full object-cover relative z-10 bg-white"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

// ── Custom SVG icons (matching Fey exactly) ────────────────────────
function IconNewList() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="1" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function IconSort() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L5 12M5 12L3 10M5 12L7 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12L10 3M10 3L8 5M10 3L12 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconUndock() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// ── Compact Stock Row (Fey spec) ───────────────────────────────────
function PanelStockRow({ item, quote, sparkData, onRemove, isDragging, dragProps }: {
  item: WatchlistItem
  quote?: { price: number; changePercent: number; change: number; isLoading?: boolean }
  sparkData: number[]
  onRemove: (sc: string) => void
  isDragging?: boolean
  dragProps?: Record<string, any>
}) {
  const router = useRouter()
  const price = quote?.price ?? 0
  const pct = quote?.changePercent ?? 0
  const isPos = pct >= 0
  const loading = quote?.isLoading ?? false

  return (
    <div
      {...dragProps}
      onClick={() => router.push(`/company/${item.scripCode}`)}
      className={clsx(
        "group cursor-pointer transition-colors active:cursor-grabbing",
        isDragging && "opacity-30 scale-95"
      )}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div
        className="grid items-center group-hover:bg-white/[0.05] transition-colors rounded-sm"
        style={{
          gridTemplateColumns: '32px 1fr 68px auto',
          gap: '0 10px',
          padding: '10px 16px',
        }}
      >
        {/* Logo */}
        <StockLogo symbol={item.symbol} />

        {/* Ticker + Name */}
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-white tracking-tight leading-none truncate">{item.symbol}</div>
          <div className="text-[12px] font-normal text-[#6B7280] truncate mt-[3px] leading-none">{item.name}</div>
        </div>

        {/* Sparkline */}
        <div className="flex items-center justify-center px-1 py-0.5">
          {sparkData.length >= 2 ? (
            <Sparkline data={sparkData} width={64} height={26} showDot={false} />
          ) : (
            <div className="w-[64px] h-[26px] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full border border-[#3A4050] border-t-transparent animate-spin" />
            </div>
          )}
        </div>

        {/* Price + % Pill stacked */}
        <div className="flex flex-col items-end gap-[3px]">
          <div className="text-[13px] text-white tabular-nums font-medium leading-none">
            {loading ? <span className="text-[#3A4050] animate-pulse">—</span> : price > 0 ? fINR(price) : '—'}
          </div>
          <div
            className={clsx(
              "text-center font-semibold tabular-nums leading-none",
              isPos ? "bg-[#14532D] text-[#4ADE80]" : "bg-[#450A0A] text-[#F87171]"
            )}
            style={{ fontSize: '10.5px', borderRadius: '3px', padding: '2px 5px', minWidth: '46px' }}
          >
            {loading || pct === 0 ? '—' : `${isPos ? '+' : ''}${pct.toFixed(2)}%`}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Drag & Drop Components ─────────────────────────────────────────
function DroppableGroup({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${id}` })
  return (
    <div ref={setNodeRef} className={clsx(className, isOver && "bg-white/[0.02] rounded-xl transition-colors ring-1 ring-white/[0.05]")}>
      {children}
    </div>
  )
}

function SortableRow({ item, quote, sparkData, onRemove, activeDragId }: {
  item: WatchlistItem
  quote?: any
  sparkData: number[]
  onRemove: (sc: string) => void
  activeDragId: string | null
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
      <PanelStockRow
        item={item} quote={quote} sparkData={sparkData} onRemove={onRemove}
        isDragging={activeDragId === dndId && !isDragging ? false : isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ── Search Row (matches full FeyWatchlist search overlay) ──────────
function PanelSearchRow({ stock, isInList, onToggle }: {
  stock: { scripCode: string; symbol: string; name: string }
  isInList: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/company/${stock.scripCode}`)}
      className="flex items-center gap-3 py-4 cursor-pointer border-b border-white/5 hover:bg-white/[0.03] transition-colors"
    >
      {/* Logo */}
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
        <span className="text-[13px] font-normal text-[#6B7280] truncate leading-none">{stock.name}</span>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
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

// ── Section Label ──────────────────────────────────────────────────
function SectionLabel({ name }: { name: string }) {
  return (
    <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}>
      {name}
    </div>
  )
}

// ── Header Icon Button ─────────────────────────────────────────────
function IconBtn({ onClick, title, children }: { onClick?: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative group flex items-center justify-center rounded-[6px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all"
      style={{ width: 28, height: 28 }}
    >
      {children}
      {title && (
        <span className="absolute top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-black/90 border border-white/5 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {title}
        </span>
      )}
    </button>
  )
}

// ── Main Global Watchlist Panel ────────────────────────────────────
export function WatchlistPanel() {
  const isOpen = useSyncExternalStore(
    watchlistPanelStore.subscribe,
    watchlistPanelStore.getSnapshot,
    () => false
  )

  const { items, quotes, add, remove } = useWatchlist(60000)
  const [groups, setGroups] = useState<WatchlistGroup[]>([])
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [searchMode, setSearchMode] = useState(false)
  const [sortMode, setSortMode] = useState<'default' | 'change' | 'price'>('default')
  const [searchQ, setSearchQ] = useState("")
  const [searchRes, setSearchRes] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Drag & drop logic
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

    if (toId.startsWith('row-')) {
      const toSc = toId.replace('row-', '')
      const ti = newAll.findIndex(i => i.scripCode === toSc)
      if (ti >= 0) {
        targetGroupId = newAll[ti].groupId
        newAll[fi].groupId = targetGroupId
        const reordered = arrayMove(newAll, fi, ti).map((it, idx) => ({ ...it, order: idx }))
        saveWatchlist(reordered)
        setSortMode('default')
        return
      }
    } 
    
    if (toId.startsWith('group-')) {
      targetGroupId = toId.replace('group-', '')
      newAll[fi].groupId = targetGroupId
      saveWatchlist(newAll)
      setSortMode('default')
      return
    }
  }

  // Sync groups
  useEffect(() => {
    setGroups(getWatchlistGroups())
    const h = () => setGroups(getWatchlistGroups())
    window.addEventListener('watchlist-groups-updated', h)
    return () => window.removeEventListener('watchlist-groups-updated', h)
  }, [])

  // Fetch sparklines whenever items change
  useEffect(() => {
    items.forEach(item => {
      if (!sparklines[item.scripCode]) {
        fetchSpark(item.scripCode).then(data =>
          setSparklines(prev => ({ ...prev, [item.scripCode]: data }))
        )
      }
    })
  }, [items])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchMode) { setSearchMode(false); setSearchQ("") }
        else watchlistPanelStore.close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchMode])

  useEffect(() => {
    if (searchMode) { setTimeout(() => inputRef.current?.focus(), 80) }
    else { setSearchQ(""); setSearchRes([]) }
  }, [searchMode])

  // Close panel → reset search mode
  useEffect(() => { if (!isOpen) { setSearchMode(false); setSearchQ("") } }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!searchQ.trim()) { setSearchRes([]); setIsSearching(false); return }
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/bse/search?q=${encodeURIComponent(searchQ)}`)
        if (r.ok) {
          const d = await r.json()
          setSearchRes((d.results || []).slice(0, 20).map((s: any) => ({
            scripCode: s.scripCode || '',
            symbol: s.symbol,
            name: s.name || s.symbol,
          })))
        }
      } catch { }
      setIsSearching(false)
    }, 220)
    return () => clearTimeout(t)
  }, [searchQ])

  const checkInList = (sc: string) => isInWatchlist(sc)
  const handleToggle = (stock: { scripCode: string; symbol: string; name: string }) => {
    if (checkInList(stock.scripCode)) remove(stock.scripCode)
    else add({ scripCode: stock.scripCode, symbol: stock.symbol, name: stock.name })
  }

  // Group and sort items
  let groupedItems = groups.length > 0
    ? groups.map(g => ({ 
        group: g, 
        stocks: items.filter(it => (it.groupId || 'default') === g.id) 
      })).filter(g => g.stocks.length > 0)
    : [{ group: null as WatchlistGroup | null, stocks: items }]

  if (sortMode !== 'default') {
    groupedItems = groupedItems.map(g => ({
      ...g,
      stocks: [...g.stocks].sort((a, b) => {
        const qa = quotes[a.scripCode];
        const qb = quotes[b.scripCode];
        if (sortMode === 'change') return (qb?.changePercent || 0) - (qa?.changePercent || 0);
        if (sortMode === 'price') return (qb?.price || 0) - (qa?.price || 0);
        return 0;
      })
    }))
  }

  const hasItems = items.length > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop */}
          <motion.div
            key="panel-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[48] bg-black/25"
            onClick={() => watchlistPanelStore.close()}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: 380, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 36, mass: 0.85 }}
            className="fixed right-0 top-0 bottom-0 z-[49] flex flex-col"
            style={{
              width: 380,
              background: '#0D0D0D',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────── */}
            <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '20px 16px 16px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.3px', lineHeight: 1 }}>
                Watchlist
              </h2>
              <div className="flex items-center" style={{ gap: 4 }}>
                <IconBtn onClick={() => setSearchMode(true)} title="Add symbol">
                  <Plus size={15} strokeWidth={1.5} />
                </IconBtn>
                <IconBtn title="New list">
                  <IconNewList />
                </IconBtn>
                <IconBtn
                  onClick={() => setSortMode(s => s === 'default' ? 'change' : s === 'change' ? 'price' : 'default')}
                  title={`Sort: ${sortMode}`}
                >
                  <IconSort />
                  {sortMode !== 'default' && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />
                  )}
                </IconBtn>
                <IconBtn onClick={() => { watchlistPanelStore.close(); window.location.href = '/watchlist' }} title="Full view">
                  <IconUndock />
                </IconBtn>
              </div>
            </div>

            {/* ── Content ─────────────────────────────── */}
            <AnimatePresence mode="wait">
              {searchMode ? (

                /* ── SEARCH MODE (matches FeyWatchlist overlay exactly) ── */
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  {/* Bare input + Done button */}
                  <div
                    className="flex items-center flex-shrink-0"
                    style={{ padding: '0 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search symbols"
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-white placeholder-[#4B5563] caret-blue-400"
                      style={{ fontSize: 20, fontWeight: 400 }}
                    />
                    <button
                      onClick={() => setSearchMode(false)}
                      className="flex-shrink-0 text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                      style={{ fontSize: 15, fontWeight: 500, marginLeft: 12 }}
                    >
                      Done
                    </button>
                  </div>

                  {/* Results */}
                  <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px 16px' }}>
                    {isSearching ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="w-5 h-5 rounded-full border-2 border-[#3A4050] border-t-[#3B82F6] animate-spin" />
                      </div>
                    ) : searchQ.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>RESULTS</div>
                        {searchRes.length === 0 ? (
                          <p style={{ fontSize: 14, color: '#6B7280', paddingTop: 16 }}>No results found.</p>
                        ) : searchRes.map((s, idx) => (
                          <PanelSearchRow
                            key={s.scripCode || s.symbol}
                            stock={s}
                            isInList={checkInList(s.scripCode)}
                            onToggle={() => handleToggle(s)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
                        {items.length > 0 && (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>RECENT</div>
                            {items.slice().reverse().slice(0, 3).map(s => (
                              <PanelSearchRow
                                key={s.scripCode}
                                stock={s}
                                isInList={checkInList(s.scripCode)}
                                onToggle={() => handleToggle(s)}
                              />
                            ))}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6 }}>POPULAR</div>
                          {POPULAR.map(s => (
                            <PanelSearchRow
                              key={s.scripCode}
                              stock={s}
                              isInList={checkInList(s.scripCode)}
                              onToggle={() => handleToggle(s)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

              ) : (

                /* ── STOCK LIST ─────────────────────────── */
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex-1 overflow-y-auto min-h-0"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: '#1A1F26 transparent' }}
                >
                  {!hasItems ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center" style={{ padding: '0 24px 60px' }}>
                      <div className="w-14 h-14 rounded-2xl bg-[#0C0F14] border border-[#1A1F26] flex items-center justify-center">
                        <BarChart2 className="w-6 h-6 text-[#3A4050]" />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#5D6574' }}>Your watchlist is empty</p>
                        <p style={{ fontSize: 12, color: '#3A4050', marginTop: 4 }}>Search any BSE/NSE stock to start tracking</p>
                      </div>
                      <button
                        onClick={() => setSearchMode(true)}
                        className="flex items-center gap-2 transition-all"
                        style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)', fontSize: 13, fontWeight: 500 }}
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
                      {groupedItems.map(({ group, stocks }, gIdx) => (
                        <DroppableGroup key={group?.id ?? 'default'} id={group?.id ?? 'default'}>
                          {/* Section label & Editing */}
                          <div className="flex items-center justify-between group/header hover:bg-white/[0.02] rounded px-1 -mx-1" style={{ margin: '4px 12px 2px', padding: '6px 4px' }}>
                            {editingGroupId === (group?.id ?? 'default') ? (
                              <input
                                autoFocus
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onBlur={() => handleRenameGroup(group?.id ?? 'default', editName)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameGroup(group?.id ?? 'default', editName)
                                  if (e.key === 'Escape') setEditingGroupId(null)
                                }}
                                className="bg-transparent border-b border-orange-500/50 outline-none text-[11px] font-bold text-white uppercase tracking-widest w-32"
                              />
                            ) : (
                              <div 
                                onClick={() => { if (group?.id && group.id !== 'default') { setEditingGroupId(group.id); setEditName(group.name) } }}
                                className={clsx("transition-colors", group?.id && group.id !== 'default' ? "cursor-text hover:text-white" : "")}
                                style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}
                              >
                                {group?.name ?? 'Holdings'}
                              </div>
                            )}

                            {group?.id && group.id !== 'default' && (
                              <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => { setEditingGroupId(group.id); setEditName(group.name) }}
                                  className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-white"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteGroup(group.id)}
                                  className="p-1 hover:bg-rose-500/10 rounded text-zinc-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Rows */}
                          <SortableContext items={stocks.map(i => `row-${i.scripCode}`)} strategy={verticalListSortingStrategy}>
                            {stocks.map(item => (
                              <SortableRow
                                key={item.scripCode}
                                item={item}
                                quote={quotes[item.scripCode]}
                                sparkData={sparklines[item.scripCode] ?? []}
                                onRemove={remove}
                                activeDragId={activeDragId}
                              />
                            ))}
                          </SortableContext>
                          {stocks.length === 0 && groups.length > 1 && (
                            <div className="text-[11px] text-[#3A4050] px-3 py-4 mt-1 border border-dashed border-[#1A1F26] rounded flex items-center justify-center bg-white/[0.01]">
                                Drop stocks here
                            </div>
                          )}
                        </DroppableGroup>
                      ))}
                      <DragOverlay>
                        {activeDragId && (() => {
                          const sc = activeDragId.replace('row-', '')
                          const item = items.find(i => i.scripCode === sc)
                          if (!item) return null
                          return (
                            <div className="opacity-90 shadow-2xl ring-1 ring-white/10 rounded overflow-hidden">
                              <PanelStockRow
                                item={item}
                                quote={quotes[item.scripCode]}
                                sparkData={sparklines[item.scripCode] || []}
                                onRemove={() => {}}
                              />
                            </div>
                          )
                        })()}
                      </DragOverlay>
                    </DndContext>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
