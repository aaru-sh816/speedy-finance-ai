/**
 * Parse financial period strings into sortable keys.
 * Used for chronological ordering (2018-2025 left to right).
 */

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Parse "Mar 2018", "Dec 2022", "Jun 2023", etc. into YYYYMM for sorting. TTM/undefined → 999999 (sort last). */
export function parsePeriodSortKey(period: string | number | undefined): number {
  if (period == null || period === "") return 999999
  const s = String(period).trim().toLowerCase()
  if (s === "ttm" || s === "—") return 999999

  const digits = s.replace(/\D/g, "")
  const year = parseInt(digits.slice(-4), 10) || 0
  if (!year) return 999999

  let month = 3
  for (const [key, val] of Object.entries(MONTH_MAP)) {
    if (s.includes(key)) {
      month = val
      break
    }
  }

  return year * 100 + month
}

/** Sort data rows by period ascending (oldest first). */
export function sortByPeriodAsc<T extends { header?: string; year?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const keyA = parsePeriodSortKey(a.header ?? a.year)
    const keyB = parsePeriodSortKey(b.header ?? b.year)
    return keyA - keyB
  })
}

/** Sort data rows by period descending (newest first). */
export function sortByPeriodDesc<T extends { header?: string; year?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const keyA = parsePeriodSortKey(a.header ?? a.year)
    const keyB = parsePeriodSortKey(b.header ?? b.year)
    return keyB - keyA
  })
}
