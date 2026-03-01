/**
 * Shared logo URL helpers for company and calendar.
 * FMP: https://financialmodelingprep.com/image-stock/{SYMBOL}.{EXCHANGE}.png
 * Truedata: https://corporate.truedata.in/logos/{ISIN}.png
 */

const FMP_LOGO_BASE = "https://financialmodelingprep.com/image-stock"
const TRUEDATA_LOGO_BASE = "https://corporate.truedata.in/logos"

/** Build FMP logo URL. Symbol: base ticker; use .BO for BSE, .NS for NSE. */
export function buildFmpLogoUrl(symbol: string, exchange: "BO" | "NS" = "BO"): string {
  const base = symbol.replace(/\.(BO|NS)$/i, "").trim()
  if (!base) return ""
  return `${FMP_LOGO_BASE}/${base}.${exchange}.png`
}

/** Build Truedata logo URL from ISIN. */
export function buildTruedataLogoUrl(isin: string): string | undefined {
  const trimmed = isin?.trim()
  return trimmed ? `${TRUEDATA_LOGO_BASE}/${trimmed}.png` : undefined
}

/** Whether symbol is valid for FMP (non-numeric ticker). FMP expects NSE/BSE tickers, not BSE scrip codes. */
function isValidFmpSymbol(symbol: string): boolean {
  const base = symbol.replace(/\.(BO|NS)$/i, "").trim()
  if (!base) return false
  if (/^\d+$/.test(base)) return false // BSE scrip codes are numeric; FMP has no logos for them
  return /^[A-Z0-9&.-]+$/i.test(base)
}

export interface LogoUrls {
  logoUrl?: string
  logoUrlFallback?: string
}

/**
 * Build logo URLs for a company. Tries NSE first (many Indian stocks), then BSE, then Truedata.
 * Returns primary URL and fallback for onError handling.
 */
export function buildLogoUrls(symbol: string, isin?: string): LogoUrls {
  const baseSymbol = symbol?.replace(/\.(BO|NS)$/i, "").trim() || ""
  if (!isValidFmpSymbol(baseSymbol)) {
    const truedataUrl = buildTruedataLogoUrl(isin ?? "")
    return { logoUrl: truedataUrl, logoUrlFallback: undefined }
  }
  const fmpNs = buildFmpLogoUrl(baseSymbol, "NS")
  const fmpBo = buildFmpLogoUrl(baseSymbol, "BO")
  const truedataUrl = buildTruedataLogoUrl(isin ?? "")
  return {
    logoUrl: fmpNs,
    logoUrlFallback: fmpBo || truedataUrl || undefined,
  }
}
