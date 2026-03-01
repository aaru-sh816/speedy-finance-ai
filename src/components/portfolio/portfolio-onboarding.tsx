"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PieChart,
  FileSpreadsheet,
  Link2,
  ArrowRight,
  ArrowLeft,
  Search,
  Loader2,
  Sparkles,
  Check,
  Upload,
  X,
} from "lucide-react"
import {
  createPortfolio,
  addHoldingAsManual,
  getPortfolio,
  getHoldings,
} from "@/lib/portfolio"

type Step = "choose" | "manual" | "csv" | "broker" | "complete"

interface PortfolioOnboardingProps {
  onComplete: () => void
}

export function PortfolioOnboarding({ onComplete }: PortfolioOnboardingProps) {
  const [step, setStep] = useState<Step>("choose")
  const [portfolioName, setPortfolioName] = useState("My Portfolio")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; scripCode?: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string; scripCode: string } | null>(null)
  const [quantity, setQuantity] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  const [holdingsAdded, setHoldingsAdded] = useState<{ symbol: string; name: string }[]>([])
  const [csvText, setCsvText] = useState("")
  const [csvError, setCsvError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChoose = (choice: "manual" | "csv" | "broker") => {
    if (choice === "broker") {
      setStep("broker")
      return
    }
    const p = getPortfolio() ?? createPortfolio(portfolioName, choice)
    setPortfolioName(p.name)
    setStep(choice)
  }

  const searchStocks = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return
    setIsSearching(true)
    try {
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()
      const results = (data.results ?? []).slice(0, 10).map((r: { symbol: string; name: string; scripCode?: string }) => ({
        symbol: r.symbol,
        name: r.name,
        scripCode: r.scripCode ?? r.symbol,
      }))
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const addHolding = () => {
    if (!selectedStock || !quantity || !avgPrice) return
    const q = parseFloat(quantity)
    const p = parseFloat(avgPrice)
    if (isNaN(q) || q <= 0 || isNaN(p) || p <= 0) return
    addHoldingAsManual(selectedStock.scripCode, selectedStock.symbol, selectedStock.name, q, p)
    setHoldingsAdded((prev) => [...prev, { symbol: selectedStock.symbol, name: selectedStock.name }])
    setSelectedStock(null)
    setQuantity("")
    setAvgPrice("")
    setSearchQuery("")
    setSearchResults([])
  }

  const parseCsv = (text: string): { symbol: string; name: string; scripCode: string; quantity: number; avgPrice: number }[] => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim())
    const symbolIdx = headers.findIndex((h) => /symbol|tradingsymbol|script/.test(h))
    const nameIdx = headers.findIndex((h) => /name|company|isin/.test(h))
    const qtyIdx = headers.findIndex((h) => /qty|quantity|shares/.test(h))
    const priceIdx = headers.findIndex((h) => /price|avg|average|rate/.test(h))
    const scripIdx = headers.findIndex((h) => /scrip|bse|code/.test(h))
    if (qtyIdx < 0 || priceIdx < 0) return []
    const rows: { symbol: string; name: string; scripCode: string; quantity: number; avgPrice: number }[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      const qty = parseFloat(cols[qtyIdx] ?? "0")
      const price = parseFloat(cols[priceIdx] ?? "0")
      if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) continue
      const symbol = cols[symbolIdx ?? 0] ?? ""
      const name = cols[nameIdx ?? 1] ?? symbol
      const scripCode = cols[scripIdx ?? -1] ?? symbol
      if (symbol) rows.push({ symbol, name, scripCode, quantity: qty, avgPrice: price })
    }
    return rows
  }

  const handleCsvImport = () => {
    setCsvError(null)
    const rows = parseCsv(csvText)
    if (rows.length === 0) {
      setCsvError("Could not parse CSV. Use columns: Symbol, Quantity, Price (or Avg/Order price). Supports Zerodha, Groww formats.")
      return
    }
    setIsProcessing(true)
    getPortfolio() ?? createPortfolio(portfolioName, "csv")
    for (const r of rows) {
      addHoldingAsManual(r.scripCode, r.symbol, r.name, r.quantity, r.avgPrice)
    }
    setHoldingsAdded(rows.map((r) => ({ symbol: r.symbol, name: r.name })))
    setIsProcessing(false)
  }

  const finishOnboarding = () => {
    onComplete()
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl space-y-8"
          >
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white">Set up your portfolio</h1>
              <p className="text-zinc-500">Choose how you want to add your holdings</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => handleChoose("manual")}
                className="group p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 transition-all text-left"
              >
                <PieChart className="w-10 h-10 text-cyan-400 mb-3" />
                <h3 className="font-semibold text-white mb-1">Manual entry</h3>
                <p className="text-sm text-zinc-500">Add stocks one by one with auto-complete search</p>
                <ArrowRight className="mt-3 w-5 h-5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </button>
              <button
                onClick={() => handleChoose("csv")}
                className="group p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 transition-all text-left"
              >
                <FileSpreadsheet className="w-10 h-10 text-emerald-400 mb-3" />
                <h3 className="font-semibold text-white mb-1">CSV import</h3>
                <p className="text-sm text-zinc-500">Upload Zerodha, Groww or paste CSV</p>
                <ArrowRight className="mt-3 w-5 h-5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </button>
              <button
                onClick={() => handleChoose("broker")}
                className="group p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 opacity-75 cursor-not-allowed text-left"
              >
                <Link2 className="w-10 h-10 text-zinc-500 mb-3" />
                <h3 className="font-semibold text-zinc-400 mb-1">Broker sync</h3>
                <p className="text-sm text-zinc-600">Coming soon</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500">Soon</span>
              </button>
            </div>
          </motion.div>
        )}

        {step === "manual" && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl space-y-6"
          >
            <button onClick={() => setStep("choose")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-xl font-semibold text-white">Add holdings</h2>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search stock (e.g. Reliance)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchStocks()}
                  onBlur={() => setTimeout(() => setSearchResults([]), 150)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.symbol}-${r.scripCode ?? ""}`}
                      onClick={() => {
                        setSelectedStock({ symbol: r.symbol, name: r.name, scripCode: r.scripCode ?? r.symbol })
                        setSearchResults([])
                        setSearchQuery(r.symbol)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-zinc-800/50 flex justify-between"
                    >
                      <span className="text-white font-medium">{r.symbol}</span>
                      <span className="text-zinc-500 text-sm truncate max-w-[200px]">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStock && (
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{selectedStock.symbol}</span>
                    <button onClick={() => setSelectedStock(null)}><X className="w-4 h-4 text-zinc-500" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                    />
                    <input
                      type="number"
                      placeholder="Avg price"
                      value={avgPrice}
                      onChange={(e) => setAvgPrice(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                    />
                  </div>
                  <button
                    onClick={addHolding}
                    className="w-full py-2 rounded-lg bg-cyan-500/20 text-cyan-400 font-medium hover:bg-cyan-500/30"
                  >
                    Add to portfolio
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {holdingsAdded.length > 0 && (
                <p className="text-sm text-zinc-500">Added: {holdingsAdded.map((h) => h.symbol).join(", ")}</p>
              )}
              <button
                onClick={finishOnboarding}
                className="flex items-center gap-2 w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-400 font-semibold hover:bg-cyan-500/30"
              >
                <Sparkles className="w-5 h-5" /> View portfolio
              </button>
            </div>
          </motion.div>
        )}

        {step === "csv" && (
          <motion.div
            key="csv"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl space-y-6"
          >
            <button onClick={() => setStep("choose")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-xl font-semibold text-white">Import from CSV</h2>
            <p className="text-sm text-zinc-500">
              Paste CSV with columns: Symbol, Quantity, Price (or Avg/Order price). We detect Zerodha, Groww formats.
            </p>
            <textarea
              placeholder="Symbol,Qty,Price&#10;RELIANCE,10,2500&#10;TCS,5,3500"
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setCsvError(null) }}
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 focus:border-cyan-500/50 font-mono text-sm"
            />
            {csvError && <p className="text-sm text-rose-400">{csvError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                <Upload className="w-4 h-4" /> Upload file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const r = new FileReader()
                    r.onload = () => setCsvText(String(r.result ?? ""))
                    r.readAsText(f)
                  }
                  e.target.value = ""
                }}
              />
              <button
                onClick={handleCsvImport}
                disabled={!csvText.trim() || isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 font-medium hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Import
              </button>
            </div>
            {holdingsAdded.length > 0 && (
              <button
                onClick={finishOnboarding}
                className="flex items-center gap-2 w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-400 font-semibold hover:bg-cyan-500/30"
              >
                <Sparkles className="w-5 h-5" /> View portfolio ({holdingsAdded.length} holdings)
              </button>
            )}
          </motion.div>
        )}

        {step === "broker" && (
          <motion.div
            key="broker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center space-y-6"
          >
            <button onClick={() => setStep("choose")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white mx-auto">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Link2 className="w-16 h-16 text-zinc-600 mx-auto" />
            <h2 className="text-xl font-semibold text-white">Broker sync coming soon</h2>
            <p className="text-zinc-500">
              We&apos;re building direct integration with popular brokers. Use Manual or CSV for now.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
