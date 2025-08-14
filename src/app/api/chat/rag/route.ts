// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { openai, EMBED_MODEL, CHAT_MODEL } from '@/lib/openai'

export async function POST(req: Request) {
  try {
    console.log("🔵 RAG endpoint called")
    
    let body
    try {
      body = await req.json()
    } catch (error) {
      console.error("❌ Failed to parse request body:", error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { query, type } = body

    if (!query || typeof query !== 'string') {
      console.error("❌ Missing or invalid query parameter")
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    console.log("🧪 Incoming query:", query)
    console.log("🧪 Query type:", type)
    console.log("🧪 Query length:", query.length)

    // Step 1: Embed query
    console.log("🔄 Creating embedding for query...")
    let embedRes
    try {
      embedRes = await openai.embeddings.create({
        input: query,
        model: EMBED_MODEL
      })
    } catch (error) {
      console.error("❌ OpenAI embedding failed:", error)
      return NextResponse.json(
        { error: 'Failed to create embedding', details: error.message },
        { status: 500 }
      )
    }

    const queryEmbedding = embedRes.data[0].embedding
    console.log("🧪 Embedding dimensions:", queryEmbedding.length)
    console.log("🧪 Embedding sample:", queryEmbedding.slice(0, 5))
    console.log("🧪 Using model:", EMBED_MODEL)

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
      match_count: 8,
      similarity_threshold: 0.4
    }

    // Add type filter only if provided
    if (type) {
      rpcParams.filter_type = type
    }

    console.log("🧪 RPC params:", { ...rpcParams, query_embedding: `[${queryEmbedding.length}D vector]` })

    console.log("🔄 Calling Supabase match_embeddings RPC...")
    const { data: matches, error } = await supabase.rpc('match_embeddings', rpcParams)

    console.log("🧪 Matches returned:", matches?.length || 0)
    if (matches && matches.length > 0) {
      console.log("🧪 Top match similarity:", matches[0].similarity)
      console.log("🧪 Match sources:", matches.map(m => m.source))
    }
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
    console.log("🔄 Generating chat response...")
    console.log("🧪 Using model:", CHAT_MODEL)
    
    let chat
    try {
      chat = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are a knowledgeable assistant helping with questions about business strategy, product development, and project management. Use the provided context to give detailed, actionable answers. If the context doesn\'t fully address the question, mention what information is available and what might be missing.' 
          },
          { 
            role: 'user', 
            content: `Based on the following context from our knowledge base, please answer this question:\n\nQuestion: ${query}\n\nContext:\n${context}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    } catch (error) {
      console.error("❌ OpenAI chat completion failed:", error)
      return NextResponse.json(
        { error: 'Failed to generate response', details: error.message },
        { status: 500 }
      )
    }
    
    console.log("✅ Chat response generated successfully")

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
