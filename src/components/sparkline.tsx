"use client"

import { useMemo } from "react"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
  showGradient?: boolean
}

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "currentColor",
  strokeWidth = 2,
  showGradient = true,
}: SparklineProps) {
  const { points, areaPoints } = useMemo(() => {
    if (!data.length) return { points: "", areaPoints: "" }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const step = width / (data.length - 1)

    const pts = data.map((val, i) => {
      const x = i * step
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })

    return {
      points: pts.join(" "),
      areaPoints: `${pts.join(" ")} ${width},${height} 0,${height}`,
    }
  }, [data, width, height])

  if (!data.length) return null

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      className="overflow-visible drop-shadow-[0_2px_8px_var(--tw-shadow-color)]"
      style={{ "--tw-shadow-color": `${color}33` } as React.CSSProperties}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showGradient && (
        <polygon
          fill={`url(#${gradientId})`}
          points={areaPoints}
          className="transition-all duration-700 ease-in-out"
        />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="transition-all duration-700 ease-in-out"
      />
    </svg>
  )
}
