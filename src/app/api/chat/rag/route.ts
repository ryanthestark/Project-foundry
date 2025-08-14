// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { openai, EMBED_MODEL, CHAT_MODEL } from '@/lib/openai'

export async function POST(req: Request) {
  const { query, type } = await req.json()

  // Step 1: Embed query
  const embedRes = await openai.embeddings.create({
    input: query,
    model: EMBED_MODEL
  })

  const queryEmbedding = embedRes.data[0].embedding

  // Step 2: Search Supabase via RPC
  const { data: matches, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_count: 5,
    similarity_threshold: 0.6,
    filter_type: null
  })

  // 🧪 Add debug logs
  console.log("🧪 Embedding sample:", queryEmbedding.slice(0, 5)) // small sample
  console.log("🧪 Matches returned:", matches)
  if (error) {
    console.error("❌ Supabase match_embeddings error:", error)
    return NextResponse.json({ error: 'Supabase match_embeddings failed', details: error }, { status: 500 })
  }

  const context = matches.map((m: any) => m.content).join('\n---\n')

  // Step 3: Generate response
  const chat = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: 'You are a helpful assistant answering questions based on context.' },
      { role: 'user', content: `Context:\n${context}\n\nQuery:\n${query}` }
    ]
  })

  return NextResponse.json({
    response: chat.choices[0].message.content,
    sources: matches
  })
}
