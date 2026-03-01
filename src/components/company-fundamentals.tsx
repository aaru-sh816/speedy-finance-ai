"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BarChart2,
  Users,
  BadgePercent,
  TrendingUp,
  Loader2,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import {
  OverviewCard,
  FinancialSummaryCards,
  QuarterlyResultsTable,
  IncomeStatementTable,
  BalanceSheetTable,
  CashFlowTable,
  RatiosTable,
  ShareholdingsSection,
} from "@/components/fundamentals"

interface FundamentalsProps {
  scripCode: string
  /** BSE quote marketCap (rupees) - fallback when FinEdge market_cap is 0/undefined */
  marketCapFallback?: number | null
  onNoteAction?: (context: { title: string; content: string; type: "note" | "ai" }) => void
}

interface RatioRow {
  header?: string
  year?: number
  returnOnEquity?: number
  grossMargin?: number
  netMargin?: number
  operatingMargin?: number
  pegRatio?: number
  [key: string]: number | string | undefined
}

interface FinancialRow {
  header?: string
  year?: number
  EPS?: number
  revenueFromOperations?: number
  profitLossForPeriod?: number
  [key: string]: string | number | undefined
}

interface ShareholdingRow {
  name: string
  data: Record<string, number>
  shareholders?: Array<{ name: string; data: Record<string, number> }>
}

interface DividendItem {
  amount?: number
  date?: string
  dividend_type?: string
  subject?: string
}

interface QuoteItem {
  price?: number
  high52?: number
  low52?: number
  market_cap?: number
}

export function CompanyFundamentals({ scripCode, marketCapFallback: marketCapFallbackProp, onNoteAction }: FundamentalsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [quote, setQuote] = useState<QuoteItem | null>(null)
  const [ratios, setRatios] = useState<RatioRow[]>([])
  const [ratiosEf, setRatiosEf] = useState<RatioRow[]>([])
  const [ratiosLi, setRatiosLi] = useState<RatioRow[]>([])
  const [ratiosLe, setRatiosLe] = useState<RatioRow[]>([])
  const [ratiosS, setRatiosS] = useState<RatioRow[]>([])
  const [ratiosEfS, setRatiosEfS] = useState<RatioRow[]>([])
  const [ratiosLiS, setRatiosLiS] = useState<RatioRow[]>([])
  const [ratiosLeS, setRatiosLeS] = useState<RatioRow[]>([])
  const [financialsPlAnnual, setFinancialsPlAnnual] = useState<FinancialRow[]>([])
  const [financialsPlStandalone, setFinancialsPlStandalone] = useState<FinancialRow[]>([])
  const [financialsPlQuarterly, setFinancialsPlQuarterly] = useState<FinancialRow[]>([])
  const [financialsPlQuarterlyStandalone, setFinancialsPlQuarterlyStandalone] = useState<FinancialRow[]>([])
  const [financialsPlTtm, setFinancialsPlTtm] = useState<FinancialRow[]>([])
  const [financialsBsAnnual, setFinancialsBsAnnual] = useState<FinancialRow[]>([])
  const [financialsBsStandalone, setFinancialsBsStandalone] = useState<FinancialRow[]>([])
  const [financialsCfAnnual, setFinancialsCfAnnual] = useState<FinancialRow[]>([])
  const [financialsCfStandalone, setFinancialsCfStandalone] = useState<FinancialRow[]>([])
  const [peers, setPeers] = useState<string[]>([])
  const [shareholding, setShareholding] = useState<{ columns: string[]; rows: ShareholdingRow[] } | null>(null)
  const [dividends, setDividends] = useState<DividendItem[]>([])
  const [priceRatios, setPriceRatios] = useState<{ pe?: number; pb?: number; ps?: number }[]>([])
  const [industryPe, setIndustryPe] = useState<number | null>(null)
  const [bseMarketCap, setBseMarketCap] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const base = `/api/finedge`

    const fetches = [
      fetchWithTimeout(`${base}/company-profile/${scripCode}`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setProfile(d)))
        .catch(() => (cancelled ? null : setProfile(null))),
      fetchWithTimeout(`${base}/quote?symbol=${scripCode}`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return
          const obj = d && typeof d === "object" ? d : {}
          const first = Object.values(obj)[0] as QuoteItem | undefined
          setQuote(first ?? null)
        })
        .catch(() => (cancelled ? null : setQuote(null))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=c&ratio_type=pr`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatios(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatios([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=s&ratio_type=pr`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosS(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosS([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=c&ratio_type=ef`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosEf(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosEf([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=s&ratio_type=ef`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosEfS(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosEfS([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=c&ratio_type=li`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosLi(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosLi([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=c&ratio_type=le`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosLe(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosLe([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=s&ratio_type=li`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosLiS(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosLiS([]))),
      fetchWithTimeout(`${base}/ratios/${scripCode}?statement_type=s&ratio_type=le`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setRatiosLeS(d?.ratios ?? [])))
        .catch(() => (cancelled ? null : setRatiosLeS([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=c&statement_code=pl&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsPlAnnual(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsPlAnnual([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=s&statement_code=pl&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsPlStandalone(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsPlStandalone([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=c&statement_code=pl&period=quarterly`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsPlQuarterly(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsPlQuarterly([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=s&statement_code=pl&period=quarterly`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsPlQuarterlyStandalone(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsPlQuarterlyStandalone([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=c&statement_code=pl&period=ttm`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsPlTtm(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsPlTtm([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=c&statement_code=bs&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsBsAnnual(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsBsAnnual([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=s&statement_code=bs&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsBsStandalone(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsBsStandalone([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=c&statement_code=cf&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsCfAnnual(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsCfAnnual([]))),
      fetchWithTimeout(`${base}/financials/${scripCode}?statement_type=s&statement_code=cf&period=annual`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setFinancialsCfStandalone(d?.financials ?? [])))
        .catch(() => (cancelled ? null : setFinancialsCfStandalone([]))),
      fetchWithTimeout(`${base}/annual-price-ratios/${scripCode}?statement_type=c`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setPriceRatios(d?.price_ratios ?? [])))
        .catch(() => (cancelled ? null : setPriceRatios([]))),
      fetchWithTimeout(`${base}/peers/${scripCode}`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setPeers(d?.peers ?? [])))
        .catch(() => (cancelled ? null : setPeers([]))),
      fetchWithTimeout(`${base}/shareholdings/pattern/${scripCode}?period=quarterly`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) =>
          cancelled ? null : setShareholding(d?.columns ? { columns: d.columns, rows: d.rows ?? [] } : null)
        )
        .catch(() => (cancelled ? null : setShareholding(null))),
      fetchWithTimeout(`${base}/dividend/${scripCode}`, { timeoutMs: 10000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setDividends(d?.dividend ?? [])))
        .catch(() => (cancelled ? null : setDividends([]))),
      fetchWithTimeout(`/api/bse/quote?symbol=${encodeURIComponent(scripCode)}`, { timeoutMs: 8000 })
        .then((r) => r.json())
        .then((d) => (cancelled ? null : setBseMarketCap(d?.marketCap ?? null)))
        .catch(() => (cancelled ? null : setBseMarketCap(null))),
    ]

    Promise.all(fetches)
      .then(() => (cancelled ? null : setLoading(false)))
      .catch((e) => (cancelled ? null : (setError(e?.message ?? "Failed"), setLoading(false))))
    return () => {
      cancelled = true
    }
  }, [scripCode])

  useEffect(() => {
    if (peers.length === 0) return
    let cancelled = false
    const topPeers = peers.slice(0, 5)
    Promise.all(
      topPeers.map((p) =>
        fetchWithTimeout(`/api/finedge/annual-price-ratios/${encodeURIComponent(String(p).trim())}?statement_type=c`, {
          timeoutMs: 8000,
        })
          .then((r) => r.json())
          .then((d) => d?.price_ratios?.[0]?.pe as number | undefined)
          .catch(() => undefined)
      )
    ).then((pes) => {
      if (cancelled) return
      const valid = pes.filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
      if (valid.length > 0) {
        const avg = valid.reduce((a, b) => a + b, 0) / valid.length
        setIndustryPe(avg)
      }
    })
    return () => {
      cancelled = true
    }
  }, [peers])

  const marketCapFallback = bseMarketCap ?? marketCapFallbackProp ?? null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
        <span className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">ANALYZING FUNDAMENTALS</span>
      </div>
    )
  }

  const profileObj = profile as { sector?: string; industry?: string; macro_sector?: string; sub_industry?: string; market_cap?: number } | null

  return (
    <div className="space-y-12 pb-24">
        <OverviewCard
          scripCode={scripCode}
          profile={profileObj}
          quote={quote}
          marketCapFallback={marketCapFallback}
          priceRatios={priceRatios}
          ratios={[...ratios, ...ratiosEf]}
          industryPe={industryPe}
          onNoteAction={onNoteAction}
        />

      <FinancialSummaryCards plAnnual={financialsPlAnnual} cfAnnual={financialsCfAnnual} onNoteAction={onNoteAction} />

      <div className="space-y-8">
        <QuarterlyResultsTable
          scripCode={scripCode}
          dataConsolidated={financialsPlQuarterly.length > 0 ? financialsPlQuarterly : null}
          dataStandalone={financialsPlQuarterlyStandalone.length > 0 ? financialsPlQuarterlyStandalone : null}
          onNoteAction={onNoteAction}
        />

        <IncomeStatementTable
          scripCode={scripCode}
          dataConsolidated={financialsPlAnnual.length > 0 ? financialsPlAnnual : null}
          dataStandalone={financialsPlStandalone.length > 0 ? financialsPlStandalone : null}
          dataTtm={financialsPlTtm.length > 0 ? financialsPlTtm : null}
          onNoteAction={onNoteAction}
        />

        <BalanceSheetTable
          scripCode={scripCode}
          dataConsolidated={financialsBsAnnual.length > 0 ? financialsBsAnnual : null}
          dataStandalone={financialsBsStandalone.length > 0 ? financialsBsStandalone : null}
          onNoteAction={onNoteAction}
        />

        <CashFlowTable
          scripCode={scripCode}
          dataConsolidated={financialsCfAnnual.length > 0 ? financialsCfAnnual : null}
          dataStandalone={financialsCfStandalone.length > 0 ? financialsCfStandalone : null}
          onNoteAction={onNoteAction}
        />

        <RatiosTable
          scripCode={scripCode}
          dataConsolidatedPr={ratios.length > 0 ? ratios : null}
          dataConsolidatedEf={ratiosEf.length > 0 ? ratiosEf : null}
          dataConsolidatedLi={ratiosLi.length > 0 ? ratiosLi : null}
          dataConsolidatedLe={ratiosLe.length > 0 ? ratiosLe : null}
          dataStandalonePr={ratiosS.length > 0 ? ratiosS : null}
          dataStandaloneEf={ratiosEfS.length > 0 ? ratiosEfS : null}
          dataStandaloneLi={ratiosLiS.length > 0 ? ratiosLiS : null}
          dataStandaloneLe={ratiosLeS.length > 0 ? ratiosLeS : null}
          onNoteAction={onNoteAction}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {financialsPlAnnual.length > 0 && (
          <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
            <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between">
              <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500 flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                REVENUE & PAT TREND
              </h3>
            </div>
            <div className="h-80 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...financialsPlAnnual].reverse().map((r) => ({
                    period: String(r.header ?? r.year ?? ""),
                    revenue: Number(r.revenueFromOperations ?? 0) / 1e7,
                    pat: Number(r.profitLossForPeriod ?? 0) / 1e7,
                  }))}
                >
                  <XAxis dataKey="period" stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}Cr`} />
                  <Tooltip
                    contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", fontSize: "11px" }}
                    labelStyle={{ color: "#a1a1aa", marginBottom: "4px", fontWeight: "bold" }}
                    formatter={(value: number | undefined) => [value != null ? `₹${value.toFixed(1)} Cr` : "", ""]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", paddingTop: "20px" }} />
                  <Line type="monotone" dataKey="revenue" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Revenue" />
                  <Line type="monotone" dataKey="pat" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="PAT" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {ratios.length > 0 && (
          <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
            <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between">
              <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500 flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                KEY RATIOS TREND
              </h3>
            </div>
            <div className="h-80 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...ratios].reverse().map((r) => ({
                    period: String(r.header ?? r.year ?? ""),
                    roe: r.returnOnEquity != null ? Number(r.returnOnEquity) * 100 : undefined,
                    netMargin: r.netMargin != null ? Number(r.netMargin) * 100 : undefined,
                    grossMargin: r.grossMargin != null ? Number(r.grossMargin) * 100 : undefined,
                  }))}
                >
                  <XAxis dataKey="period" stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", fontSize: "11px" }}
                    formatter={(value: number | undefined) => [value != null ? `${value.toFixed(1)}%` : "", ""]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", paddingTop: "20px" }} />
                  <Line type="monotone" dataKey="roe" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="ROE" />
                  <Line type="monotone" dataKey="netMargin" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: "#a78bfa", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Net Margin" />
                  <Line type="monotone" dataKey="grossMargin" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: "#34d399", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Gross Margin" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <ShareholdingsSection scripCode={scripCode} shareholding={shareholding} />

      {peers.length > 0 && (
        <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
          <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between">
            <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500 flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              PEER GROUP
            </h3>
          </div>
          <div className="p-8 flex flex-wrap gap-4">
            {peers.slice(0, 15).map((p) => (
              <Link
                key={p}
                href={`/company/${p}`}
                className="group px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 text-[12px] font-black text-zinc-500 hover:text-cyan-400 transition-all flex items-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-2 h-2 rounded-full bg-zinc-800 group-hover:bg-cyan-500 group-hover:shadow-[0_0_8px_rgba(34,211,238,0.6)] transition-all" />
                {String(p).trim()}
              </Link>
            ))}
          </div>
        </div>
      )}

      {dividends.length > 0 && (
        <div className="rounded-3xl bg-zinc-950/50 border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
          <div className="p-6 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between">
            <h3 className="text-[11px] font-black tracking-[0.25em] uppercase text-zinc-500 flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              DIVIDEND HISTORY
            </h3>
          </div>
          <div className="p-8 flex flex-col md:flex-row gap-12">
            {dividends.length >= 2 && (
              <div className="h-64 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...dividends].reverse().slice(0, 12).map((d) => ({
                      date: d.date ? String(d.date).slice(0, 7) : "",
                      amount: Number(d.amount ?? 0),
                    }))}
                  >
                    <XAxis dataKey="date" stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#3f3f46" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", fontSize: "11px" }}
                      formatter={(value: number | undefined) => [value != null ? `₹${Number(value).toFixed(2)}` : "", "Amount"]}
                    />
                    <Bar dataKey="amount" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="w-full md:w-80 space-y-3">
              {dividends.slice(0, 8).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0 group"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white font-mono tabular-nums">₹{Number(d.amount ?? 0).toFixed(2)}</span>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter group-hover:text-zinc-500 transition-colors">{d.dividend_type ?? "Dividend"}</span>
                  </div>
                  <span className="text-[10px] font-black text-zinc-700 font-mono">{d.date ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
