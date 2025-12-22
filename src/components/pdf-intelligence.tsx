"use client"

import { FileText, Target, AlertTriangle, CheckCircle2, Search, ArrowRight, Loader2 } from "lucide-react"
import { useState } from "react"
import { clsx } from "clsx"

interface PdfIntelligenceProps {
  scripCode: string
  companyName: string
}

export function PdfIntelligence({ scripCode, companyName }: PdfIntelligenceProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<{
    guidance: string[]
    redFlags: string[]
    keyMetrics: { label: string; value: string }[]
  } | null>(null)

  const handleAnalyze = () => {
    setAnalyzing(true)
    // AI simulation delay
    setTimeout(() => {
      setReport({
        guidance: [
          "Targeting 15% revenue growth for next 2 fiscal years.",
          "Capital expenditure of ₹2,400 Cr planned for green hydrogen plant.",
          "Net-debt zero target by 2026 through internal accruals."
        ],
        redFlags: [
          "Contingent liabilities have increased by 12% YoY.",
          "Dependency on single supplier for 40% of critical raw materials.",
          "Slight dip in EBITDA margins due to rising input costs."
        ],
        keyMetrics: [
          { label: "ROCE", value: "18.2%" },
          { label: "Debt/Equity", value: "0.45" },
          { label: "CFO/EBITDA", value: "0.82" }
        ]
      })
      setAnalyzing(false)
    }, 2000)
  }

  return (
    <div className="glass-card rounded-3xl p-6 bg-zinc-950/40 border border-white/5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Annual Report Intelligence</h3>
            <p className="text-[10px] text-zinc-500">Extract insights from 100+ page filings</p>
          </div>
        </div>
      </div>

      {!report && !analyzing ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-sm text-white font-medium mb-1">Deep Scan Annual Report</p>
          <p className="text-[11px] text-zinc-500 mb-6 max-w-[200px]">
            Our AI will scan the complex PDF and extract critical insights in seconds.
          </p>
          <button
            onClick={handleAnalyze}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2"
          >
            Start AI Deep Scan
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : analyzing ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 text-orange-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-white mb-1">Analyzing PDF Data...</p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-thin">
          {/* Metrics Row */}
          <div className="grid grid-cols-3 gap-3">
            {report?.keyMetrics.map((m, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">{m.label}</p>
                <p className="text-sm font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Management Guidance */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
              <Target className="h-3.5 w-3.5" />
              Management Guidance
            </h4>
            <div className="space-y-2">
              {report?.guidance.map((g, i) => (
                <div key={i} className="flex gap-3 text-xs text-zinc-300 leading-relaxed group">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <p>{g}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Red Flags */}
          <div className="space-y-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
            <h4 className="flex items-center gap-2 text-[11px] font-bold text-rose-400 uppercase tracking-widest">
              <AlertTriangle className="h-3.5 w-3.5" />
              Red Flags / Risks
            </h4>
            <div className="space-y-2">
              {report?.redFlags.map((rf, i) => (
                <div key={i} className="flex gap-3 text-xs text-rose-300/80 leading-relaxed">
                  <CheckCircle2 className="h-3 w-3 text-rose-500/30 flex-shrink-0 mt-0.5" />
                  <p>{rf}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[9px] text-zinc-600 font-medium italic">
            * Scanned 142 pages of FY24 Annual Report
          </p>
          <button className="text-[10px] font-bold text-orange-400 hover:text-orange-300 transition-colors">
            Ask AI anything about report
          </button>
        </div>
      )}
    </div>
  )
}
