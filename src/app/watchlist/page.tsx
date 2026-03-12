import { FeyWatchlist } from "@/components/fey/FeyWatchlist"
import { FeyNav } from "@/components/fey/FeyNav"
import { Metadata } from "next"
import { clsx } from "clsx"

import { StoreProvider } from "@/lib/store/StoreProvider"
import { Maximize2, Bookmark } from "lucide-react"

export const metadata: Metadata = {
  title: "Portfolio Beta - God Mode",
  description: "Advanced dynamic watchlist with high-fidelity RTK state.",
}

function TrafficLights() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
      <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
      <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
    </div>
  )
}

export default function WatchlistPage() {
  return (
    <StoreProvider>
      {/* Radial vignette background */}
      {/* Base gradient background */}
      <div className="min-h-[100dvh] bg-gradient-to-b from-black via-zinc-950 to-black overflow-hidden flex flex-col relative">

        {/* Top App Chrome */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 gap-4 relative z-50">
          <div className="flex items-center gap-6">
            <TrafficLights />
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white fill-white hidden sm:block">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                <line x1="16" y1="8" x2="2" y2="22"></line>
                <line x1="17.5" y1="15" x2="9" y2="15"></line>
              </svg>
              <h1 className="text-[17px] font-semibold text-white tracking-tight">Portfolio</h1>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Beta</span>
            </div>
          </div>

          <div className="flex-1 flex justify-center w-full sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            {/* FeyNav is rendered globally in layout.tsx */}
          </div>

          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-6 text-[13px] font-medium mr-4 hidden md:flex">
              <button className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Holdings
              </button>
              <button className="text-white flex items-center gap-2 relative">
                <Bookmark className="w-3.5 h-3.5" />
                Watchlist
                <div className="absolute -bottom-6 left-0 right-0 h-[2px] bg-white rounded-t-full" />
              </button>
            </div>
            <button className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors hidden sm:flex">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex px-2 sm:px-10 pb-6 pt-2 justify-center w-full mx-auto relative z-10 overflow-hidden min-h-0">
          <div className="w-full max-w-[1720px] bg-transparent rounded-[16px] border border-white/5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.02),_0_20px_40px_rgba(0,0,0,0.5)] flex overflow-hidden">
            <FeyWatchlist />
          </div>
        </main>
      </div>
    </StoreProvider>
  )
}
