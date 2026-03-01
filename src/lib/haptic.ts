export type HapticIntensity = "light" | "medium" | "heavy"

const PATTERNS: Record<HapticIntensity, number[]> = {
  light: [5],
  medium: [10],
  heavy: [20],
}

export function hapticFeedback(intensity: HapticIntensity = "light"): void {
  if (typeof navigator === "undefined") return
  if ("vibrate" in navigator) {
    navigator.vibrate(PATTERNS[intensity])
  }
}

export const haptic = {
  monthChange: () => hapticFeedback("medium"),
  viewChange: () => hapticFeedback("light"),
  toggleFilter: () => hapticFeedback("light"),
  exportAction: () => hapticFeedback("medium"),
  swipeComplete: () => hapticFeedback("medium"),
  cellExpand: () => hapticFeedback("light"),
}
