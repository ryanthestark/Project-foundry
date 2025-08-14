// src/app/dashboard/mission-control/page.tsx

'use client'

import { useState } from 'react'

export default function MissionControl() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    console.log("🔵 UI: Submitting query:", trimmed)
    setMessages(prev => [...prev, `🧑‍🚀: ${trimmed}`])
    setInput('')

    const endpoint = trimmed.startsWith('/mission')
      ? '/api/orchestrator/start'
      : '/api/chat/rag'

    console.log("🔵 UI: Calling endpoint:", endpoint)

    // Parse query for type filter (e.g., "strategy: what is our plan?")
    let query = trimmed
    let type = undefined
    
    if (trimmed.includes(':') && !trimmed.startsWith('/mission')) {
      const parts = trimmed.split(':', 2)
      if (parts.length === 2) {
        type = parts[0].trim()
        query = parts[1].trim()
        console.log("🔵 UI: Parsed type filter:", type)
        console.log("🔵 UI: Parsed query:", query)
      }
    }

    try {
      const requestBody = trimmed.startsWith('/mission') 
        ? { query: trimmed }
        : { query, type }
        
      console.log("🔵 UI: Request body:", requestBody)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log("🔵 UI: Response status:", res.status)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      console.log("🔵 UI: Response data:", data)
      console.log("🔵 UI: Sources array:", data.sources)
      console.log("🔵 UI: Sources length:", data.sources?.length)
    
    // Format response based on endpoint
    let response = ''
    if (trimmed.startsWith('/mission')) {
      response = `🤖: ${JSON.stringify(data, null, 2)}`
    } else {
      // RAG response - show the actual response text and sources
      if (data.response) {
        response = `🤖: ${data.response}`
        if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
          const sourceList = data.sources.map((s: any) => {
            const similarity = s.similarity ? ` (${(s.similarity * 100).toFixed(1)}%)` : ''
            return `• ${s.source} (${s.type})${similarity}`
          }).join('\n')
          response += `\n\n📚 Sources (${data.sources.length}):\n${sourceList}`
        } else {
          response += `\n\n📚 No sources found`
        }
      } else if (data.error) {
        response = `🤖 Error: ${data.error}`
        if (data.details) {
          response += `\nDetails: ${JSON.stringify(data.details, null, 2)}`
        }
      } else {
        response = `🤖: ${JSON.stringify(data, null, 2)}`
      }
    }
    
      setMessages(prev => [...prev, response])
    } catch (error) {
      console.error("❌ UI: Request failed:", error)
      setMessages(prev => [...prev, `❌ Error: ${error.message}`])
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>🛰️ Mission Control</h1>
      <div style={{ border: '1px solid #ccc', padding: 12, minHeight: 200 }}>
        {messages.map((msg, idx) => (
          <pre key={idx} style={{ margin: 0 }}>{msg}</pre>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type /mission, 'strategy: question', or a question..."
          style={{ width: '80%', padding: 8 }}
        />
        <button type="submit" style={{ padding: '8px 12px', marginLeft: 8 }}>
          🚀
        </button>
      </form>
    </main>
  )
}
