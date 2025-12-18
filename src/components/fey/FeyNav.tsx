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
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-1 px-4 py-3 bg-zinc-900/60 backdrop-blur-2xl border border-zinc-800/50 rounded-full shadow-2xl transition-all duration-300">
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
    </nav>
  )
}

function NavButton({ icon: Icon, label, href, isActive }: NavItem & { isActive: boolean }) {
  return (
    <Link href={href}>
      <button
        className={`group relative p-3 rounded-full
          transition-all duration-300
          hover:scale-110 active:scale-95
          ${isActive ? 'bg-cyan-500/20 border border-cyan-500/30' : 'hover:bg-zinc-800/50'}`}
        aria-label={label}
      >
        <Icon className={`w-5 h-5 transition-colors duration-300
          ${isActive ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-white'}`} />
        
        {/* Tooltip */}
        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          {label}
        </span>
      </button>
    </Link>
  )
}

