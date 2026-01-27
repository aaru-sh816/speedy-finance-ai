"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Mic, MicOff, Volume2, VolumeX, Loader2, Brain, Zap, X, Shield, Activity, BarChart3, TrendingUp } from "lucide-react"
import { WSMessage, SocketStatus } from "@/lib/voice/types"
import { decodeMessage, encodeMessage } from "@/lib/voice/encoder"

interface VoiceAnalystProps {
  isOpen: boolean
  onClose: () => void
  ticker?: string
  company?: string
  persona?: "Analyst" | "Critic" | "Neutral"
  variant?: "fullscreen" | "integrated"
}

const PERSONA_PROMPTS = {
  Analyst: "You are the Lead Quantitative Analyst for Speedy Finance. You provide deep, data-driven insights with institutional-grade precision. Be professional, direct, and insightful.",
  Critic: "You are a Skeptical Market Strategist. You look for risks, red flags, and potential downsides in any financial data. Be critical, cautious, and sharp.",
  Neutral: "You are a Neutral Market Reporter. You state the facts, numbers, and announcements exactly as they are without bias. Be objective and clear."
}

export function VoiceAnalyst({ 
  isOpen, 
  onClose, 
  ticker = "BSE:500325", 
  company = "Reliance Industries",
  persona = "Analyst",
  variant = "fullscreen"
}: VoiceAnalystProps) {
  const [status, setSocketStatus] = useState<SocketStatus | "syncing">("disconnected")
  const [syncProgress, setSyncProgress] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolume] = useState(0)
  
  const socketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkStatus = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8998/api/status`)
      if (!res.ok) return false
      const data = await res.json()
      if (data.status === "syncing") {
        setSocketStatus("syncing")
        setSyncProgress(data.progress || 0)
        return false
      }
      if (data.status === "ready") {
        return true
      }
      if (data.status === "error") {
        setError("Neural core initialization failed")
        return false
      }
      return false
    } catch (e) {
      return false
    }
  }

  const stopSession = useCallback(() => {
    setIsRecording(false)
    setSocketStatus("disconnected")
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
    
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      
      const centerX = width / 2
      const centerY = height / 2
      const radius = (variant === "integrated" ? 40 : 60) + volume * (variant === "integrated" ? 20 : 40)

      // Outer Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius + 20)
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.2)')
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2)
      ctx.fill()

      // Central Orb
      ctx.strokeStyle = '#06b6d4'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.stroke()

      // Neural connection lines
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + (Date.now() / 1000)
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(x, y)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)'
        ctx.stroke()
      }
    }
    draw()
  }, [volume, variant])

  const startSession = async () => {
    try {
      setSocketStatus("connecting")
      setError(null)

      // Check if server is ready
      const isReady = await checkStatus()
      if (!isReady) {
        if (status === "syncing") return
        // If not ready, poll every 2 seconds
        statusIntervalRef.current = setInterval(async () => {
          const ready = await checkStatus()
          if (ready) {
            if (statusIntervalRef.current) {
              clearInterval(statusIntervalRef.current)
              statusIntervalRef.current = null
            }
            startSession()
          }
        }, 2000)
        
        // Don't error out yet, just wait for syncing
        // If we can't even hit status, then server might be down
        setTimeout(() => {
          if (status === "connecting") setError("Neural link failed - server offline")
        }, 5000)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      await audioContext.audioWorklet.addModule('/voice/audio-processor.js')
      const workletNode = new AudioWorkletNode(audioContext, 'moshi-processor')
      workletNodeRef.current = workletNode
      workletNode.connect(audioContext.destination)

      const worker = new Worker('/assets/decoderWorker.min.js')
      workerRef.current = worker
      worker.onmessage = (e) => {
        if (e.data.type === 'audio') {
          workletNode.port.postMessage({ frame: e.data.pcm })
        }
      }

      const textPrompt = encodeURIComponent(PERSONA_PROMPTS[persona])
      const wsUrl = `ws://${window.location.hostname}:8998/api/chat?voice_prompt=NATF2.pt&text_prompt=${textPrompt}`
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws
      ws.binaryType = "arraybuffer"

      ws.onopen = () => console.log("Voice connection established")
      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data)
        const message = decodeMessage(data)

        if (message.type === "handshake") {
          setSocketStatus("connected")
          setIsRecording(true)
          drawVisualizer()
        } else if (message.type === "audio") {
          worker.postMessage({ type: 'decode', data: message.data })
        } else if (message.type === "text") {
          setTranscription(prev => (prev + message.data).slice(-150))
        }
      }

      ws.onerror = () => setError("Neural link failed")
      ws.onclose = () => stopSession()

      // Microphone capture logic
      const source = audioContext.createMediaStreamSource(stream)
      const analyzer = audioContext.createAnalyser()
      source.connect(analyzer)
      
      const pcmWorker = audioContext.createScriptProcessor(4096, 1, 1)
      pcmWorker.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && isRecording) {
          const input = e.inputBuffer.getChannelData(0)
          // Simple volume estimation
          let sum = 0
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
          setVolume(Math.sqrt(sum / input.length))
          
          // Send as Int16 PCM
          const pcm = new Int16Array(input.length)
          for (let i = 0; i < input.length; i++) {
            pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF
          }
          ws.send(new Uint8Array([0x01, ...new Uint8Array(pcm.buffer)]))
        }
      }
      source.connect(pcmWorker)
      pcmWorker.connect(audioContext.destination)

    } catch (e) {
      setError("Institutional access denied")
      setSocketStatus("disconnected")
    }
  }

  useEffect(() => {
    if (isOpen && status === "disconnected") {
      startSession()
    }
    return () => {
      if (status !== "disconnected") stopSession()
    }
  }, [isOpen])

  if (!isOpen) return null

  if (variant === "integrated") {
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900/50 border border-white/10 rounded-[2rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative w-full h-40 flex flex-col items-center justify-center">
          <canvas 
            ref={canvasRef} 
            width={200} 
            height={160} 
            className="absolute inset-0 w-full h-full opacity-60"
          />
          
          {status === "connecting" || status === "syncing" ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              <p className="text-xs font-bold text-zinc-400 animate-pulse">
                {status === "syncing" ? `SYNCING NEURAL CORE (${syncProgress}%)` : "CONNECTING..."}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <MicOff className="h-6 w-6 text-red-500" />
              <p className="text-[10px] font-bold text-red-400">{error}</p>
              <button onClick={startSession} className="text-[9px] text-cyan-400 underline uppercase font-bold">Retry</button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center transition-all duration-300 ${isRecording ? 'scale-110 shadow-[0_0_30px_-10px_rgba(6,182,212,0.5)]' : 'scale-100 opacity-50'}`}>
                <Zap className={`h-5 w-5 text-cyan-400 ${isRecording ? 'animate-pulse' : ''}`} />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em] mb-1">
                  {isRecording ? "Live Oracle" : "Standby"}
                </p>
                <p className="text-xs text-zinc-300 italic max-w-[200px] line-clamp-2">
                  {transcription || "Listening for analysis..."}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsRecording(!isRecording)}
            disabled={status !== "connected"}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"} disabled:opacity-20`}
          >
            {isRecording ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider hover:bg-white/10 transition-all"
          >
            Exit Oracle
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        {/* Elite Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-r from-black/40 to-cyan-500/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
                <Brain className={`h-8 w-8 text-cyan-400 ${status === "connected" ? "animate-pulse" : ""}`} />
                {status === "connected" && (
                  <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">Speedy Voice Oracle</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">v2.0 Beta</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  {persona} Mode
                </p>
                <div className="w-1 h-1 rounded-full bg-zinc-700" />
                <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  Full-Duplex Speech
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/5 text-zinc-400 hover:text-white transition-all hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Dynamic Context Panel */}
        <div className="px-8 py-4 bg-zinc-900/50 border-b border-white/5 flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{ticker}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2 whitespace-nowrap">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-zinc-400">{company} Analysis Live</span>
          </div>
        </div>

        {/* Visualizer & Interaction Area */}
        <div className="relative h-80 flex flex-col items-center justify-center p-8">
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={300} 
            className="absolute inset-0 w-full h-full opacity-40"
          />
          
          {status === "connecting" || status === "syncing" ? (
            <div className="relative flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
              <p className="text-lg font-medium text-zinc-300 animate-pulse text-center">
                {status === "syncing" 
                  ? `Syncing Neural Core (${syncProgress}%)...\nBuilding financial intuition...` 
                  : "Connecting to Neural Link..."}
              </p>
            </div>
          ) : error ? (
            <div className="relative flex flex-col items-center gap-6 text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/20 shadow-lg shadow-red-500/5">
                <MicOff className="h-10 w-10 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{error}</p>
                <p className="text-sm text-zinc-500 mt-1">Check your connection or try another persona</p>
              </div>
              <button 
                onClick={startSession}
                className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-all font-semibold"
              >
                Reconnect System
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-12 w-full">
              {/* Orb Placeholder for Visualizer */}
              <div className={`w-32 h-32 rounded-full border-2 border-cyan-500/30 flex items-center justify-center transition-all duration-300 ${isRecording ? 'scale-110 shadow-[0_0_50px_-12px_rgba(6,182,212,0.5)]' : 'scale-100 opacity-50'}`}>
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-sm border border-white/10 flex items-center justify-center`}>
                  <Zap className={`h-8 w-8 text-cyan-400 ${isRecording ? 'animate-pulse' : ''}`} />
                </div>
              </div>

              {/* Status & Transcription */}
              <div className="text-center space-y-4 max-w-lg">
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                  <p className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">
                    {isRecording ? "Quantum Link Active" : "Link on Standby"}
                  </p>
                </div>
                <div className="min-h-[4rem] text-lg text-zinc-200 font-medium italic leading-relaxed">
                  {transcription || "Initialize conversation by asking about market data..."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Elite Controls */}
        <div className="p-10 flex items-center justify-center gap-10 bg-black/40 border-t border-white/5">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setIsRecording(!isRecording)}
              disabled={status !== "connected"}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
                isRecording 
                  ? "bg-red-500 text-white shadow-red-500/20 hover:scale-110 rotate-0" 
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 -rotate-12"
              } disabled:opacity-20 disabled:cursor-not-allowed`}
            >
              {isRecording ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
            </button>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {isRecording ? "Mute Link" : "Activate Mic"}
            </span>
          </div>
          
          <button
            onClick={onClose}
            className="px-12 py-4 rounded-3xl bg-white/5 border border-white/10 text-white text-base font-bold hover:bg-white/10 hover:border-white/20 transition-all tracking-tight shadow-xl"
          >
            End Analysis
          </button>
        </div>

        {/* Institutional Footer */}
        <div className="px-8 py-4 bg-zinc-950 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Secure Institutional Server 08-AX</span>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium">© 2026 SPEEDY FINANCE GLOBAL • ENCRYPTED PIPELINE</p>
        </div>
      </div>
    </div>
  )
}
