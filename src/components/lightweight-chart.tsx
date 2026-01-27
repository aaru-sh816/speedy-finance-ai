"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, LineData, Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape, HistogramData } from "lightweight-charts"
import { AlertTriangle, RefreshCw, Maximize2, Minimize2, Calendar, Clock, Filter, Info, AreaChart, BarChart3, LineChart, CheckCircle2, X, ExternalLink, TrendingUp, Waves } from "lucide-react"
import { BSEAnnouncement } from "@/lib/bse/types"
import { cn } from "@/lib/utils"
import { SentimentBadge } from "@/components/sentiment-badge"
import type { WhaleDeal } from "@/hooks/useWhaleDeals"

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
  whaleDeals?: WhaleDeal[]
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

interface AggregatedWhaleDeal {
  date: string;
  side: 'BUY' | 'SELL';
  totalValue: number;
  avgPrice: number;
  deals: WhaleDeal[];
}

export function LightweightChart({
  symbol,
  scripCode,
  exchange = "BSE",
  height = 400,
  targetDate,
  theme = "dark",
  type = "area",
  announcements = [],
  whaleDeals = [],
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
      const [vpTooltip, setVpTooltip] = useState<{ x: number; y: number; price: string; volume: string; isPoc?: boolean; relativeVolume?: number; liquidityType?: 'Magnet' | 'Vacuum' } | null>(null)
      const vpBinsRef = useRef<{ priceBottom: number; priceTop: number; volume: number; yTop: number; yBottom: number; barWidth: number; isVah?: boolean; isVal?: boolean }[]>([])

      const [showSMA200, setShowSMA200] = useState(false)
      const [ohlcvData, setOhlcvData] = useState<OHLCVData[]>([])
      const [hoveredVpBin, setHoveredVpBin] = useState<{ priceBottom: number; priceTop: number; isPoc: boolean; yTop: number; yBottom: number } | null>(null)
      const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
    const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
    const sma200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<BSEAnnouncement | null>(null)
    const [selectedWhaleDeal, setSelectedWhaleDeal] = useState<AggregatedWhaleDeal | null>(null)
    const [hudView, setHudView] = useState<'whale' | 'announcement' | 'confluence'>('whale')
    const [confluenceTab, setConfluenceTab] = useState<'whale' | 'announcement'>('whale')
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)

    // Calculate Alpha (performance since signal)
    const alphaSinceSignal = useMemo(() => {
      const signal = selectedWhaleDeal || (selectedAnnouncement ? { date: selectedAnnouncement.time.split('T')[0], avgPrice: 0 } : null)
      if (!signal || chartData.length === 0) return null

      const signalDate = signal.date
      const currentPrice = (chartData[chartData.length - 1] as any).value || (chartData[chartData.length - 1] as any).close
      
      const signalPriceData = chartData.find(d => d.time === signalDate)
      if (!signalPriceData) return null
      
      const signalPrice = (signalPriceData as any).value || (signalPriceData as any).close
      if (!signalPrice) return null

      const change = ((currentPrice - signalPrice) / signalPrice) * 100
      const days = Math.floor((new Date().getTime() - new Date(signalDate).getTime()) / (1000 * 60 * 60 * 24))
      
      return { change, days, signalPrice, currentPrice }
    }, [selectedWhaleDeal, selectedAnnouncement, chartData])

  // Aggregate whale deals by date and side
  const aggregatedDeals = useMemo(() => {
    if (!whaleDeals) return []
    const groups = new Map<string, AggregatedWhaleDeal>()
    
    whaleDeals.forEach(w => {
      const dateKey = w.date.split('T')[0]
      const key = `${dateKey}_${w.side}`
      const existing = groups.get(key)
      const value = w.quantity * w.price
      
      if (existing) {
        existing.totalValue += value
        // Weighted average price
        const totalQty = existing.deals.reduce((acc, d) => acc + d.quantity, 0) + w.quantity
        existing.avgPrice = (existing.avgPrice * (totalQty - w.quantity) + w.price * w.quantity) / totalQty
        existing.deals.push(w)
      } else {
        groups.set(key, {
          date: dateKey,
          side: w.side,
          totalValue: value,
          avgPrice: w.price,
          deals: [w]
        })
      }
    })
    
    return Array.from(groups.values())
  }, [whaleDeals])

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
                  
                  let coordinate: number | null = null
                  try {
                      coordinate = series.priceToCoordinate(price)
                  } catch (e) {}
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
            setSelectedWhaleDeal(null)
            return
        }

        const clickedTime = param.time as string
        
        // Smart Multi-Selection for Confluence
        const whaleDeal = aggregatedDeals.find(w => w.date === clickedTime)
        const announcement = announcements.find(a => a.time.split('T')[0] === clickedTime)
        
        if (whaleDeal && announcement) {
            setSelectedWhaleDeal(whaleDeal)
            setSelectedAnnouncement(announcement)
            setHudView('confluence')
            setPopupPosition({ x: param.point.x, y: param.point.y })
        } else if (whaleDeal) {
            setSelectedWhaleDeal(whaleDeal)
            setSelectedAnnouncement(null)
            setHudView('whale')
            setPopupPosition({ x: param.point.x, y: param.point.y })
        } else if (announcement) {
            setSelectedAnnouncement(announcement)
            setSelectedWhaleDeal(null)
            setHudView('announcement')
            setPopupPosition({ x: param.point.x, y: param.point.y })
        } else {
            setSelectedAnnouncement(null)
            setSelectedWhaleDeal(null)
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

          // Add Markers for announcements and whale deals
          if (announcements.length > 0 || (whaleDeals && whaleDeals.length > 0)) {
              const markers: SeriesMarker<Time>[] = []
              const confluenceDates = new Set<string>()

              // Identify confluence dates
              const announcementDates = new Set(announcements.map(a => a.time.split('T')[0]))
              aggregatedDeals.forEach(w => {
                  if (announcementDates.has(w.date)) {
                      confluenceDates.add(w.date)
                  }
              })
              
              // Announcement markers
              if (announcements.length > 0) {
                announcements
                  .filter(a => a.time && formattedData.some(d => d.time === a.time.split('T')[0]))
                  .forEach(a => {
                      const date = a.time.split('T')[0]
                      const isConfluence = confluenceDates.has(date)
                      const { text, color } = getMarkerProps(a.category)
                      
                      markers.push({
                          time: date as Time,
                          position: 'inPrice' as SeriesMarkerPosition,
                          color: isConfluence ? '#06b6d4' : color, // Cyan for confluence
                          shape: 'circle' as SeriesMarkerShape,
                          text: isConfluence ? `! ${text}` : text,
                          size: isConfluence ? 1.5 : 1.2,
                      })
                  })
              }

              // Whale deal markers (Highly Advanced)
              if (aggregatedDeals.length > 0) {
                aggregatedDeals
                  .filter(w => w.date && formattedData.some(d => d.time === w.date))
                  .forEach(w => {
                      const date = w.date
                      const isConfluence = confluenceDates.has(date)
                      const dealValue = w.totalValue / 10000000 // In Crores
                      
                      // Calculate size based on deal value (min 1.2, max 3.0)
                      let size = Math.min(3.0, Math.max(1.2, 1.2 + Math.log10(Math.max(1, dealValue / 5))))
                      if (isConfluence) size += 0.5 // Make confluence whales bigger
                      
                      markers.push({
                          time: date as Time,
                          position: w.side === 'BUY' ? 'belowBar' : 'aboveBar',
                          color: isConfluence ? '#06b6d4' : (w.side === 'BUY' ? '#10b981' : '#ef4444'),
                          shape: w.side === 'BUY' ? 'arrowUp' : 'arrowDown',
                          text: isConfluence ? `🐳 CONFLUENCE` : (w.deals.length > 1 ? `W (${w.deals.length})` : 'W'),
                          size: size as any,
                      })
                  })
              }
            
            // Add current target date marker if not in markers
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
        let totalVolume = 0

        visibleData.forEach(d => {
          const avgPrice = (d.high + d.low + d.close) / 3
          const binIndex = Math.min(numBins - 1, Math.floor((avgPrice - minPrice) / binSize))
          if (binIndex >= 0) {
            bins[binIndex] += d.volume || 0
            totalVolume += d.volume || 0
          }
        })

        const maxVolume = Math.max(...bins)
        const pocIndex = bins.indexOf(maxVolume)
        
        // Calculate Value Area (70% of volume)
        let vaVolume = bins[pocIndex]
        let lowerIndex = pocIndex
        let upperIndex = pocIndex
        const vaTarget = totalVolume * 0.7

        while (vaVolume < vaTarget && (lowerIndex > 0 || upperIndex < numBins - 1)) {
          const prevVol = lowerIndex > 0 ? bins[lowerIndex - 1] : 0
          const nextVol = upperIndex < numBins - 1 ? bins[upperIndex + 1] : 0
          
          if (prevVol >= nextVol && lowerIndex > 0) {
            vaVolume += prevVol
            lowerIndex--
          } else if (upperIndex < numBins - 1) {
            vaVolume += nextVol
            upperIndex++
          } else if (lowerIndex > 0) {
            vaVolume += prevVol
            lowerIndex--
          } else {
            break
          }
        }
        
        // Draw
        const width = canvas.width
        const height = canvas.height
        ctx.clearRect(0, 0, width, height)

        const maxBarWidth = width * 0.35 // Max 35% of chart width
        const storedBins: typeof vpBinsRef.current = []
        
        bins.forEach((vol, i) => {
          if (vol === 0 && i !== pocIndex) return
          
          const priceBottom = minPrice + i * binSize
          const priceTop = priceBottom + binSize
          
          let yTop: number | null = null
          let yBottom: number | null = null
          try {
            yTop = series.priceToCoordinate(priceTop)
            yBottom = series.priceToCoordinate(priceBottom)
          } catch (e) {
            return
          }
          
          if (yTop === null || yBottom === null) return
        
          const barHeight = Math.abs(yBottom - yTop)
          const barWidth = (vol / maxVolume) * maxBarWidth
          const isPOC = i === pocIndex
          const isInVA = i >= lowerIndex && i <= upperIndex
          
          // Identify HVN/LVN
          const isHVN = vol > maxVolume * 0.7 && !isPOC
          const isLVN = vol < maxVolume * 0.1 && i > 0 && i < numBins - 1 && bins[i-1] > vol && bins[i+1] > vol

          storedBins.push({ 
            priceBottom, 
            priceTop, 
            volume: vol, 
            yTop, 
            yBottom, 
            barWidth,
            isVah: i === upperIndex,
            isVal: i === lowerIndex
          })
          
          // Highlight hovered bin with a full-width projection band
          const isHovered = hoveredVpBin && 
            hoveredVpBin.priceBottom === priceBottom && 
            hoveredVpBin.priceTop === priceTop

          if (isHovered) {
            // Draw Price Projection Band (Full width)
            const gradient = ctx.createLinearGradient(0, yTop, 0, yBottom)
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)')
            gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)')
            gradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)')
            ctx.fillStyle = gradient
            ctx.fillRect(0, yTop, width, barHeight)
            
            // Draw side indicators for the band
            ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'
            ctx.fillRect(0, yTop, 4, barHeight) // Left edge
            
            // Neon glow line across the chart
            ctx.shadowBlur = 10
            ctx.shadowColor = 'rgba(6, 182, 212, 0.5)'
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, yTop + barHeight / 2)
            ctx.lineTo(width, yTop + barHeight / 2)
            ctx.stroke()
            ctx.shadowBlur = 0
          }

          // Bar Colors
          if (isPOC) {
            ctx.fillStyle = theme === 'dark' ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.5)'
          } else if (isInVA) {
            ctx.fillStyle = theme === 'dark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.3)'
          } else {
            ctx.fillStyle = theme === 'dark' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.15)'
          }

          if (isHovered) {
             ctx.fillStyle = 'rgba(6, 182, 212, 0.65)'
          }

          ctx.fillRect(width - barWidth, yTop, barWidth, barHeight - 1)
          
          // Add border and label to POC
          if (isPOC) {
            ctx.strokeStyle = isHovered ? 'rgba(6, 182, 212, 1)' : 'rgba(6, 182, 212, 0.8)'
            ctx.lineWidth = isHovered ? 2.5 : 1.5
            ctx.strokeRect(width - barWidth, yTop, barWidth, barHeight - 1)
            
            // Add POC label with neon background
            const labelWidth = 32
            const labelHeight = 14
            ctx.fillStyle = isHovered ? '#06b6d4' : 'rgba(6, 182, 212, 0.9)'
            ctx.roundRect?.(width - barWidth - labelWidth - 5, yTop + (barHeight - labelHeight) / 2, labelWidth, labelHeight, 4)
            ctx.fill()
            
            ctx.fillStyle = '#000'
            ctx.font = 'black 9px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('POC', width - barWidth - labelWidth / 2 - 5, yTop + barHeight / 2 + 3.5)
            ctx.textAlign = 'start'
          }

          // Label VAH/VAL
          if (i === upperIndex || i === lowerIndex) {
            ctx.fillStyle = 'rgba(161, 161, 170, 0.4)'
            ctx.font = 'bold 8px sans-serif'
            ctx.fillText(i === upperIndex ? 'VAH' : 'VAL', width - 25, i === upperIndex ? yTop - 2 : yBottom + 8)
          }

          // LVN Indication (Liquidity Vacuum)
          if (isLVN && !isHovered) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
            ctx.setLineDash([2, 2])
            ctx.strokeRect(width - 40, yTop, 40, barHeight)
            ctx.setLineDash([])
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
      }, [showVolumeProfile, ohlcvData, theme, hoveredVpBin])

      // Volume Profile hover handler
      const handleVpCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!showVolumeProfile || !vpCanvasRef.current || vpBinsRef.current.length === 0) {
          setVpTooltip(null)
          setHoveredVpBin(null)
          return
        }
        
        const rect = vpCanvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const canvasWidth = vpCanvasRef.current.width
        
        // Find if we are hovering any bin (by Y coordinate only for projection)
        const hitBinIndex = vpBinsRef.current.findIndex(bin => y >= bin.yTop && y <= bin.yBottom)
        const hitBin = hitBinIndex !== -1 ? vpBinsRef.current[hitBinIndex] : null
        
        if (hitBin) {
          // Check if cursor is specifically on the bar (for tooltip)
          const barX = canvasWidth - hitBin.barWidth
          const isOverBar = x >= barX && x <= canvasWidth
          
          const maxVolume = Math.max(...vpBinsRef.current.map(b => b.volume))
          const isPoc = hitBin.volume === maxVolume

          setHoveredVpBin({
            priceBottom: hitBin.priceBottom,
            priceTop: hitBin.priceTop,
            isPoc,
            yTop: hitBin.yTop,
            yBottom: hitBin.yBottom
          })

          if (isOverBar) {
            const priceRange = `₹${hitBin.priceBottom.toFixed(2)} - ₹${hitBin.priceTop.toFixed(2)}`
            const volStr = formatVolume(hitBin.volume)
            setVpTooltip({ 
              x: e.clientX - rect.left - 160, 
              y: e.clientY - rect.top - 70, 
              price: priceRange, 
              volume: volStr,
              isPoc,
              relativeVolume: (hitBin.volume / maxVolume) * 100
            })
          } else {
            setVpTooltip(null)
          }
        } else {
          setVpTooltip(null)
          setHoveredVpBin(null)
        }
      }

      const handleVpCanvasLeave = () => {
        setVpTooltip(null)
        setHoveredVpBin(null)
      }

    // Update visible range when activeRange changes
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0 || loading) return

    const days = RANGE_MAP[activeRange]
    const visibleData = chartData.slice(-Math.min(chartData.length, days))
    if (visibleData.length > 1) {
      try {
        chartRef.current.timeScale().setVisibleRange({
            from: visibleData[0].time as Time,
            to: visibleData[visibleData.length - 1].time as Time,
        })
      } catch (e) {
        // Ignore - chart may not be fully initialized
      }
    }
  }, [activeRange, chartData, loading])

  // Update focus when targetDate changes
  useEffect(() => {
    if (!chartRef.current || !targetDate || chartData.length === 0 || loading) return

    const tDate = targetDate.split('T')[0]
    const targetIndex = chartData.findIndex(d => d.time === tDate)
    
    if (targetIndex !== -1) {
      const fromIndex = Math.max(0, targetIndex - 15)
      const toIndex = Math.min(chartData.length - 1, targetIndex + 15)
      
      try {
        chartRef.current.timeScale().setVisibleRange({
            from: chartData[fromIndex].time as Time,
            to: chartData[toIndex].time as Time,
        })
      } catch (e) {
        // Ignore - chart may not be fully initialized
      }
    }
  }, [targetDate, chartData, loading])

  // Auto-popup when highlightedAnnouncementId changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !highlightedAnnouncementId || announcements.length === 0 || chartData.length === 0 || loading) {
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
          
          let x: number | null = null
          let y: number | null = null
          try {
            x = chartRef.current.timeScale().timeToCoordinate(tDate)
            const price = (dataPoint as any).value || (dataPoint as any).close
            y = seriesRef.current.priceToCoordinate(price)
          } catch (e) {
            return
          }

          if (x !== null && y !== null) {
            setSelectedAnnouncement(announcement)
            setPopupPosition({ x, y })
          
          // Also focus the chart on this point
          const targetIndex = chartData.findIndex(d => d.time === tDate)
          if (targetIndex !== -1) {
            const fromIndex = Math.max(0, targetIndex - 15)
            const toIndex = Math.min(chartData.length - 1, targetIndex + 15)
            try {
              chartRef.current.timeScale().setVisibleRange({
                  from: chartData[fromIndex].time as Time,
                  to: chartData[toIndex].time as Time,
              })
            } catch (e) {
              // Ignore - chart may not be fully initialized
            }
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [highlightedAnnouncementId, announcements, chartData, loading])

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
            className={`absolute inset-0 z-10 pointer-events-none`}
            width={chartContainerRef.current?.clientWidth || 800}
            height={isFullscreen ? (typeof window !== 'undefined' ? window.innerHeight - 60 : 800) : height}
          />
          
            {/* Enhanced Volume Profile Tooltip */}
            {vpTooltip && (
              <div 
                className="absolute z-50 p-3 bg-zinc-950/90 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-in slide-in-from-bottom-2 duration-200"
                style={{ left: vpTooltip.x, top: vpTooltip.y }}
              >
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Price Cluster</span>
                    {(vpTooltip as any).isPoc && (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-500 text-[8px] font-black text-black">POC</span>
                    )}
                  </div>
                  <div className="text-sm font-black text-white tabular-nums">{vpTooltip.price}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                          style={{ width: `${(vpTooltip as any).relativeVolume || 0}%` }} 
                        />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">Vol: {vpTooltip.volume}</span>
                  </div>
                </div>
              </div>
            )}
          
            <div ref={tooltipRef} className="absolute z-50 pointer-events-none hidden p-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-2xl min-w-[120px]" />
            
                {/* Unified Intelligence HUD */}
                {(selectedAnnouncement || selectedWhaleDeal) && popupPosition && (
                  <div 
                    className={cn(
                      "absolute z-[60] bg-zinc-950/95 backdrop-blur-2xl border rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] p-3.5 w-[280px] animate-in zoom-in-95 fade-in duration-300 overflow-hidden",
                      hudView === 'confluence' ? "border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]" : "border-white/10"
                    )}
                    style={{ 
                      left: Math.min(popupPosition.x + 10, (chartContainerRef.current?.clientWidth || 0) - 290),
                      top: Math.max(10, Math.min(popupPosition.y - 140, (chartContainerRef.current?.clientHeight || 0) - 220))
                    }}
                  >
                    {/* Intelligence Background Glows */}
                    {hudView === 'confluence' && (
                      <>
                        <div className="absolute -top-16 -left-16 w-48 h-48 blur-[60px] opacity-15 rounded-full bg-cyan-500 animate-pulse" />
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(6,182,212,0.02)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite_linear]" />
                      </>
                    )}
                    {hudView === 'whale' && selectedWhaleDeal && (
                      <div className={cn(
                        "absolute -top-16 -right-16 w-32 h-32 blur-[50px] opacity-15 rounded-full",
                        selectedWhaleDeal.side === 'BUY' ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                    )}
  
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          {hudView === 'confluence' ? (
                            <div className="relative">
                              <div className="absolute inset-0 bg-cyan-500 blur-sm opacity-30 animate-pulse" />
                              <div className="relative w-8 h-8 rounded-lg flex items-center justify-center border bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                                <TrendingUp className="h-4 w-4" />
                              </div>
                            </div>
                          ) : hudView === 'whale' && selectedWhaleDeal ? (
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border",
                              selectedWhaleDeal.side === 'BUY' 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            )}>
                              <Waves className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border bg-zinc-800/50 border-white/10",
                              selectedAnnouncement && getMarkerProps(selectedAnnouncement.category).color === '#f59e0b' && "text-amber-400 border-amber-500/30",
                              selectedAnnouncement && getMarkerProps(selectedAnnouncement.category).color === '#f97316' && "text-orange-400 border-orange-500/30",
                              selectedAnnouncement && getMarkerProps(selectedAnnouncement.category).color === '#8b5cf6' && "text-purple-400 border-purple-500/30",
                              selectedAnnouncement && getMarkerProps(selectedAnnouncement.category).color === '#ec4899' && "text-pink-400 border-pink-500/30",
                              selectedAnnouncement && getMarkerProps(selectedAnnouncement.category).color === '#06b6d4' && "text-cyan-400 border-cyan-500/30",
                            )}>
                              <Calendar className="h-4 w-4" />
                            </div>
                          )}
                          
                          <div>
                            <div className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.15em] leading-none mb-0.5">
                              {hudView === 'confluence' ? 'Confluence' : hudView === 'whale' ? 'Whale Flow' : 'Event'}
                            </div>
                              <div className={cn(
                                "text-[10px] font-bold transition-colors duration-500 leading-tight",
                                hudView === 'confluence' ? "text-cyan-400" : (hudView === 'whale' && selectedWhaleDeal?.side === 'BUY') ? "text-emerald-400" : (hudView === 'whale' && selectedWhaleDeal?.side === 'SELL') ? "text-rose-400" : "text-white"
                              )}>
                                {hudView === 'confluence' ? 'DOUBLE SIGNAL' : hudView === 'whale' ? (selectedWhaleDeal?.side === 'BUY' ? 'ACCUMULATION' : 'DISTRIBUTION') : (selectedAnnouncement?.category.split(' ')[0] + '...')}
                              </div>
                            </div>
                          </div>
  
                          <div className="flex flex-col items-end mr-1">
                             <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Alpha</div>
                             <div className="flex items-center gap-1.5">
                               {alphaSinceSignal && (
                                 <div className={cn(
                                   "text-[9px] font-black",
                                   alphaSinceSignal.change >= 0 ? "text-emerald-400" : "text-rose-400"
                                 )}>
                                   {alphaSinceSignal.change >= 0 ? '+' : ''}{alphaSinceSignal.change.toFixed(1)}%
                                 </div>
                               )}
                               <div className="flex gap-0.5 h-2 items-center">
                                 {[1, 2, 3, 4, 5].map((s) => {
                                   const score = hudView === 'confluence' ? 5 : (hudView === 'whale' ? 4 : 3)
                                   return (
                                     <div 
                                       key={s} 
                                       className={cn(
                                         "w-0.5 h-1.5 rounded-full transition-all duration-700", 
                                         s <= score 
                                           ? (hudView === 'confluence' ? "bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.6)]" : "bg-zinc-400") 
                                           : "bg-zinc-800"
                                       )} 
                                     />
                                   )
                                 })}
                               </div>
                             </div>
                          </div>
                          
                          <button 
                            onClick={() => {
                              setSelectedAnnouncement(null)
                              setSelectedWhaleDeal(null)
                            }} 
                            className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-all active:scale-90"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
  
                        {/* Scanning Overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            {hudView === 'confluence' && (
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-[scan_4s_infinite_ease-in-out]" />
                            )}
                        </div>
    
                        {/* Confluence Tab Switcher (Minimal) */}
                        {hudView === 'confluence' && (
                          <div className="flex p-0.5 bg-white/[0.03] border border-white/5 rounded-lg mb-2.5 relative overflow-hidden">
                            <button 
                              onClick={() => setConfluenceTab('whale')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1 text-[8px] font-black rounded-md transition-all relative z-10",
                                confluenceTab === 'whale' ? "text-white" : "text-zinc-600 hover:text-zinc-400"
                              )}
                            >
                              <Waves className={cn("h-3 w-3", confluenceTab === 'whale' ? "text-cyan-400" : "")} /> FLOW
                            </button>
                            <button 
                              onClick={() => setConfluenceTab('announcement')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1 text-[8px] font-black rounded-md transition-all relative z-10",
                                confluenceTab === 'announcement' ? "text-white" : "text-zinc-600 hover:text-zinc-400"
                              )}
                            >
                              <Calendar className={cn("h-3 w-3", confluenceTab === 'announcement' ? "text-cyan-400" : "")} /> NEWS
                            </button>
                            <div 
                              className={cn(
                                "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-zinc-800 rounded-md transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-lg border border-white/5",
                                confluenceTab === 'whale' ? "left-0.5" : "left-[calc(50%+1px)]"
                              )}
                            />
                          </div>
                        )}
    
                        {/* Content Area */}
                        <div className="min-h-[100px]">
                          {(hudView === 'whale' || (hudView === 'confluence' && confluenceTab === 'whale')) && selectedWhaleDeal && (
                            <div className="space-y-2.5 animate-in slide-in-from-right-2 duration-300">
                              <div>
                                <div className="max-h-[80px] overflow-y-auto scrollbar-none space-y-1.5 pr-1">
                                  {selectedWhaleDeal.deals.slice(0, 3).map((deal, i) => (
                                    <div key={i} className="group/item border-b border-white/[0.03] last:border-0 pb-1.5 last:pb-0">
                                        <h4 className="text-[11px] font-black text-zinc-100 leading-tight line-clamp-1">
                                            {deal.clientName}
                                        </h4>
                                        <div className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5 flex items-center gap-1.5">
                                            <span className="text-zinc-300">₹{(deal.quantity * deal.price / 10000000).toFixed(2)}Cr</span>
                                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                                            <span>{deal.price.toFixed(1)}</span>
                                        </div>
                                    </div>
                                  ))}
                                  {selectedWhaleDeal.deals.length > 3 && (
                                    <div className="text-[8px] font-black text-cyan-500/60 uppercase tracking-widest pt-1">
                                      + {selectedWhaleDeal.deals.length - 3} MORE INSTITUTIONS
                                    </div>
                                  )}
                                </div>
                              </div>
    
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 group/stat">
                                  <div className="text-[7px] font-black text-zinc-600 uppercase mb-0.5">Value</div>
                                  <div className="text-[10px] font-black text-white tabular-nums">
                                    ₹{(selectedWhaleDeal.totalValue / 10000000).toFixed(1)}Cr
                                  </div>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 group/stat">
                                  <div className="text-[7px] font-black text-zinc-600 uppercase mb-0.5">Avg Price</div>
                                  <div className="text-[10px] font-black text-white tabular-nums">
                                    ₹{selectedWhaleDeal.avgPrice.toFixed(1)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
    
                          {(hudView === 'announcement' || (hudView === 'confluence' && confluenceTab === 'announcement')) && selectedAnnouncement && (
                            <div className="space-y-2.5 animate-in slide-in-from-left-2 duration-300">
                              {/* AI Narrative Section */}
                              <div className="bg-cyan-500/[0.03] border border-cyan-500/20 rounded-lg p-2.5 relative overflow-hidden">
                                  <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                      <TrendingUp className="h-3 w-3" /> AI INSIGHT
                                  </div>
                                  <h4 className="text-[10px] font-bold text-zinc-200 leading-normal italic line-clamp-3">
                                    {selectedAnnouncement.summary || selectedAnnouncement.headline}
                                  </h4>
                              </div>
  
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 group/news">
                                <h4 className="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors line-clamp-2 leading-tight">
                                  {selectedAnnouncement.headline}
                                </h4>
                              </div>
                              
                              {selectedAnnouncement.pdfUrl && (
                                <a 
                                  href={selectedAnnouncement.pdfUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="group flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-black text-cyan-400 hover:bg-cyan-500/20 transition-all"
                                >
                                  VIEW FILING <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
  
                      {/* Footer Info (Minimal) */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-[8px] text-zinc-600 font-bold uppercase tracking-wider">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date((selectedWhaleDeal?.date || selectedAnnouncement?.time || '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black text-cyan-500/60 tracking-widest uppercase">VALIDATED</span>
                          <CheckCircle2 className="h-2.5 w-2.5 text-cyan-500/60" />
                        </div>
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
