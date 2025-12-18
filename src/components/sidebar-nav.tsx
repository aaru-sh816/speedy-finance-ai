"use client"

import { useState, useEffect } from "react"
import { Megaphone, FileText, Calendar, Printer, Bell, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

interface NavItem {
  id: string
  icon: React.ElementType
  label: string
  href?: string
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { id: "announcements", icon: Megaphone, label: "Today", href: "/announcements", badge: undefined },
  { id: "documents", icon: FileText, label: "Documents", href: "/documents" },
  { id: "calendar", icon: Calendar, label: "Calendar", href: "/calendar" },
  { id: "alerts", icon: Bell, label: "Alerts", href: "/alerts" },
  { id: "print", icon: Printer, label: "Print", href: "#" },
]

interface SidebarNavProps {
  activeId?: string
  newCount?: number
  onCollapseChange?: (collapsed: boolean) => void
}

const SIDEBAR_COLLAPSED_KEY = "speedy-sidebar-collapsed"

export function SidebarNav({ activeId = "announcements", newCount, onCollapseChange }: SidebarNavProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load collapsed state from localStorage
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved === "true") {
      setCollapsed(true)
      onCollapseChange?.(true)
    }
  }, [onCollapseChange])

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState))
    onCollapseChange?.(newState)
  }

  return (
    <>
      {/* Sidebar */}
      <nav 
        className={`fixed left-0 top-0 h-full glass-sidebar flex flex-col items-center py-4 z-40 transition-all duration-300 ease-in-out ${
          collapsed ? "w-0 -translate-x-full" : "w-16"
        }`}
      >
      {/* Logo */}
      <div className="mb-8 relative">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        {newCount !== undefined && newCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
            {newCount > 9 ? "9+" : newCount}
          </span>
        )}
      </div>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeId === item.id
          const isHovered = hoveredId === item.id

          return (
            <Link
              key={item.id}
              href={item.href || "#"}
              className="relative group"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className={`
                  w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                  ${isActive 
                    ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30" 
                    : "hover:bg-white/10"
                  }
                `}
              >
                <Icon 
                  className={`h-5 w-5 transition-colors ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`} 
                />
              </div>

              {/* Tooltip */}
              <div
                className={`
                  absolute left-14 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg 
                  bg-zinc-900 text-white text-sm font-medium whitespace-nowrap
                  transition-all duration-200 pointer-events-none
                  ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}
                `}
              >
                {item.label}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-zinc-900 rotate-45" />
              </div>

              {/* Badge */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom indicator */}
      <div className="mt-auto">
        <div className="w-8 h-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
      </div>
    </nav>

      {/* Slide Toggle Button - Always visible */}
      {mounted && (
        <button
          onClick={toggleCollapse}
          className={`fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center transition-all duration-300 ease-in-out group ${
            collapsed ? "left-0" : "left-14"
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="relative">
            {/* Half-pill shape */}
            <div className={`h-12 w-6 rounded-r-full bg-zinc-800/90 border border-l-0 border-zinc-700/50 flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:bg-zinc-700/90 transition-all ${
              collapsed ? "translate-x-0" : ""
            }`}>
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
              )}
            </div>
          </div>
        </button>
      )}
    </>
  )
}
