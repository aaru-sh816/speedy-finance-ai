"use client"

import React, { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Volume2, VolumeX, Loader2, Brain, Zap, X } from "lucide-react"

interface PersonaPlexVoiceProps {
  isOpen: boolean
  onClose: () => void
  ticker?: string
  company?: string
  voicePrompt?: string // e.g., "NATM1.pt"
}

export function PersonaPlexVoice({ 
  isOpen, 
  onClose, 
  ticker = "RELIANCE", 
  company = "Reliance Industries",
  voicePrompt = "NATM1.pt"
}: PersonaPlexVoiceProps) {
  const [isActive, setIsActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)

  // Initialize Web Audio and WebSocket
  const startSession = async () => {
    try {
      setIsConnecting(true)
      setError(null)

      // 1. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 2. Setup WebSocket
      // Note: In production, this would be a secure wss:// URL
      const wsUrl = `ws://${window.location.hostname}:8998/api/voice-chat?voice_prompt=${voicePrompt}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("PersonaPlex WebSocket connected")
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          const buffer = await event.data.arrayBuffer()
          const data = new Uint8Array(buffer)
          const kind = data[0]
          const payload = data.slice(1)

          if (kind === 0) {
            // Handshake done
            setIsConnecting(false)
            setIsActive(true)
            startStreaming()
          } else if (kind === 1) {
            // Audio data (Opus)
            // For simplicity in this demo, we assume the server sends raw PCM or we decode Opus in JS
            // In a real implementation, we'd use an Opus decoder (like libopus.js)
            // Here, we'll handle it as PCM if the server was modified to send PCM for the web
            handleIncomingAudio(payload)
          } else if (kind === 2) {
            // Text tokens
            const text = new TextDecoder().decode(payload)
            setTranscription(prev => (prev + text).slice(-200))
          }
        }
      }

      ws.onerror = (e) => {
        console.error("WebSocket error:", e)
        setError("Failed to connect to voice server")
        stopSession()
      }

      ws.onclose = () => {
        console.log("WebSocket closed")
        stopSession()
      }

    } catch (e) {
      console.error("Failed to start voice session:", e)
      setError("Microphone access denied or server unreachable")
      setIsConnecting(false)
    }
  }

  const stopSession = () => {
    setIsActive(false)
    setIsRecording(false)
    setIsConnecting(false)
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const startStreaming = () => {
    if (!streamRef.current) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
    audioContextRef.current = audioContext
    
    const source = audioContext.createMediaStreamSource(streamRef.current)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (e) => {
      if (!isRecording || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

      const inputData = e.inputBuffer.getChannelData(0)
      // Convert to Int16 for the server (or keep as float if server handles it)
      // For Moshi/PersonaPlex, we'll send it as Kind 1
      const pcmData = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
      }

      // In a real implementation, we would encode to Opus here.
      // For this integration, we'll send raw PCM and assume the server can handle it 
      // or we'll add a simple Opus encoder.
      const message = new Uint8Array(1 + pcmData.buffer.byteLength)
      message[0] = 1 // Audio kind
      message.set(new Uint8Array(pcmData.buffer), 1)
      wsRef.current.send(message)
    }

    source.connect(processor)
    processor.connect(audioContext.destination)
    setIsRecording(true)
  }

  const handleIncomingAudio = (payload: Uint8Array) => {
    // This expects raw PCM from the server for simplicity.
    // If the server sends Opus, we'd need a decoder.
    const pcmData = new Int16Array(payload.buffer, payload.byteOffset, payload.byteLength / 2)
    const floatData = new Float32Array(pcmData.length)
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF
    }
    
    audioQueueRef.current.push(floatData)
    if (!isPlayingRef.current) {
      playNextInQueue()
    }
  }

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false
      return
    }

    isPlayingRef.current = true
    const data = audioQueueRef.current.shift()!
    const buffer = audioContextRef.current.createBuffer(1, data.length, 24000)
    buffer.getChannelData(0).set(data)
    
    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.onended = playNextInQueue
    source.start()
  }

  useEffect(() => {
    if (isOpen && !isActive && !isConnecting) {
      startSession()
    }
    return () => {
      if (isActive) stopSession()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 p-[2px]">
              <div className="w-full h-full rounded-2xl bg-zinc-900 flex items-center justify-center">
                <Brain className={`h-6 w-6 text-cyan-400 ${isActive ? "animate-pulse" : ""}`} />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Alex - Lead Analyst</h3>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-400" />
                PersonaPlex Full Duplex • {ticker}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visualizer Area */}
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-black/0 to-cyan-500/5">
          {isConnecting ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-cyan-500 animate-spin" />
              <p className="text-sm text-zinc-400">Establishing full-duplex connection...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <MicOff className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-sm text-red-400">{error}</p>
              <button 
                onClick={startSession}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300 hover:bg-white/10 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 w-full">
              {/* Voice Waves */}
              <div className="flex items-center gap-1 h-16">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-1.5 rounded-full bg-cyan-500/40 transition-all duration-150 ${
                      isActive ? "animate-wave" : "h-2"
                    }`}
                    style={{ 
                      animationDelay: `${i * 100}ms`,
                      height: isActive ? `${Math.random() * 40 + 10}px` : "8px"
                    }}
                  />
                ))}
              </div>

              {/* Status & Transcription */}
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-cyan-400">
                  {isRecording ? "Listening & Speaking..." : "Paused"}
                </p>
                <div className="h-12 max-w-sm overflow-hidden text-xs text-zinc-500 italic px-4 line-clamp-2">
                  {transcription || "Say something to start the conversation..."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-8 flex items-center justify-center gap-6">
          <button
            onClick={() => setIsRecording(!isRecording)}
            disabled={!isActive}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
              isRecording 
                ? "bg-red-500 text-white shadow-red-500/20 hover:scale-105" 
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            } disabled:opacity-20`}
          >
            {isRecording ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8" />}
          </button>
          
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all"
          >
            End Call
          </button>
        </div>

        {/* Info Footer */}
        <div className="p-4 bg-black/60 border-t border-white/5 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Institutional Voice Engine • Secure Connection
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes wave {
          0%, 100% { height: 10px; }
          50% { height: 40px; }
        }
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
