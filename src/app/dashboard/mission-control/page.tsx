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

    setMessages(prev => [...prev, `🧑‍🚀: ${trimmed}`])
    setInput('')

    const endpoint = trimmed.startsWith('/mission')
      ? '/api/orchestrator/start'
      : '/api/chat/rag'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed }),
    })

    const data = await res.json()
    setMessages(prev => [...prev, `🤖: ${JSON.stringify(data, null, 2)}`])
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
