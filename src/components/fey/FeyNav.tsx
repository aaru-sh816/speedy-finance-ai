"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Home, 
  Compass,
  Calendar,
  Bookmark,
  LineChart,
  PieChart,
  Search,
  StickyNote
} from "lucide-react"
import { MarketStatusBadge } from "@/components/market-status-badge"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: PieChart, label: "Portfolio", href: "/portfolio" },
  { icon: Compass, label: "Market", href: "/market" },
  { icon: Calendar, label: "Announcements", href: "/announcements" },
  { icon: Bookmark, label: "Bulk Deals", href: "/bulk-deals" },
  { icon: LineChart, label: "Corporate Actions", href: "/corporate-actions" },
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

  return (
    <nav className="fixed top-4 sm:top-8 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[100] flex items-center justify-center gap-2 sm:gap-4 pointer-events-none overflow-x-auto overflow-y-hidden py-2 sm:py-0" suppressHydrationWarning>
      {/* Main Navigation Pill - scrollable on mobile */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-full pointer-events-auto bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px] shadow-[inset_1.25px_1.25px_1.25px_rgba(255,255,255,0.06),inset_1.25px_-1.25px_1.25px_rgba(255,255,255,0.02),0_43px_43px_rgba(0,0,0,0.85)] border border-white/5 flex-shrink-0 overflow-x-auto overflow-y-hidden max-w-full" suppressHydrationWarning>
        
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

      {/* Market status badge */}
      <div className="pointer-events-auto flex items-center">
        <MarketStatusBadge />
      </div>

      {/* Separate Search "Satellite" */}
      <button className="w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto bg-[linear-gradient(180deg,rgba(20,20,22,0.85)_0%,rgba(10,10,12,0.85)_100%)] backdrop-blur-[21px] shadow-[inset_1.25px_1.25px_1.25px_rgba(255,255,255,0.06),inset_1.25px_-1.25px_1.25px_rgba(255,255,255,0.02),0_10px_30px_rgba(0,0,0,0.6)] border border-white/5 hover:scale-110 active:scale-95 transition-all duration-300 group" suppressHydrationWarning>
        <Search className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" strokeWidth={1.5} />
      </button>
    </nav>
  )
}

