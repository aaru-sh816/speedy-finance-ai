'use client'

import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showArea?: boolean
  showDot?: boolean
  className?: string
}

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24, 
  color,
  showArea = true,
  showDot = true,
  className = ''
}: SparklineProps) {
  const { path, areaPath, isPositive, dotPosition } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', isPositive: true, dotPosition: { x: 0, y: 0 } }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padding = 2

    const points = data.map((value, index) => ({
      x: padding + (index / (data.length - 1)) * (width - padding * 2),
      y: padding + (1 - (value - min) / range) * (height - padding * 2),
    }))

    // Create smooth curve using cardinal spline
    const tension = 0.3
    let pathD = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] || p2

      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = p1.y + (p2.y - p0.y) * tension
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = p2.y - (p3.y - p1.y) * tension

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }

    // Area path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

    const lastPoint = points[points.length - 1]
    const firstValue = data[0]
    const lastValue = data[data.length - 1]

    return { 
      path: pathD, 
      areaPath: areaD,
      isPositive: lastValue >= firstValue,
      dotPosition: lastPoint
    }
  }, [data, width, height])

  if (data.length < 2) {
    return (
      <div 
        className={`flex items-center justify-center text-zinc-600 text-xs ${className}`}
        style={{ width, height }}
      >
        —
      </div>
    )
  }

  const strokeColor = color || (isPositive ? '#10b981' : '#ef4444')
  const fillColor = color || (isPositive ? '#10b981' : '#ef4444')

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <defs>
        <linearGradient id={`sparkline-gradient-${isPositive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {showArea && (
        <path
          d={areaPath}
          fill={`url(#sparkline-gradient-${isPositive ? 'up' : 'down'})`}
        />
      )}
      
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {showDot && (
        <>
          <circle
            cx={dotPosition.x}
            cy={dotPosition.y}
            r="3"
            fill={strokeColor}
          />
          <circle
            cx={dotPosition.x}
            cy={dotPosition.y}
            r="5"
            fill={strokeColor}
            opacity="0.3"
          >
            <animate
              attributeName="r"
              values="3;6;3"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}
    </svg>
  )
}

// Mini bar chart variant
interface MiniBarChartProps {
  data: { value: number; label?: string }[]
  width?: number
  height?: number
  className?: string
}

export function MiniBarChart({ data, width = 60, height = 20, className = '' }: MiniBarChartProps) {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)))
  const barWidth = (width - (data.length - 1) * 2) / data.length

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      {data.map((d, i) => {
        const isPositive = d.value >= 0
        const barHeight = (Math.abs(d.value) / maxValue) * (height / 2)
        const x = i * (barWidth + 2)
        const y = isPositive ? height / 2 - barHeight : height / 2

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx="1"
            fill={isPositive ? '#10b981' : '#ef4444'}
            opacity="0.8"
          />
        )
      })}
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#3f3f46" strokeWidth="0.5" />
    </svg>
  )
}

// Heatmap cell component
interface HeatmapCellProps {
  value: number // -100 to 100
  size?: number
  className?: string
}

export function HeatmapCell({ value, size = 40, className = '' }: HeatmapCellProps) {
  const intensity = Math.min(Math.abs(value) / 100, 1)
  const isPositive = value >= 0

  const backgroundColor = isPositive
    ? `rgba(16, 185, 129, ${intensity * 0.8})`
    : `rgba(239, 68, 68, ${intensity * 0.8})`

  return (
    <div
      className={`flex items-center justify-center rounded font-medium text-xs ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor,
        color: intensity > 0.5 ? 'white' : intensity > 0.3 ? '#d4d4d8' : '#71717a',
      }}
    >
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </div>
  )
}

// Progress towards target price
interface PriceTargetProgressProps {
  currentPrice: number
  targetPrice: number
  entryPrice?: number
  stopLoss?: number
  width?: number
  className?: string
}

export function PriceTargetProgress({ 
  currentPrice, 
  targetPrice, 
  entryPrice, 
  stopLoss,
  width = 120,
  className = '' 
}: PriceTargetProgressProps) {
  const isAboveTarget = targetPrice > (entryPrice || currentPrice)
  const entry = entryPrice || currentPrice
  const range = Math.abs(targetPrice - (stopLoss || entry * 0.95))
  const progress = ((currentPrice - entry) / (targetPrice - entry)) * 100
  const progressClamped = Math.max(0, Math.min(100, progress))
  const isProfit = currentPrice >= entry

  return (
    <div className={`${className}`} style={{ width }}>
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        {/* Stop loss zone */}
        {stopLoss && (
          <div
            className="absolute h-full bg-rose-500/30"
            style={{
              left: 0,
              width: `${Math.max(0, ((entry - stopLoss) / range) * 100)}%`,
            }}
          />
        )}
        
        {/* Progress bar */}
        <div
          className={`absolute h-full rounded-full transition-all duration-500 ${
            isProfit ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${progressClamped}%` }}
        />
        
        {/* Entry marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/50"
          style={{ left: '0%' }}
        />
        
        {/* Current position marker */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white ${
            isProfit ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ left: `calc(${progressClamped}% - 4px)` }}
        />
      </div>
      
      <div className="flex justify-between mt-1 text-[10px]">
        <span className="text-zinc-500">
          {stopLoss ? `SL: ₹${stopLoss.toLocaleString()}` : 'Entry'}
        </span>
        <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
          {progress.toFixed(0)}%
        </span>
        <span className="text-zinc-500">
          T: ₹{targetPrice.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
