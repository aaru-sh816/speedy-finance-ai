import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Speech-to-Text: Transcribe audio to text using OpenAI Whisper
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as Blob
    const action = formData.get("action") as string // "transcribe" or "speak"
    
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    if (action === "transcribe") {
      // Speech-to-Text using Whisper
      const transcribeForm = new FormData()
      transcribeForm.append("file", audioFile, "audio.webm")
      transcribeForm.append("model", "whisper-1")
      transcribeForm.append("language", "en")
      
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: transcribeForm,
      })
      
      if (!response.ok) {
        const err = await response.text()
        console.error("Transcription failed:", err)
        return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
      }
      
      const result = await response.json()
      return NextResponse.json({ text: result.text })
      
    } else if (action === "speak") {
      // Text-to-Speech
      const text = formData.get("text") as string
      const voice = (formData.get("voice") as string) || "alloy"
      
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice,
          response_format: "mp3",
        }),
      })
      
      if (!response.ok) {
        const err = await response.text()
        console.error("TTS failed:", err)
        return NextResponse.json({ error: "Text-to-speech failed" }, { status: 500 })
      }
      
      const audioBuffer = await response.arrayBuffer()
      const base64Audio = Buffer.from(audioBuffer).toString("base64")
      
      return NextResponse.json({ 
        audio: base64Audio,
        format: "mp3"
      })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    
  } catch (error: any) {
    console.error("Voice API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
