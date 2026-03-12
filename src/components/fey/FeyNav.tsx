"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { motion } from "framer-motion"
import {
  Home,
  Compass,
  Calendar,
  Bookmark,
  StickyNote,
  LayoutList
} from "lucide-react"
import { watchlistPanelStore } from "@/lib/watchlist-panel-store"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Compass, label: "Market", href: "/market" },
  { icon: Calendar, label: "Announcements", href: "/announcements" },
  { icon: Bookmark, label: "Bulk Deals", href: "/bulk-deals" },
  { icon: StickyNote, label: "Notes", href: "/apple-notes" },
]

/**
 * Custom Calendar 31 Icon for Fey Aesthetic
 */
function Calendar31Icon({ className }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Calendar className="w-full h-full" strokeWidth={1.5} />
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-1.5">31</span>
    </div>
  )
}

export function FeyNav() {
  const pathname = usePathname()
  const isPanelOpen = useSyncExternalStore(
    watchlistPanelStore.subscribe,
    watchlistPanelStore.getSnapshot,
    () => false
  )

  // Removed the '/watchlist' guard here so the Nav bar is completely global

  return (
    <nav className="fixed top-4 sm:top-8 left-0 right-0 z-[100] flex items-center justify-center pointer-events-none" suppressHydrationWarning>
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Main Navigation Pill */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px] shadow-[inset_1.25px_1.25px_1.25px_rgba(255,255,255,0.06),inset_1.25px_-1.25px_1.25px_rgba(255,255,255,0.02),0_43px_43px_rgba(0,0,0,0.85)] border border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} suppressHydrationWarning>

          <style dangerouslySetInnerHTML={{ __html: `
            .group::-webkit-scrollbar { display: none; }
            div::-webkit-scrollbar { display: none; }
          `}} />

          {navItems.map((item) => {
            const isActive = pathname === item.href
            let Icon = item.icon

            if (item.label === "Announcements") Icon = Calendar31Icon

            return (
              <Link key={item.href} href={item.href} suppressHydrationWarning>
                <button suppressHydrationWarning
                  className="group relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
                  aria-label={item.label}
                >
                  {/* Active Fluid Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="fey-nav-indicator"
                      className="absolute inset-0 bg-white/[0.05] rounded-full shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  <Icon className={`w-5 h-5 transition-all duration-300 relative z-10 ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}
                    strokeWidth={isActive ? 2 : 1.5}
                    fill={isActive && item.label === "Home" ? "currentColor" : "none"}
                  />

                  {/* Tooltip */}
                  <span className="absolute top-14 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl bg-black/90 backdrop-blur-xl border border-white/5 text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none -translate-y-2 group-hover:translate-y-0">
                    {item.label}
                  </span>
                </button>
              </Link>
            )
          })}
        </div>

        {/* ── Watchlist Toggle Capsule ── */}
        <button
          onClick={() => watchlistPanelStore.toggle()}
          suppressHydrationWarning
          title="Watchlist"
          className={`group relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation
            bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px]
            shadow-[inset_1.25px_1.25px_1.25px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.6)]
            border border-white/5
            ${isPanelOpen ? 'text-white border-white/15 bg-white/[0.08]' : 'text-zinc-500 hover:text-zinc-300'}`}
          aria-label="Watchlist"
        >
          <LayoutList className="w-5 h-5 relative z-10" strokeWidth={isPanelOpen ? 2 : 1.5} />

          {/* Active dot */}
          {isPanelOpen && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_6px_#3B82F6]" />
          )}

          {/* Tooltip */}
          <span className="absolute top-14 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl bg-black/90 backdrop-blur-xl border border-white/5 text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none -translate-y-2 group-hover:translate-y-0">
            Watchlist
          </span>
        </button>
      </div>
    </nav>
  )
}
