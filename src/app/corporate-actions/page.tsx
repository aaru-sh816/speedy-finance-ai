"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Filter, Calendar, BadgePercent, Gift, Scissors, ArrowDownCircle, AlertTriangle, RefreshCw, Globe } from "lucide-react"

interface CorporateAction {
  id: string
  scripCode: string
  shortName: string
  longName: string
  purpose: string
  purposeType: string
  exDate: string
  recordDate?: string
  bcStartDate?: string
  bcEndDate?: string
  paymentDate?: string
  dividendAmount?: number
  ratio?: string
}

function clsx(...v: (string | false | undefined)[]) { return v.filter(Boolean).join(" ") }

function purposeIcon(t: string) {
  switch (t) {
    case "dividend": return <BadgePercent className="h-3.5 w-3.5 text-emerald-400" />
    case "bonus": return <Gift className="h-3.5 w-3.5 text-cyan-400" />
    case "split": return <Scissors className="h-3.5 w-3.5 text-amber-400" />
    case "rights": return <ArrowDownCircle className="h-3.5 w-3.5 text-indigo-400" />
    case "buyback": return <ArrowDownCircle className="h-3.5 w-3.5 text-pink-400" />
    default: return <AlertTriangle className="h-3.5 w-3.5 text-zinc-500" />
  }
}

export default function CorporateActionsPage() {
  const [scripCode, setScripCode] = useState("") 
  const [type, setType] = useState<string>("")
  const [actions, setActions] = useState<CorporateAction[]>([])
  const [loading, setLoading] = useState(false)

  const fetchActions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (scripCode) params.set("scripCode", scripCode)
      if (type) params.set("type", type)
      const res = await fetch(`/api/bse/corporate-actions?${params.toString()}`)
      const data = await res.json()
      setActions(data.actions || [])
    } catch {
      setActions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchActions() }, [])

  const filtered = useMemo(() => actions, [actions])

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
      <div className="relative max-w-[1600px] mx-auto px-6 pt-24 pb-12">
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Corporate Events</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter text-white">
                Institutional <span className="text-zinc-600">Actions</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl">
                <input 
                  value={scripCode} 
                  onChange={(e) => setScripCode(e.target.value)} 
                  placeholder="Scrip Code" 
                  className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-xs outline-none focus:border-cyan-500/30 transition-all w-32" 
                />
                <select 
                  value={type} 
                  onChange={(e)=> setType(e.target.value)} 
                  className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-xs text-zinc-300 outline-none focus:border-cyan-500/30"
                >
                  <option value="">All Types</option>
                  <option value="dividend">Dividends</option>
                  <option value="bonus">Bonus</option>
                  <option value="split">Splits</option>
                  <option value="buyback">Buybacks</option>
                  <option value="rights">Rights</option>
                </select>
                <button 
                  onClick={fetchActions} 
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-all group"
                >
                  <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/30 rounded-[2.5rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/40 border-b border-zinc-800/50">
                  <th className="text-left py-5 px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">Company</th>
                  <th className="text-left py-5 px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">Purpose</th>
                  <th className="text-left py-5 px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">Ex-Date</th>
                  <th className="text-left py-5 px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">Record</th>
                  <th className="text-left py-5 px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-32 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="h-8 w-8 animate-spin text-cyan-500" />
                        <span className="text-sm font-bold tracking-widest uppercase">Syncing Events...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-32 text-center">
                      <div className="space-y-2">
                        <p className="text-zinc-400 font-bold tracking-tight">No corporate actions found</p>
                        <p className="text-xs text-zinc-600">Try adjusting your filters or search criteria</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((a) => {
                  const bseLink = `https://www.bseindia.com/stock-share-price/x/${encodeURIComponent((a.longName||'').toLowerCase().replace(/\s+/g,'-'))}/${a.scripCode}/`
                  return (
                    <tr key={a.id} className="group hover:bg-zinc-800/20 transition-all duration-300">
                      <td className="py-6 px-8 flex items-center gap-4">
                        <div>
                          <a href={bseLink} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{a.longName || a.shortName}</a>
                          <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase mt-1">{a.scripCode}</div>
                        </div>
                      </td>
                      <td className="py-6 px-8">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                            {purposeIcon(a.purposeType)}
                          </div>
                          <span className="text-sm font-bold text-zinc-300">{a.purpose}</span>
                        </div>
                      </td>
                      <td className="py-6 px-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black">
                          {a.exDate}
                        </div>
                      </td>
                      <td className="py-6 px-8 text-sm font-medium text-zinc-500">{a.recordDate || '-'}</td>
                      <td className="py-6 px-8">
                        <div className="flex items-center gap-4">
                          {a.dividendAmount != null && (
                            <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                              ₹{a.dividendAmount} Div
                            </div>
                          )}
                          {a.ratio && (
                            <div className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                              Ratio: {a.ratio}
                            </div>
                          )}
                          {!a.dividendAmount && !a.ratio && <span className="text-zinc-600 text-xs italic">N/A</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
