"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LightweightChart } from "@/components/lightweight-chart"
import { useWhaleDeals } from "@/hooks/useWhaleDeals"
import type { BSEAnnouncement } from "@/lib/bse/types"
import type { WatchlistItem } from "@/lib/storage"
import { Loader2 } from "lucide-react"
import { AnimatedPrice } from "@/components/ui/animated-price"

interface WatchlistHoverCardProps {
    item: WatchlistItem
    currentPrice: number
    anchorRef: React.RefObject<HTMLDivElement>
    onMouseEnter: () => void
    onMouseLeave: () => void
}

export function WatchlistHoverCard({ item, currentPrice, anchorRef, onMouseEnter, onMouseLeave }: WatchlistHoverCardProps) {
    const [announcements, setAnnouncements] = useState<BSEAnnouncement[]>([])
    const { deals: whaleDeals, loading: dealsLoading } = useWhaleDeals(item.scripCode)
    const [loadingAnns, setLoadingAnns] = useState(true)
    const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null)

    // Fetch announcements
    useEffect(() => {
        let mounted = true
        setLoadingAnns(true)
        fetch(`/api/bse/announcements?scripCode=${item.scripCode}&days=180`)
            .then(r => r.json())
            .then(d => {
                if (mounted) {
                    setAnnouncements(d.announcements || [])
                    setLoadingAnns(false)
                }
            })
            .catch(() => { if (mounted) setLoadingAnns(false) })
        return () => { mounted = false }
    }, [item.scripCode])

    // Calculate position (not used anymore for centered modal, but left space for future)
    useEffect(() => {
        if (!anchorRef.current) return
    }, [anchorRef])

    const isLoading = loadingAnns || dealsLoading
    const displayPrice = crosshairPrice !== null ? crosshairPrice : currentPrice

    return (
        <AnimatePresence>
            {/* Full-screen backdrop (pointer events none so it doesn't trap you without clicking, 
                except we want the hover intent to be protected, so it shares the mouse events) */}
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[12px] pointer-events-none"
            />

            <div key="modal-container" className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="bg-[#060608]/95 backdrop-blur-[40px] border border-white/[0.08] rounded-[24px] overflow-hidden flex flex-col pointer-events-auto relative"
                    style={{
                        width: 650,
                        height: 480,
                        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.06)'
                    }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                >
                    {/* Subtle internal gradient glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-white/[0.02] blur-[40px] pointer-events-none mix-blend-screen" />
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05] bg-transparent relative z-10">
                        <div className="flex flex-col">
                            <h3 className="text-[14px] font-semibold text-[#a1a1aa] tracking-tight">{item.symbol}</h3>
                            <div className="flex items-center text-[32px] font-medium text-white tracking-tight leading-none mt-1">
                                <span className="mr-1 opacity-60">₹</span>
                                <AnimatedPrice value={displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                            </div>
                        </div>
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-[12px] font-medium text-[#a1a1aa] bg-white/5 px-4 py-2 rounded-full">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Charting...
                            </div>
                        ) : (
                            <div className="flex gap-1.5">
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-md border border-[#10b981]/20">
                                    {whaleDeals.length} Deals
                                </span>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#06b6d4] bg-[#06b6d4]/10 px-2 py-1 rounded-md border border-[#06b6d4]/20">
                                    {announcements.length} Anns
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 relative bg-transparent">
                        <LightweightChart
                            symbol={item.symbol}
                            scripCode={item.scripCode}
                            height={380}
                            theme="dark"
                            showControls={false}
                            showSma={true}
                            announcements={announcements}
                            whaleDeals={whaleDeals}
                            onCrosshairMove={setCrosshairPrice}
                        />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
