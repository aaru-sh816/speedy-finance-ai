"use client"

import { clsx } from "clsx"
import { formatMcap as formatMcapUtil } from "@/lib/format-numbers"
import { Building2, Activity, ShieldAlert, BarChart3, PieChart, Layers, PenSquare, ArrowRight } from "lucide-react"

interface OverviewCardProps {
  scripCode: string
  profile?: {
    sector?: string
    industry?: string
    macro_sector?: string
    market_cap?: number
  } | null
  quote?: {
    high52?: number
    low52?: number
    market_cap?: number
    price?: number
  } | null
  /** BSE quote marketCap (rupees) - fallback when FinEdge market_cap is 0/undefined */
  marketCapFallback?: number | null
  priceRatios?: { pe?: number; pb?: number; ps?: number }[]
  ratios?: { pegRatio?: number; returnOnEquity?: number; returnOnCapitalEmployed?: number; [k: string]: string | number | undefined }[]
  industryPe?: number | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

function formatPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatRatio(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toFixed(2)
}

function formatPercent(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(1)}%`
}

function getVolatility(high52?: number, low52?: number, price?: number): string {
  if (!high52 || !low52 || !price || high52 === low52) return "—"
  const range = (high52 - low52) / price
  if (range > 0.4) return "HIGH"
  if (range > 0.2) return "MED"
  return "LOW"
}

export function OverviewCard({
  scripCode,
  profile,
  quote,
  marketCapFallback,
  priceRatios,
  ratios,
  industryPe,
  onNoteAction,
}: OverviewCardProps) {
  const feMcap = profile?.market_cap ?? quote?.market_cap
  const mcap = feMcap != null && feMcap > 0 ? feMcap : marketCapFallback
  const high52 = quote?.high52
  const low52 = quote?.low52
  const price = quote?.price
  const volatility = getVolatility(high52, low52, price)
  
  const pe = priceRatios?.[0]?.pe
  const pb = priceRatios?.[0]?.pb
  const ps = priceRatios?.[0]?.ps
  const peg = ratios?.[0]?.pegRatio != null ? Number(ratios[0].pegRatio) : undefined
  const roe = ratios?.[0]?.returnOnEquity != null ? Number(ratios[0].returnOnEquity) : undefined
  const roce = ratios?.[0]?.returnOnCapitalEmployed != null ? Number(ratios[0].returnOnCapitalEmployed) : undefined
  
  const sector = profile?.sector ?? profile?.macro_sector ?? "—"
  const industry = profile?.industry ?? (sector !== "—" ? sector : "—")

  const sections = [
    {
      title: "VALUATION",
      icon: BarChart3,
      items: [
        { label: "M-Cap", value: formatMcapUtil(mcap), highlight: true, color: "text-amber-400" },
        { label: "P/E", value: formatRatio(pe) },
        { label: "P/B", value: formatRatio(pb) },
        { label: "PEG", value: formatRatio(peg) },
      ]
    },
    {
      title: "EFFICIENCY",
      icon: Activity,
      items: [
        { label: "ROE", value: formatPercent(roe), color: (roe ?? 0) > 0.15 ? "text-emerald-400" : "text-zinc-300" },
        { label: "ROCE", value: formatPercent(roce), color: (roce ?? 0) > 0.15 ? "text-emerald-400" : "text-zinc-300" },
        { label: "Ind. P/E", value: industryPe != null ? formatRatio(industryPe) : "—" },
        { label: "P/S", value: formatRatio(ps) },
      ]
    },
    {
      title: "52W RANGE",
      icon: ShieldAlert,
      items: [
        { label: "HIGH", value: `₹${formatPrice(high52)}`, color: "text-zinc-100" },
        { label: "LOW", value: `₹${formatPrice(low52)}`, color: "text-zinc-100" },
        { label: "VOL", value: volatility, 
          color: volatility === "HIGH" ? "text-rose-400" : volatility === "LOW" ? "text-emerald-400" : "text-amber-400" 
        },
        { label: "PRICE", value: `₹${formatPrice(price)}` },
      ]
    },
    {
      title: "BUSINESS",
      icon: Building2,
      items: [
        { label: "Sector", value: sector.split(" ").slice(0, 2).join(" "), color: "text-zinc-400" },
        { label: "Industry", value: industry.split(" ").slice(0, 2).join(" "), color: "text-zinc-400" },
        { label: "BSE ID", value: scripCode },
        { label: "Group", value: "A / Equity" },
      ]
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] group/container">
      {sections.map((section) => (
        <div key={section.title} className="bg-zinc-950/90 p-6 space-y-5 transition-all duration-500 hover:bg-zinc-900/40 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <section.icon className="h-3.5 w-3.5 text-cyan-500" />
              <h4 className="text-[10px] font-black tracking-[0.25em] uppercase text-zinc-500">{section.title}</h4>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {section.items.map((item) => (
              <button 
                key={item.label} 
                onClick={() => onNoteAction?.({
                  title: `Metric: ${item.label}`,
                  content: `${item.label} for ${scripCode} is currently ${item.value}.`,
                  type: "note"
                })}
                className="flex flex-col gap-1 group/item text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black text-zinc-700 tracking-wider uppercase group-hover/item:text-zinc-500 transition-colors">
                    {item.label}
                  </span>
                  <ArrowRight className="h-2 w-2 text-cyan-500 opacity-0 group-hover/item:opacity-100 transition-all -translate-x-1 group-hover/item:translate-x-0" />
                </div>
                <span className={clsx(
                  "font-black text-sm tabular-nums tracking-tight transition-all",
                  item.color || "text-zinc-300 group-hover/item:text-white",
                  item.value === "—" && "text-zinc-800"
                )}>
                  {item.value}
                </span>
              </button>
            ))}
          </div>

          {/* Vertical Decorator */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        </div>
      ))}
    </div>
  )
}
