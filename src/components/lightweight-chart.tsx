"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, LineData, Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape, HistogramData } from "lightweight-charts"
import { AlertTriangle, RefreshCw, Maximize2, Minimize2, Calendar, Clock, Filter, Info, AreaChart, BarChart3, LineChart, CheckCircle2, X, ExternalLink, TrendingUp } from "lucide-react"
import { BSEAnnouncement } from "@/lib/bse/types"
import { cn } from "@/lib/utils"
import { SentimentBadge } from "@/components/sentiment-badge"

interface OHLCVData {
  time: Time
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

function calculateSMA(data: OHLCVData[], period: number): LineData[] {
  const result: LineData[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    })
  }
  return result
}

interface LightweightChartProps {
  symbol: string
  scripCode?: string
  exchange?: string
  height?: number
  targetDate?: string // ISO string or YYYY-MM-DD
  theme?: "light" | "dark"
  type?: "candle" | "line" | "area"
  announcements?: BSEAnnouncement[]
  showControls?: boolean
  highlightedAnnouncementId?: string | null
}

const RANGE_MAP = {
  "1D": 1,
  "3D": 3,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "ALL": 365 * 2,
}

type RangeKey = keyof typeof RANGE_MAP

export function LightweightChart({
  symbol,
  scripCode,
  exchange = "BSE",
  height = 400,
  targetDate,
  theme = "dark",
  type = "area",
  announcements = [],
  showControls = true,
  highlightedAnnouncementId,
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Area"> | null>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const vpCanvasRef = useRef<HTMLCanvasElement>(null)

  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeRange, setActiveRange] = useState<RangeKey>("1M")
  const [chartData, setChartData] = useState<(CandlestickData | LineData)[]>([])
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<BSEAnnouncement[]>([])
  const [currentChartType, setCurrentChartType] = useState<"candle" | "line" | "area">(type)
  const [tickData, setTickData] = useState(false)
    const [showVolume, setShowVolume] = useState(false)
    const [showVolumeProfile, setShowVolumeProfile] = useState(false)
    const [showSMA50, setShowSMA50] = useState(false)
    const [vpTooltip, setVpTooltip] = useState<{ x: number; y: number; price: string; volume: string } | null>(null)
    const vpBinsRef = useRef<{ priceBottom: number; priceTop: number; volume: number; yTop: number; yBottom: number; barWidth: number }[]>([])

  const [showSMA200, setShowSMA200] = useState(false)
  const [ohlcvData, setOhlcvData] = useState<OHLCVData[]>([])
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const sma200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<BSEAnnouncement | null>(null)
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)

  // Determine marker properties based on category
  const formatVolume = (vol: number) => {
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + ' Cr'
    if (vol >= 100000) return (vol / 100000).toFixed(2) + ' L'
    if (vol >= 1000) return (vol / 1000).toFixed(2) + ' K'
    return vol.toString()
  }

  const getMarkerProps = (category: string): { text: string; color: string } => {
    const cat = category.toLowerCase()
    if (cat.includes('result')) return { text: 'R', color: '#f59e0b' } // Amber
    if (cat.includes('board')) return { text: 'B', color: '#f97316' } // Orange
    if (cat.includes('general') || cat.includes('intimation')) return { text: 'G', color: '#8b5cf6' } // Purple
    if (cat.includes('dividend')) return { text: 'D', color: '#ec4899' } // Pink
    return { text: 'A', color: '#06b6d4' } // Cyan
  }

  useEffect(() => {
    if (!chartContainerRef.current || !symbol) return

    setLoading(true)
    setError(null)

    const isDark = theme === "dark"
    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#09090b" : "#ffffff" },
        textColor: isDark ? "#a1a1aa" : "#3f3f46",
      },
      grid: {
        vertLines: { color: isDark ? "#18181b" : "#f4f4f5" },
        horzLines: { color: isDark ? "#18181b" : "#f4f4f5" },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      crosshair: {
        vertLine: {
            color: isDark ? "#3f3f46" : "#d4d4d8",
            width: 0.5,
            style: 1,
            labelBackgroundColor: "#06b6d4",
        },
        horzLine: {
            color: isDark ? "#3f3f46" : "#d4d4d8",
            width: 0.5,
            style: 1,
            labelBackgroundColor: "#06b6d4",
        },
      },
      watermark: {
        visible: true,
        fontSize: 24,
        horzAlign: 'center',
        vertAlign: 'center',
        color: isDark ? 'rgba(161, 161, 170, 0.05)' : 'rgba(63, 63, 70, 0.05)',
        text: symbol,
      },
    }

    const chart = createChart(chartContainerRef.current, chartOptions as any)
    let isCancelled = false
    
    let series: ISeriesApi<"Candlestick" | "Line" | "Area">
    if (currentChartType === "candle") {
      series = chart.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      })
    } else if (currentChartType === "area") {
      series = chart.addAreaSeries({
        lineColor: "#06b6d4",
        topColor: "rgba(6, 182, 212, 0.3)",
        bottomColor: "rgba(6, 182, 212, 0.05)",
        lineWidth: 2,
      })
    } else {
      series = chart.addLineSeries({
        color: "#06b6d4",
        lineWidth: 2,
        crosshairMarkerVisible: true,
      })
    }

    chartRef.current = chart
      seriesRef.current = series

    const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
          visible: false,
        })
        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        })
        volumeSeriesRef.current = volumeSeries

        const sma50Series = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          visible: false,
        })
        sma50SeriesRef.current = sma50Series

        const sma200Series = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 1,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          visible: false,
        })
        sma200SeriesRef.current = sma200Series

      // Tooltip handling
    chart.subscribeCrosshairMove(param => {
        if (!tooltipRef.current || !chartContainerRef.current) return
        
        if (
            param.point === undefined ||
            !param.time ||
            param.point.x < 0 ||
            param.point.x > chartContainerRef.current.clientWidth ||
            param.point.y < 0 ||
            param.point.y > height
        ) {
            tooltipRef.current.style.display = 'none'
        } else {
            const dateStr = param.time as string
            const data = param.seriesData.get(series) as any
            const volumeData = volumeSeriesRef.current ? param.seriesData.get(volumeSeriesRef.current) as any : null
            const price = data?.value !== undefined ? data.value : data?.close
            const volume = volumeData?.value
            
            if (price !== undefined && price !== null) {
                tooltipRef.current.style.display = 'block'
                
                let dateDisplay = '—'
                try {
                    const dateObj = typeof param.time === 'string' ? new Date(param.time) : new Date((param.time as any))
                    if (!isNaN(dateObj.getTime())) {
                        dateDisplay = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    }
                } catch (e) {
                    console.error("Tooltip date error:", e)
                }

                tooltipRef.current.innerHTML = `
                    <div class="flex flex-col gap-1">
                        <div class="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">${dateDisplay}</div>
                        <div class="flex flex-col">
                          <div class="text-xs font-bold text-white">₹${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          ${volume !== undefined ? `<div class="text-[10px] text-zinc-400 font-medium mt-0.5">Vol: ${formatVolume(volume)}</div>` : ''}
                        </div>
                    </div>
                `
                
                const coordinate = series.priceToCoordinate(price)
                let shiftedX = param.point.x + 10
                if (shiftedX > chartContainerRef.current.clientWidth - 120) {
                    shiftedX = param.point.x - 120
                }
                
                let shiftedY = coordinate ? coordinate - 60 : param.point.y - 60
                if (shiftedY < 0) shiftedY = param.point.y + 20
                
                tooltipRef.current.style.left = shiftedX + 'px'
                tooltipRef.current.style.top = shiftedY + 'px'
            }
        }
    })

    // Marker click handling
    chart.subscribeClick(param => {
        if (!param.point || !param.time) {
            setSelectedAnnouncement(null)
            return
        }

        const clickedTime = param.time as string
        const announcement = announcements.find(a => a.time.split('T')[0] === clickedTime)
        
        if (announcement) {
            setSelectedAnnouncement(announcement)
            setPopupPosition({ x: param.point.x, y: param.point.y })
        } else {
            setSelectedAnnouncement(null)
        }
    })

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener("resize", handleResize)

    // Fetch data
    const fetchData = async () => {
      if (isCancelled) return
      try {
        const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year back
        const toDate = new Date().toISOString().split('T')[0]

        const response = await fetch(`/api/bse/history?symbol=${symbol}&scripCode=${scripCode || ''}&exchange=${exchange}&fromDate=${fromDate}&toDate=${toDate}`)
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || "Historical data unavailable for this symbol")
        }
        
        const rawData = await response.json()
        if (isCancelled) return

        const dataPoints = Array.isArray(rawData) ? rawData : (rawData.data || [])
          
          const ohlcvParsed: OHLCVData[] = dataPoints
            .map((d: any) => {
              if (!d.date) return null
              const time = (d.date.split('T')[0]) as Time
              const open = parseFloat(d.open)
              const high = parseFloat(d.high)
              const low = parseFloat(d.low)
              const close = parseFloat(d.close)
              const volume = parseFloat(d.volume) || 0
              if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null
              return { time, open, high, low, close, volume }
            })
            .filter((d: any): d is OHLCVData => d !== null)
            .reduce((acc: OHLCVData[], current: OHLCVData) => {
              const x = acc.find(item => item.time === current.time)
              if (!x) {
                return acc.concat([current])
              } else {
                return acc
              }
            }, [])
            .sort((a: OHLCVData, b: OHLCVData) => (a.time > b.time ? 1 : -1))

          setOhlcvData(ohlcvParsed)

          const formattedData: (CandlestickData | LineData)[] = ohlcvParsed.map((d) => {
            if (currentChartType === "candle") {
              return { time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }
            } else {
              return { time: d.time, value: d.close }
            }
          })

        if (formattedData.length === 0) {
            throw new Error("No historical data available")
        }

        setChartData(formattedData)
          series.setData(formattedData as any)

          const volumeData: HistogramData[] = ohlcvParsed.map((d, i) => ({
            time: d.time,
            value: d.volume || 0,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
          }))
          volumeSeries.setData(volumeData)

          if (ohlcvParsed.length >= 50) {
            const sma50Data = calculateSMA(ohlcvParsed, 50)
            sma50Series.setData(sma50Data)
          }

          if (ohlcvParsed.length >= 200) {
            const sma200Data = calculateSMA(ohlcvParsed, 200)
            sma200Series.setData(sma200Data)
          }

          // Add Real-time Price Line
        const lastPrice = (formattedData[formattedData.length - 1] as any).value || (formattedData[formattedData.length - 1] as any).close
        if (lastPrice != null && !isNaN(lastPrice)) {
            series.createPriceLine({
                price: lastPrice,
                color: '#06b6d4',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: 'CURRENT',
            })
        }

        // Add Markers for announcements
        if (announcements.length > 0) {
            const markers: SeriesMarker<Time>[] = announcements
                .filter(a => a.time && formattedData.some(d => d.time === a.time.split('T')[0]))
                .map(a => {
                    const { text, color } = getMarkerProps(a.category)
                    return {
                        time: a.time.split('T')[0] as Time,
                        position: 'inPrice' as SeriesMarkerPosition,
                        color: color,
                        shape: 'circle' as SeriesMarkerShape,
                        text: text,
                        size: 1.2,
                    }
                })
            
            // Add current target date marker if not in announcements
            if (targetDate) {
                const tDate = targetDate.split('T')[0]
                if (tDate && !markers.some(m => m.time === tDate)) {
                    markers.push({
                        time: tDate as Time,
                        position: 'inPrice' as SeriesMarkerPosition,
                        color: '#06b6d4',
                        shape: 'circle' as SeriesMarkerShape,
                        text: 'A',
                        size: 1.5,
                    })
                }
            }
            
            series.setMarkers(markers.sort((a: any, b: any) => (a.time > b.time ? 1 : -1)))
        }

        // Set initial visible range based on activeRange
        const days = RANGE_MAP[activeRange]
        const visibleData = formattedData.slice(-Math.min(formattedData.length, days))
        if (visibleData.length > 0) {
            chart.timeScale().setVisibleRange({
                from: visibleData[0].time as Time,
                to: visibleData[visibleData.length - 1].time as Time,
            })
        }

        if (!isCancelled) setLoading(false)
      } catch (err: any) {
        if (!isCancelled) {
          // Avoid console error for known "not found" cases to reduce noise
          if (
            err.message !== "No historical data found for this symbol on any exchange" && 
            err.message !== "No historical data available"
          ) {
            console.error("Chart data error:", err)
          }
          setError(err.message || "Failed to load chart data")
          setLoading(false)
        }
      }
    }

    fetchData()

      return () => {
        isCancelled = true
        window.removeEventListener("resize", handleResize)
        chart.remove()
        chartRef.current = null
        seriesRef.current = null
        volumeSeriesRef.current = null
        sma50SeriesRef.current = null
        sma200SeriesRef.current = null
      }
    }, [symbol, exchange, theme, height, currentChartType]) // Now depends on currentChartType

    useEffect(() => {
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.applyOptions({ visible: showVolume })
      }
    }, [showVolume])

    useEffect(() => {
      if (sma50SeriesRef.current) {
        sma50SeriesRef.current.applyOptions({ visible: showSMA50 })
      }
    }, [showSMA50])

    useEffect(() => {
      if (sma200SeriesRef.current) {
        sma200SeriesRef.current.applyOptions({ visible: showSMA200 })
      }
    }, [showSMA200])

    // Volume Profile (Fixed Range) Effect
    useEffect(() => {
      if (!showVolumeProfile || !chartRef.current || !seriesRef.current || ohlcvData.length === 0 || !vpCanvasRef.current) {
        if (vpCanvasRef.current) {
          const ctx = vpCanvasRef.current.getContext('2d')
          ctx?.clearRect(0, 0, vpCanvasRef.current.width, vpCanvasRef.current.height)
        }
        vpBinsRef.current = []
        return
      }

      const chart = chartRef.current
      const series = seriesRef.current
      const canvas = vpCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const updateVolumeProfile = () => {
        const timeScale = chart.timeScale()
        const visibleRange = timeScale.getVisibleRange()
        if (!visibleRange) return

        // Filter data in visible range
        const visibleData = ohlcvData.filter(d => d.time >= visibleRange.from && d.time <= visibleRange.to)
        if (visibleData.length === 0) return

        // Calculate price range
        let minPrice = Infinity
        let maxPrice = -Infinity
        visibleData.forEach(d => {
          if (d.low < minPrice) minPrice = d.low
          if (d.high > maxPrice) maxPrice = d.high
        })

        if (minPrice === Infinity || maxPrice === -Infinity) return

        // Create bins (40 bins)
        const numBins = 40
        const binSize = (maxPrice - minPrice) / numBins
        const bins = new Array(numBins).fill(0)

        visibleData.forEach(d => {
          const avgPrice = (d.high + d.low + d.close) / 3
          const binIndex = Math.min(numBins - 1, Math.floor((avgPrice - minPrice) / binSize))
          if (binIndex >= 0) {
            bins[binIndex] += d.volume || 0
          }
        })

        const maxVolume = Math.max(...bins)
        const pocIndex = bins.indexOf(maxVolume)
        
        // Draw
        const width = canvas.width
        const height = canvas.height
        ctx.clearRect(0, 0, width, height)

        const maxBarWidth = width * 0.35 // Max 35% of chart width
        const storedBins: typeof vpBinsRef.current = []
        
        bins.forEach((vol, i) => {
          if (vol === 0) return
          
          const priceBottom = minPrice + i * binSize
          const priceTop = priceBottom + binSize
          
          const yTop = series.priceToCoordinate(priceTop)
          const yBottom = series.priceToCoordinate(priceBottom)
          
          if (yTop === null || yBottom === null) return
          
          const barHeight = Math.abs(yBottom - yTop)
          const barWidth = (vol / maxVolume) * maxBarWidth
          
          storedBins.push({ priceBottom, priceTop, volume: vol, yTop, yBottom, barWidth })
          
          // Use theme colors with gradients
          const isPOC = i === pocIndex
          if (isPOC) {
            ctx.fillStyle = theme === 'dark' ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.45)'
          } else {
            ctx.fillStyle = theme === 'dark' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.25)'
          }
          ctx.fillRect(width - barWidth, yTop, barWidth, barHeight - 1)
          
          // Add border to POC
          if (isPOC) {
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)'
            ctx.lineWidth = 1.5
            ctx.strokeRect(width - barWidth, yTop, barWidth, barHeight - 1)
            
            // Add POC label
            ctx.fillStyle = '#06b6d4'
            ctx.font = 'bold 9px sans-serif'
            ctx.fillText('POC', width - barWidth - 28, yTop + barHeight / 2 + 3)
          }
        })
        
        vpBinsRef.current = storedBins
      }

      // Initial update
      updateVolumeProfile()

      // Subscribe to changes
      chart.timeScale().subscribeVisibleTimeRangeChange(updateVolumeProfile)
      
      return () => {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(updateVolumeProfile)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        vpBinsRef.current = []
      }
    }, [showVolumeProfile, ohlcvData, theme])

    // Volume Profile hover handler
    const handleVpCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!showVolumeProfile || !vpCanvasRef.current || vpBinsRef.current.length === 0) {
        setVpTooltip(null)
        return
      }
      
      const rect = vpCanvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const canvasWidth = vpCanvasRef.current.width
      
      // Check if cursor is in the right-side volume profile area
      const hitBin = vpBinsRef.current.find(bin => {
        const barX = canvasWidth - bin.barWidth
        return x >= barX && x <= canvasWidth && y >= bin.yTop && y <= bin.yBottom
      })
      
      if (hitBin) {
        const priceRange = `₹${hitBin.priceBottom.toFixed(2)} - ₹${hitBin.priceTop.toFixed(2)}`
        const volStr = formatVolume(hitBin.volume)
        setVpTooltip({ x: e.clientX - rect.left - 140, y: e.clientY - rect.top - 50, price: priceRange, volume: volStr })
      } else {
        setVpTooltip(null)
      }
    }

    const handleVpCanvasLeave = () => {
      setVpTooltip(null)
    }

    // Update visible range when activeRange changes
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return

    const days = RANGE_MAP[activeRange]
    const visibleData = chartData.slice(-Math.min(chartData.length, days))
    if (visibleData.length > 0) {
        chartRef.current.timeScale().setVisibleRange({
            from: visibleData[0].time as Time,
            to: visibleData[visibleData.length - 1].time as Time,
        })
    }
  }, [activeRange, chartData])

  // Update focus when targetDate changes
  useEffect(() => {
    if (!chartRef.current || !targetDate || chartData.length === 0) return

    const tDate = targetDate.split('T')[0]
    const targetIndex = chartData.findIndex(d => d.time === tDate)
    
    if (targetIndex !== -1) {
      const fromIndex = Math.max(0, targetIndex - 15)
      const toIndex = Math.min(chartData.length - 1, targetIndex + 15)
      
      chartRef.current.timeScale().setVisibleRange({
          from: chartData[fromIndex].time as Time,
          to: chartData[toIndex].time as Time,
      })
    }
  }, [targetDate, chartData])

  // Auto-popup when highlightedAnnouncementId changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !highlightedAnnouncementId || announcements.length === 0 || chartData.length === 0) {
      return
    }

    const announcement = announcements.find(a => a.id === highlightedAnnouncementId)
    if (!announcement) return

    const tDate = announcement.time.split('T')[0] as Time
    const dataPoint = chartData.find(d => d.time === tDate)
    
    if (dataPoint) {
      // Need a small timeout to ensure chart has finished rendering/scaling
      const timer = setTimeout(() => {
        if (!chartRef.current || !seriesRef.current) return
        
        const x = chartRef.current.timeScale().timeToCoordinate(tDate)
        const price = (dataPoint as any).value || (dataPoint as any).close
        const y = seriesRef.current.priceToCoordinate(price)

        if (x !== null && y !== null) {
          setSelectedAnnouncement(announcement)
          setPopupPosition({ x, y })
          
          // Also focus the chart on this point
          const targetIndex = chartData.findIndex(d => d.time === tDate)
          if (targetIndex !== -1) {
            const fromIndex = Math.max(0, targetIndex - 15)
            const toIndex = Math.min(chartData.length - 1, targetIndex + 15)
            chartRef.current.timeScale().setVisibleRange({
                from: chartData[fromIndex].time as Time,
                to: chartData[toIndex].time as Time,
            })
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [highlightedAnnouncementId, announcements, chartData])

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100] h-screen' : ''}`}>
      {showControls && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3">
                {/* Range Selectors */}
                <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-lg border border-zinc-800">
                    {(Object.keys(RANGE_MAP) as RangeKey[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setActiveRange(range)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                activeRange === range 
                                    ? "bg-zinc-100 text-black shadow-lg" 
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>

                <div className="h-4 w-px bg-zinc-800 mx-1" />

                {/* Tick Data Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                      <div 
                          onClick={() => setTickData(!tickData)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${tickData ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                      >
                          {tickData && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300">Tick Data</span>
                  </label>

                  <div className="h-4 w-px bg-zinc-800 mx-1" />

                    {/* Volume Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div 
                            onClick={() => setShowVolume(!showVolume)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showVolume ? 'bg-teal-500 border-teal-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                        >
                            {showVolume && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300">Volume</span>
                    </label>

                    {/* Volume Profile Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div 
                            onClick={() => setShowVolumeProfile(!showVolumeProfile)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showVolumeProfile ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                        >
                            {showVolumeProfile && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300">Vol Profile</span>
                    </label>

                    {/* 50 DMA Toggle */}

                  <label className="flex items-center gap-2 cursor-pointer group">
                      <div 
                          onClick={() => setShowSMA50(!showSMA50)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showSMA50 ? 'bg-amber-500 border-amber-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                      >
                          {showSMA50 && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300">50 DMA</span>
                  </label>

                  {/* 200 DMA Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                      <div 
                          onClick={() => setShowSMA200(!showSMA200)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showSMA200 ? 'bg-purple-500 border-purple-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                      >
                          {showSMA200 && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300">200 DMA</span>
                  </label>
              </div>
            
            <div className="flex items-center gap-3">
                {/* Chart Type Toggles */}
                <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-lg border border-zinc-800">
                    <button
                        onClick={() => setCurrentChartType("line")}
                        className={`p-1.5 rounded-md transition-all ${currentChartType === "line" ? "bg-zinc-800 text-cyan-400" : "text-zinc-500 hover:text-zinc-300"}`}
                        title="Line Chart"
                    >
                        <LineChart className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setCurrentChartType("area")}
                        className={`p-1.5 rounded-md transition-all ${currentChartType === "area" ? "bg-zinc-800 text-cyan-400" : "text-zinc-500 hover:text-zinc-300"}`}
                        title="Area Chart"
                    >
                        <AreaChart className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setCurrentChartType("candle")}
                        className={`p-1.5 rounded-md transition-all ${currentChartType === "candle" ? "bg-zinc-800 text-cyan-400" : "text-zinc-500 hover:text-zinc-300"}`}
                        title="Candlestick Chart"
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="h-4 w-px bg-zinc-800 mx-1" />

                {/* Marker Legend */}
                <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-950/50 border border-zinc-800">
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">R</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]" />
                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tight">B</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(139,92,246,0.5)]" />
                        <span className="text-[9px] font-bold text-purple-500 uppercase tracking-tight">G</span>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-1.5 rounded-lg bg-zinc-950/50 border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
            </div>
        </div>
      )}

      <div className="relative flex-1">
          <div ref={chartContainerRef} className="w-full" style={{ height: isFullscreen ? 'calc(100vh - 60px)' : `${height}px` }} />
          <canvas 
            ref={vpCanvasRef} 
            className={`absolute inset-0 z-10 ${showVolumeProfile ? 'pointer-events-auto' : 'pointer-events-none'}`}
            width={chartContainerRef.current?.clientWidth || 800}
            height={isFullscreen ? (typeof window !== 'undefined' ? window.innerHeight - 60 : 800) : height}
            onMouseMove={handleVpCanvasMove}
            onMouseLeave={handleVpCanvasLeave}
          />
          
          {/* Volume Profile Tooltip */}
          {vpTooltip && (
            <div 
              className="absolute z-50 p-2.5 bg-zinc-900/95 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl animate-in fade-in duration-100"
              style={{ left: vpTooltip.x, top: vpTooltip.y }}
            >
              <div className="flex flex-col gap-1">
                <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">Volume Profile</div>
                <div className="text-[10px] text-zinc-400">{vpTooltip.price}</div>
                <div className="text-xs font-bold text-white">Vol: {vpTooltip.volume}</div>
              </div>
            </div>
          )}
          
          <div ref={tooltipRef} className="absolute z-50 pointer-events-none hidden p-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-2xl min-w-[120px]" />
          
          {/* Announcement Popup */}
          {selectedAnnouncement && popupPosition && (
            <div 
              className="absolute z-[60] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-4 w-[280px] animate-in zoom-in-95 duration-200"
              style={{ 
                left: Math.min(popupPosition.x + 10, (chartContainerRef.current?.clientWidth || 0) - 290),
                top: Math.max(10, Math.min(popupPosition.y - 120, (chartContainerRef.current?.clientHeight || 0) - 180))
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    getMarkerProps(selectedAnnouncement.category).color === '#f59e0b' ? "bg-amber-500" :
                    getMarkerProps(selectedAnnouncement.category).color === '#f97316' ? "bg-orange-500" : "bg-purple-500"
                  )} />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedAnnouncement.category}</span>
                </div>
                <button onClick={() => setSelectedAnnouncement(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white leading-snug line-clamp-2">{selectedAnnouncement.headline}</h4>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(selectedAnnouncement.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(selectedAnnouncement.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                </div>
                
                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/50 p-2 rounded-lg border border-white/5 italic">
                  {selectedAnnouncement.summary || selectedAnnouncement.headline}
                </p>
                
                <div className="pt-2 flex items-center justify-between">
                  <SentimentBadge text={`${selectedAnnouncement.headline} ${selectedAnnouncement.summary || ''}`} compact />
                  <a 
                    href={selectedAnnouncement.pdfUrl ?? '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>Read PDF</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

        
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-40">
                <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 text-cyan-500 animate-spin" />
                    <span className="text-xs text-zinc-400">Loading historical data...</span>
                </div>
            </div>
        )}

          {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm px-6 text-center z-40">
                  <div className="flex flex-col items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-amber-500/60" />
                      <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {error === "No historical data found for this symbol on any exchange" 
                              ? `Data for ${symbol} is currently unavailable on Yahoo Finance`
                              : error}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">
                            {error.includes("symbol validity") ? "Please check if the symbol is correct" : "Our systems are trying multiple exchanges (BSE/NSE) to find a match"}
                          </p>
                      </div>
                      <button 
                          onClick={() => {
                            setError(null);
                            setLoading(true);
                            // This will trigger the useEffect to run again as it depends on symbol/scripCode
                            window.location.reload();
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium hover:bg-zinc-700 transition-all border border-zinc-700"
                      >
                          <RefreshCw className="h-3 w-3" />
                          Try Again
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 text-[9px] text-zinc-600">
        <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {chartData.length > 0 ? `${new Date(chartData[0].time as string).getFullYear()} - ${new Date(chartData[chartData.length-1].time as string).getFullYear()}` : '—'}
            </span>
            <span className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                Price in ₹ (INR)
            </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Powered by</span>
          <span className="font-bold text-zinc-500">Speedy Finance AI</span>
        </div>
      </div>
    </div>
  )
}
