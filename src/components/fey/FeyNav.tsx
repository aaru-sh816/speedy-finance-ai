"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, 
  TrendingUp, 
  Calendar, 
  FileText, 
  BarChart3
} from "lucide-react"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: TrendingUp, label: "Market", href: "/market" },
  { icon: Calendar, label: "Announcements", href: "/announcements" },
  { icon: FileText, label: "Bulk Deals", href: "/bulk-deals" },
  { icon: BarChart3, label: "Corporate Actions", href: "/corporate-actions" },
]

export function FeyNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed md:fixed top-auto bottom-6 md:top-2 md:bottom-auto w-full z-[100] animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-top-4 duration-1000 md:py-0 pointer-events-none">
      <div className="flex items-center justify-center pointer-events-auto px-4">
        <div className="flex items-center gap-1.5 p-1 md:p-1.5 bg-zinc-950/80 backdrop-blur-3xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700 hover:border-white/20">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <NavButton
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={isActive}
            />
          )
          })}
        </div>
      </div>
    </nav>
  )
}

function NavButton({ icon: Icon, label, href, isActive }: NavItem & { isActive: boolean }) {
  return (
    <Link href={href}>
      <button
        className={`group relative p-2.5 md:p-3 rounded-full
          transition-all duration-500
          hover:scale-110 active:scale-90
          ${isActive ? 'bg-cyan-500/20 border border-cyan-500/30' : 'hover:bg-zinc-800/50'}`}
        aria-label={label}
      >
        <Icon className={`w-4 h-4 md:w-5 md:h-5 transition-all duration-500
          ${isActive ? 'text-cyan-400 scale-110' : 'text-zinc-400 group-hover:text-white'}`} />
        
        {/* Tooltip - Responsive positioning */}
        <span className="absolute bottom-full md:bottom-auto md:-bottom-12 left-1/2 -translate-x-1/2 mb-3 md:mb-0 px-2 py-1 rounded-lg bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-[10px] md:text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-1 group-hover:translate-y-0">
          {label}
        </span>
      </button>
    </Link>
  )
}

