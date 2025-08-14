// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { openai, EMBED_MODEL, CHAT_MODEL } from '@/lib/openai'

export async function POST(req: Request) {
  try {
    const { query, type } = await req.json()

    console.log("🧪 Incoming query:", query)
    console.log("🧪 Query type:", type)

    // Step 1: Embed query
    const embedRes = await openai.embeddings.create({
      input: query,
      model: EMBED_MODEL
    })

    const queryEmbedding = embedRes.data[0].embedding
    console.log("🧪 Embedding dimensions:", queryEmbedding.length)
    console.log("🧪 Embedding sample:", queryEmbedding.slice(0, 5))

    // Ensure embedding is exactly 1536 dimensions for vector(1536)
    if (queryEmbedding.length !== 1536) {
      console.error("❌ Embedding dimension mismatch:", queryEmbedding.length)
      return NextResponse.json(
        { error: 'Embedding dimension mismatch', expected: 1536, actual: queryEmbedding.length },
        { status: 500 }
      )
    }

    // Step 2: Search Supabase via RPC with proper parameter formatting
    const rpcParams = {
      query_embedding: queryEmbedding,
      match_count: 5,
      similarity_threshold: 0.6
    }

    // Add type filter only if provided
    if (type) {
      rpcParams.filter_type = type
    }

    console.log("🧪 RPC params:", { ...rpcParams, query_embedding: '[vector data]' })

    const { data: matches, error } = await supabase.rpc('match_embeddings', rpcParams)

    console.log("🧪 Matches returned:", matches?.length || 0)
    if (error) {
      console.error("❌ Supabase match_embeddings error:", error)
      return NextResponse.json(
        { error: 'Supabase match_embeddings failed', details: error },
        { status: 500 }
      )
    }

    // Handle case where no matches are found
    if (!matches || matches.length === 0) {
      console.log("⚠️ No matches found for query")
      return NextResponse.json({
        response: "I couldn't find any relevant information in the knowledge base for your query.",
        sources: []
      })
    }

    // Step 3: Generate context from matched chunks
    const context = matches.map((m: any) => m.content).join('\n---\n')
    console.log("🧪 Context length:", context.length)

    // Step 4: Generate a chat response
    const chat = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering questions based on the provided context. If the context doesn\'t contain relevant information, say so clearly.' },
        { role: 'user', content: `Context:\n${context}\n\nQuery:\n${query}` }
      ]
    })

    return NextResponse.json({
      response: chat.choices[0].message.content,
      sources: matches.map((m: any) => ({
        source: m.source,
        similarity: m.similarity,
        type: m.type
      }))
    })

  } catch (error) {
    console.error("❌ RAG endpoint error:", error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
