/**
 * Universal number formatting for financial data.
 * Indian number format, Crores, EPS, percentages.
 * FinEdge returns values in rupees; divide by 1e7 for Crores.
 */

/** Format value as ₹ Crores. Input in rupees. */
export function formatCr(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const cr = Number(n) / 1e7
  return cr.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
}

/** Format large value with Cr suffix (e.g. 18,86,836 Cr or 18.87L Cr) */
export function formatCrWithSuffix(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const cr = Number(n) / 1e7
  if (Math.abs(cr) >= 100000) return `${(cr / 100000).toFixed(2)}L Cr`
  if (Math.abs(cr) >= 1000) return `${(cr / 1000).toFixed(2)}K Cr`
  return `${cr.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })} Cr`
}

/** Format market cap. Input in rupees. 18.87L Cr for large caps. */
export function formatMcap(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "—"
  const cr = n / 1e7
  if (cr >= 100000) return `${(cr / 100000).toFixed(2)}L Cr`
  if (cr >= 1000) return `${(cr / 1000).toFixed(2)}K Cr`
  return `${cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`
}

/** Indian number format (toLocaleString en-IN) */
export function formatIndian(
  n: number | undefined | null,
  opts?: { maxFractionDigits?: number; minFractionDigits?: number }
): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: opts?.maxFractionDigits ?? 2,
    minimumFractionDigits: opts?.minFractionDigits ?? 0,
  })
}

/** Format percentage (e.g. 12.5%) */
export function formatPercent(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${n.toFixed(1)}%`
}

/** Format EPS (e.g. ₹51.5) */
export function formatEps(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `₹${Number(n).toFixed(1)}`
}

/** Format financial cell: Crores for most keys, EPS for eps/EPS */
export function formatFinancialCell(
  v: string | number | undefined,
  key: string
): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const k = key.toLowerCase()
  if (k === "eps") return formatEps(n)
  return formatCr(n)
}

/** Format ratio cell: percentage for margins/ROE, raw number for days/turnover */
export function formatRatioCell(v: string | number | undefined, key: string): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const k = key.toLowerCase()
  const percentKeys = [
    "returnonequity", "returnonasset", "returnoncapital", "grossmargin", "netmargin",
    "operatingmargin", "ebitmargin", "ebitdamargin", "dividendpayout", "retentionratio",
  ]
  const rawNumberKeys = ["currentratio", "quickratio", "cashratio", "debtequity", "debttoequity", "interestcoverage", "debtordays", "creditordays", "inventorydays", "inventoryturnover", "assetturnover"]
  if (rawNumberKeys.some((pk) => k.includes(pk))) return formatIndian(n, { maxFractionDigits: 1 })
  const isPercent = percentKeys.some((pk) => k.includes(pk)) || (k.includes("margin") && !k.includes("turnover"))
  if (isPercent && Math.abs(n) <= 1000) return formatPercent(n)
  return formatIndian(n, { maxFractionDigits: 1 })
}
