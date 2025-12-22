"use client"

import { useState, useEffect } from "react"
import { UserPlus, UserMinus, Bell, BellOff, Check, Sparkles } from "lucide-react"
import { 
  followInvestor, unfollowInvestor, isFollowing, getFollowedInvestors,
  requestNotificationPermission, type FollowedInvestor
} from "@/lib/bulk-deals/alertSystem"

function clsx(...v: (string | false | undefined)[]) { 
  return v.filter(Boolean).join(" ") 
}

interface FollowButtonProps {
  investorName: string
  variant?: "default" | "compact" | "icon"
  className?: string
  onFollowChange?: (following: boolean) => void
}

export function FollowButton({ 
  investorName, 
  variant = "default",
  className = "",
  onFollowChange
}: FollowButtonProps) {
    const [following, setFollowing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [settings, setSettings] = useState<FollowedInvestor | null>(null)
    const [insights, setInsights] = useState<{ winRate: number; avgReturn: number; rank: number } | null>(null)

    useEffect(() => {
      const checkFollowing = () => {
        const isFollow = isFollowing(investorName)
        setFollowing(isFollow)
        if (isFollow) {
          const investors = getFollowedInvestors()
          const investor = investors.find(i => i.name.toLowerCase() === investorName.toLowerCase())
          setSettings(investor || null)
        }
      }
      checkFollowing()
      
      // Load mock insights for the "Genius" effect
      setInsights({
        winRate: 60 + Math.floor(Math.random() * 25),
        avgReturn: 12 + Math.floor(Math.random() * 40),
        rank: Math.floor(Math.random() * 50) + 1
      })
    }, [investorName])


  const handleFollow = async () => {
    if (following) {
      unfollowInvestor(investorName)
      setFollowing(false)
      setSettings(null)
      onFollowChange?.(false)
    } else {
      // Request notification permission
      await requestNotificationPermission()
      
      const investor = followInvestor(investorName)
      setFollowing(true)
      setSettings(investor)
      onFollowChange?.(true)
    }
  }

  const handleToggleSetting = (setting: 'notifyOnBuy' | 'notifyOnSell' | 'notifyOnBigDeal') => {
    if (!settings) return
    
    const updated = followInvestor(investorName, {
      ...settings,
      [setting]: !settings[setting]
    })
    setSettings(updated)
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleFollow}
        className={clsx(
          "p-2 rounded-lg transition-all",
          following
            ? "bg-cyan-500/20 text-cyan-400 hover:bg-rose-500/20 hover:text-rose-400"
            : "bg-white/5 text-zinc-400 hover:bg-cyan-500/20 hover:text-cyan-400",
          className
        )}
        title={following ? "Unfollow" : "Follow"}
      >
        {following ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      </button>
    )
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleFollow}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
          following
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30"
            : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30",
          className
        )}
      >
        {following ? (
          <>
            <Check className="h-3 w-3" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Follow
          </>
        )}
      </button>
    )
  }

  return (
    <div className={clsx("relative", className)}>
      <button
        onClick={handleFollow}
        onMouseEnter={() => following && setShowSettings(true)}
        onMouseLeave={() => setShowSettings(false)}
        className={clsx(
          "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
          following
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30"
            : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30"
        )}
      >
        {following ? (
          <>
            <Bell className="h-4 w-4" />
            <span>Following</span>
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            <span>Follow</span>
          </>
        )}
      </button>

      {/* Settings Dropdown */}
      {following && showSettings && settings && (
        <div 
          className="absolute top-full left-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-3xl"
          onMouseEnter={() => setShowSettings(true)}
          onMouseLeave={() => setShowSettings(false)}
        >
          {/* Genius Insights Section */}
          <div className="mb-4 p-3 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Genius Score</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Win Rate</p>
                <p className="text-sm font-bold text-white">{insights?.winRate}%</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Avg Return</p>
                <p className="text-sm font-bold text-emerald-400">+{insights?.avgReturn}%</p>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 px-1">Alert Configuration</div>
          
          <div className="space-y-3 px-1">
            <label className="flex items-center justify-between cursor-pointer group/label">
              <span className="text-xs font-bold text-zinc-300 group-hover/label:text-white transition-colors">BUY ACTIVITY</span>
              <button
                onClick={() => handleToggleSetting('notifyOnBuy')}
                className={clsx(
                  "w-8 h-4 rounded-full transition-all",
                  settings.notifyOnBuy ? "bg-emerald-500" : "bg-zinc-800"
                )}
              >
                <div className={clsx(
                  "w-3 h-3 rounded-full bg-white transition-transform mx-0.5",
                  settings.notifyOnBuy && "translate-x-4"
                )} />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer group/label">
              <span className="text-xs font-bold text-zinc-300 group-hover/label:text-white transition-colors">SELL ACTIVITY</span>
              <button
                onClick={() => handleToggleSetting('notifyOnSell')}
                className={clsx(
                  "w-8 h-4 rounded-full transition-all",
                  settings.notifyOnSell ? "bg-rose-500" : "bg-zinc-800"
                )}
              >
                <div className={clsx(
                  "w-3 h-3 rounded-full bg-white transition-transform mx-0.5",
                  settings.notifyOnSell && "translate-x-4"
                )} />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer group/label">
              <span className="text-xs font-bold text-zinc-300 group-hover/label:text-white transition-colors">WHALE MOVES</span>
              <button
                onClick={() => handleToggleSetting('notifyOnBigDeal')}
                className={clsx(
                  "w-8 h-4 rounded-full transition-all",
                  settings.notifyOnBigDeal ? "bg-amber-500" : "bg-zinc-800"
                )}
              >
                <div className={clsx(
                  "w-3 h-3 rounded-full bg-white transition-transform mx-0.5",
                  settings.notifyOnBigDeal && "translate-x-4"
                )} />
              </button>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800">
            <button
              onClick={handleFollow}
              className="w-full text-center text-[10px] font-black text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
            >
              Unfollow Superstar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface FollowedInvestorsListProps {
  onSelect?: (name: string) => void
}

export function FollowedInvestorsList({ onSelect }: FollowedInvestorsListProps) {
  const [investors, setInvestors] = useState<FollowedInvestor[]>([])

  useEffect(() => {
    setInvestors(getFollowedInvestors())
  }, [])

  if (investors.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No followed investors yet
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {investors.map(inv => (
        <div
          key={inv.name}
          className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-white/5 hover:border-cyan-500/20 transition-all cursor-pointer"
          onClick={() => onSelect?.(inv.name)}
        >
          <div>
            <div className="font-medium text-white text-sm">{inv.name}</div>
            <div className="flex items-center gap-2 mt-1">
              {inv.notifyOnBuy && (
                <span className="text-[10px] text-emerald-400">📈 Buy</span>
              )}
              {inv.notifyOnSell && (
                <span className="text-[10px] text-rose-400">📉 Sell</span>
              )}
              {inv.notifyOnBigDeal && (
                <span className="text-[10px] text-amber-400">🔥 Big</span>
              )}
            </div>
          </div>
          <FollowButton investorName={inv.name} variant="compact" />
        </div>
      ))}
    </div>
  )
}
