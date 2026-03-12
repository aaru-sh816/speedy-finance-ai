"use client"

import { useState, useMemo } from "react"

interface MiniBarChartProps {
  data: number[]
  labels?: string[]
  width?: number
  height?: number
  color?: string
  formatValue?: (val: number) => string
  onHoverChange?: (index: number | null) => void
}

export function MiniBarChart({
  data,
  labels,
  width = 124,
  height = 100,
  color = "#10b981",
  formatValue = (v) => v.toLocaleString("en-IN"),
  onHoverChange,
}: MiniBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleHover = (index: number | null) => {
    setHoveredIndex(index)
    if (onHoverChange) onHoverChange(index)
  }

  const { bars } = useMemo(() => {
    if (!data.length) return { bars: [] }
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const barWidth = Math.max(2, (width - (data.length - 1) * 2) / data.length)

    return {
      bars: data.map((val, i) => {
        const h = ((val - min) / range) * (height - 4)
        const x = i * (barWidth + 2)
        const y = height - h
        return { x, y, w: barWidth, h, val }
      }),
    }
  }, [data, width, height])

  if (!data.length) return null

  const hovered = hoveredIndex != null ? bars[hoveredIndex] : null
  const hoveredLabel = hoveredIndex != null && labels ? labels[hoveredIndex] : null
  const hoveredVal = hovered != null ? hovered.val : null

  return (
    <div className="relative w-full h-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {bars.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={color}
              rx={2}
              ry={2}
              className="transition-all duration-300 ease-out cursor-pointer"
              onMouseEnter={() => handleHover(i)}
              onMouseLeave={() => handleHover(null)}
            />
          </g>
        ))}
      </svg>
      {hoveredIndex != null && hovered != null && (
        <div
          className="absolute z-50 px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/10 shadow-xl text-[10px] font-mono text-white whitespace-nowrap pointer-events-none"
          style={{
            left: Math.min(hovered.x + hovered.w / 2 - 40, width - 100),
            top: -28,
          }}
        >
          {hoveredLabel && <span className="text-zinc-400 mr-2">{hoveredLabel}</span>}
          <span className="font-black">{formatValue(hoveredVal ?? 0)}</span>
        </div>
      )}
    </div>
  )
}
