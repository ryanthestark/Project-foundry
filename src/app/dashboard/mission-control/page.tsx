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

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })

      console.log("🔵 UI: Response status:", res.status)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      console.log("🔵 UI: Response data:", data)
    
    // Format response based on endpoint
    let response = ''
    if (trimmed.startsWith('/mission')) {
      response = `🤖: ${JSON.stringify(data, null, 2)}`
    } else {
      // RAG response - show the actual response text and sources
      if (data.response) {
        response = `🤖: ${data.response}`
        if (data.sources && data.sources.length > 0) {
          const sourceList = data.sources.map((s: any) => `• ${s.source} (${s.type})`).join('\n')
          response += `\n\n📚 Sources:\n${sourceList}`
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
          placeholder="Type /mission or a question..."
          style={{ width: '80%', padding: 8 }}
        />
        <button type="submit" style={{ padding: '8px 12px', marginLeft: 8 }}>
          🚀
        </button>
      </form>
    </main>
  )
}
