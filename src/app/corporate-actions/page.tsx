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
  const [scripCode, setScripCode] = useState("500209") // INFY default demo
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
    <div className="h-screen max-h-screen bg-zinc-950 text-white flex overflow-hidden">
      <div className="flex-1 ml-16 flex flex-col h-screen overflow-hidden">
        <header className="flex-shrink-0 z-30 glass-panel border-b border-white/5">
          <div className="flex items-center justify-between h-12 px-4">
            <div className="flex items-center gap-3">
              <h1 className="font-semibold text-sm">Corporate Actions (Demo)</h1>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <input value={scripCode} onChange={(e) => setScripCode(e.target.value)} placeholder="Scrip Code e.g. 500209" className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs" />
                <select value={type} onChange={(e)=> setType(e.target.value)} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-zinc-300">
                  <option value="">All</option>
                  <option value="dividend">Dividend</option>
                  <option value="bonus">Bonus</option>
                  <option value="split">Split</option>
                  <option value="buyback">Buyback</option>
                  <option value="rights">Rights</option>
                </select>
                <button onClick={fetchActions} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10">
                  <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          <div className="glass-card rounded-2xl p-4">
            <table className="w-full text-xs">
              <thead className="text-zinc-500">
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 font-medium">Company</th>
                  <th className="text-left py-2 font-medium">Purpose</th>
                  <th className="text-left py-2 font-medium">Ex-Date</th>
                  <th className="text-left py-2 font-medium">Record</th>
                  <th className="text-left py-2 font-medium">Payment</th>
                  <th className="text-left py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const bseLink = `https://www.bseindia.com/stock-share-price/x/${encodeURIComponent((a.longName||'').toLowerCase().replace(/\s+/g,'-'))}/${a.scripCode}/`
                  return (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <a href={bseLink} target="_blank" rel="noopener noreferrer" className="text-zinc-200 hover:text-white font-medium truncate max-w-[320px]">{a.longName || a.shortName}</a>
                          <a href={bseLink} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400"><Globe className="h-3.5 w-3.5"/></a>
                        </div>
                        <div className="text-[10px] text-zinc-500">{a.scripCode}</div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          {purposeIcon(a.purposeType)}
                          <span className="text-zinc-300">{a.purpose}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">{a.exDate}</td>
                      <td className="py-2 pr-2">{a.recordDate || '-'}</td>
                      <td className="py-2 pr-2">{a.paymentDate || '-'}</td>
                      <td className="py-2 text-zinc-400">
                        {a.dividendAmount != null && <span className="mr-3">₹ {a.dividendAmount}</span>}
                        {a.ratio && <span className="">Ratio: {a.ratio}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="text-center text-zinc-500 py-10">No actions found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
