"use client"

import { useMemo } from "react"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  fillColor?: string
  showArea?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeColor,
  fillColor,
  showArea = true,
  className = ""
}: SparklineProps) {
  const { path, areaPath, isPositive, changePercent } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: "", areaPath: "", isPositive: true, changePercent: 0 }
    }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    
    const padding = 2
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth
      const y = padding + chartHeight - ((value - min) / range) * chartHeight
      return { x, y }
    })
    
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
    
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${padding} ${height - padding} Z`
    
    const first = data[0]
    const last = data[data.length - 1]
    const positive = last >= first
    const change = first !== 0 ? ((last - first) / first) * 100 : 0
    
    return { path: pathD, areaPath: areaD, isPositive: positive, changePercent: change }
  }, [data, width, height])

  if (!data || data.length < 2) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-[10px] text-zinc-500">No data</span>
      </div>
    )
  }

  const defaultStroke = isPositive ? "#10b981" : "#f43f5e"
  const defaultFill = isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)"

  return (
    <svg 
      width={width} 
      height={height} 
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && (
        <path
          d={areaPath}
          fill={fillColor || defaultFill}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={strokeColor || defaultStroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface SparklineWithLabelProps extends SparklineProps {
  label?: string
  value?: string
  showChange?: boolean
}

export function SparklineWithLabel({
  data,
  label,
  value,
  showChange = true,
  ...props
}: SparklineWithLabelProps) {
  const changePercent = useMemo(() => {
    if (!data || data.length < 2) return 0
    const first = data[0]
    const last = data[data.length - 1]
    return first !== 0 ? ((last - first) / first) * 100 : 0
  }, [data])

  const isPositive = changePercent >= 0

  return (
    <div className="flex items-center gap-2">
      <Sparkline data={data} {...props} />
      <div className="flex flex-col">
        {label && <span className="text-[10px] text-zinc-500">{label}</span>}
        {showChange && (
          <span className={`text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

// Generate mock sparkline data for demonstration
export function generateMockSparklineData(
  startPrice: number,
  endPrice: number,
  points: number = 10,
  volatility: number = 0.02
): number[] {
  const data: number[] = [startPrice]
  const trend = (endPrice - startPrice) / points
  
  for (let i = 1; i < points - 1; i++) {
    const base = startPrice + trend * i
    const noise = base * volatility * (Math.random() - 0.5) * 2
    data.push(Math.max(0, base + noise))
  }
  
  data.push(endPrice)
  return data
}
