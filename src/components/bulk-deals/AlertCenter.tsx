"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Bell, BellRing, X, Check, CheckCheck, Trash2, 
  TrendingUp, TrendingDown, Flame, Settings, UserPlus
} from "lucide-react"
import {
  getAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead, clearAlerts,
  type InvestorAlert
} from "@/lib/bulk-deals/alertSystem"

function clsx(...v: (string | false | undefined)[]) { 
  return v.filter(Boolean).join(" ") 
}

function rupeeCompact(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  return `₹${v.toLocaleString("en-IN")}`
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

interface AlertCenterProps {
  onFollowClick?: () => void
}

export function AlertCenter({ onFollowClick }: AlertCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [alerts, setAlerts] = useState<InvestorAlert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const loadAlerts = () => {
      setAlerts(getAlerts().reverse()) // Most recent first
      setUnreadCount(getUnreadAlertCount())
    }
    loadAlerts()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkRead = (alertId: string) => {
    markAlertRead(alertId)
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = () => {
    markAllAlertsRead()
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    setUnreadCount(0)
  }

  const handleClearAll = () => {
    clearAlerts()
    setAlerts([])
    setUnreadCount(0)
  }

  const getAlertIcon = (type: InvestorAlert["type"]) => {
    switch (type) {
      case "buy": return <TrendingUp className="h-4 w-4 text-emerald-400" />
      case "sell": return <TrendingDown className="h-4 w-4 text-rose-400" />
      case "big_deal": return <Flame className="h-4 w-4 text-amber-400" />
    }
  }

  const getAlertColor = (type: InvestorAlert["type"]) => {
    switch (type) {
      case "buy": return "border-emerald-500/20 bg-emerald-500/5"
      case "sell": return "border-rose-500/20 bg-rose-500/5"
      case "big_deal": return "border-amber-500/20 bg-amber-500/5"
    }
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "relative p-2 rounded-xl transition-all",
          isOpen 
            ? "bg-cyan-500/20 text-cyan-400" 
            : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 animate-pulse" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Alert Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyan-400" />
                <h3 className="font-semibold text-white">Alerts</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                {alerts.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Alert List */}
            <div className="max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm mb-2">No alerts yet</p>
                  <p className="text-zinc-500 text-xs mb-4">
                    Follow investors to get notified when they make deals
                  </p>
                  {onFollowClick && (
                    <button
                      onClick={onFollowClick}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <UserPlus className="h-4 w-4" />
                      Follow Investors
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={clsx(
                        "p-4 hover:bg-white/5 transition-colors cursor-pointer",
                        !alert.read && "bg-cyan-500/5"
                      )}
                      onClick={() => handleMarkRead(alert.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={clsx(
                          "p-2 rounded-lg border",
                          getAlertColor(alert.type)
                        )}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm truncate">
                              {alert.investorName.split(' ').slice(0, 2).join(' ')}
                            </span>
                            {!alert.read && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mb-1">
                            {alert.type === "big_deal" ? "🔥 BIG " : ""}
                            {alert.type === "buy" ? "Bought" : alert.type === "sell" ? "Sold" : "Bought"}{" "}
                            <Link 
                              href={`/bulk-deals/company/${alert.scripCode}`}
                              className="text-cyan-400 hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {alert.stockName}
                            </Link>
                          </p>
                          <div className="flex items-center justify-between">
                            <span className={clsx(
                              "text-xs font-semibold",
                              alert.type === "buy" || alert.type === "big_deal" ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {rupeeCompact(alert.value)}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {timeAgo(alert.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-zinc-800/50">
                <Link
                  href="/bulk-deals?tab=alerts"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  View all activity →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
