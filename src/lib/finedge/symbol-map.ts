/**
 * BSE scripCode <-> NSE symbol mapping via FinEdge stock-symbols.
 * FinEdge uses NSE symbols; BSE uses 5-6 digit scrip codes.
 */

import { getStockSymbols } from "./client"

let symbolMapCache: Map<string, string> | null = null
let reverseMapCache: Map<string, string> | null = null

function isBseScripCode(s: string): boolean {
  return /^\d{5,6}$/.test(String(s).trim())
}

export async function getSymbolMap(): Promise<Map<string, string>> {
  if (symbolMapCache) return symbolMapCache
  const symbols = await getStockSymbols()
  const map = new Map<string, string>()
  for (const s of symbols) {
    if (s.bse_code && s.nse_code) {
      map.set(String(s.bse_code).trim(), String(s.nse_code).trim())
    }
  }
  symbolMapCache = map
  return map
}

export async function getReverseSymbolMap(): Promise<Map<string, string>> {
  if (reverseMapCache) return reverseMapCache
  const map = await getSymbolMap()
  const reverse = new Map<string, string>()
  for (const [bse, nse] of map) {
    reverse.set(nse, bse)
  }
  reverseMapCache = reverse
  return reverse
}

/**
 * Resolve BSE scripCode to NSE symbol for FinEdge API calls.
 * If input is already NSE-like (letters), return as-is.
 */
export async function resolveNseSymbol(input: string): Promise<string | null> {
  const trimmed = String(input).trim()
  if (!trimmed) return null
  if (isBseScripCode(trimmed)) {
    const map = await getSymbolMap()
    return map.get(trimmed) ?? null
  }
  return trimmed
}

/**
 * Resolve NSE symbol to BSE scripCode.
 */
export async function resolveBseScripCode(input: string): Promise<string | null> {
  const trimmed = String(input).trim()
  if (!trimmed) return null
  if (isBseScripCode(trimmed)) return trimmed
  const map = await getReverseSymbolMap()
  return map.get(trimmed.toUpperCase()) ?? null
}
