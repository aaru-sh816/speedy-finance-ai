"use client"

/**
 * Luxury initial-letter avatar shown when company logo is unavailable.
 * Used in calendar event rows and company page header.
 */
export function FallbackAvatar({
  initial,
  size,
  className = "",
}: {
  initial: string
  size: number
  className?: string
}) {
  const letter = (initial?.charAt(0) || "?").toUpperCase()

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-full border border-white/10 bg-white/[0.06] text-white/70 font-bold uppercase ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size <= 18 ? 10 : size <= 22 ? 11 : 18,
      }}
      aria-hidden
    >
      {letter}
    </div>
  )
}
