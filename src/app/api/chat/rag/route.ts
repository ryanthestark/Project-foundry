// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { openai, EMBED_MODEL, CHAT_MODEL } from '@/lib/openai'

export async function POST(req: Request) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).slice(2, 8)
  
  try {
    console.log(`🔵 [${requestId}] RAG endpoint called at ${new Date().toISOString()}`)
    
    let body
    try {
      body = await req.json()
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to parse request body:`, error)
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }
    
    const { query, type } = body

    if (!query || typeof query !== 'string') {
      console.error(`❌ [${requestId}] Missing or invalid query parameter:`, { query, type: typeof query })
      return NextResponse.json(
        { 
          error: 'Query parameter is required and must be a string',
          received: { query, queryType: typeof query },
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    if (query.length > 10000) {
      console.error(`❌ [${requestId}] Query too long:`, query.length)
      return NextResponse.json(
        { 
          error: 'Query is too long (max 10000 characters)',
          length: query.length,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    console.log(`🧪 [${requestId}] Incoming query:`, query.slice(0, 100) + (query.length > 100 ? '...' : ''))
    console.log(`🧪 [${requestId}] Query type filter:`, type)
    console.log(`🧪 [${requestId}] Query length:`, query.length)
    console.log(`🧪 [${requestId}] Type filter enabled:`, !!type)

    // Step 1: Embed query
    console.log(`🔄 [${requestId}] Creating embedding for query...`)
    const embedStartTime = Date.now()
    let embedRes
    try {
      embedRes = await openai.embeddings.create({
        input: query,
        model: EMBED_MODEL,
        dimensions: 512, // Force 512 dimensions for Supabase vector(512)
      })
      console.log(`✅ [${requestId}] Embedding created in ${Date.now() - embedStartTime}ms`)
    } catch (error) {
      console.error(`❌ [${requestId}] OpenAI embedding failed:`, {
        error: error.message,
        code: error.code,
        type: error.type,
        model: EMBED_MODEL,
        queryLength: query.length,
        duration: Date.now() - embedStartTime
      })
      return NextResponse.json(
        { 
          error: 'Failed to create embedding', 
          details: error.message,
          model: EMBED_MODEL,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    const queryEmbedding = embedRes.data[0].embedding
    console.log(`🧪 [${requestId}] Embedding dimensions:`, queryEmbedding.length)
    console.log(`🧪 [${requestId}] Embedding sample:`, queryEmbedding.slice(0, 5))
    console.log(`🧪 [${requestId}] Using model:`, EMBED_MODEL)

    // Ensure embedding is exactly 512 dimensions for vector(512)
    if (queryEmbedding.length !== 512) {
      console.error(`❌ [${requestId}] Embedding dimension mismatch:`, {
        expected: 512,
        actual: queryEmbedding.length,
        model: EMBED_MODEL
      })
      return NextResponse.json(
        { 
          error: 'Embedding dimension mismatch', 
          expected: 512, 
          actual: queryEmbedding.length,
          model: EMBED_MODEL,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    // Step 2: Search Supabase via RPC with proper parameter formatting
    const rpcParams: any = {
      query_embedding: queryEmbedding,
      match_count: 8,
      similarity_threshold: 0.3  // Lower threshold to find more matches
    }

    // Add type filter only if provided
    if (type && type.trim()) {
      rpcParams.filter_type = type.trim()
      console.log("🧪 Applying type filter:", type.trim())
    } else {
      console.log("🧪 No type filter applied")
    }

    console.log(`🧪 [${requestId}] RPC params:`, { 
      ...rpcParams, 
      query_embedding: `[${queryEmbedding.length}D vector]`,
      filter_type: rpcParams.filter_type || 'none'
    })

    console.log(`🔄 [${requestId}] Calling Supabase match_embeddings RPC...`)
    const rpcStartTime = Date.now()
    const { data: matches, error } = await supabase.rpc('match_embeddings', rpcParams)
    const rpcDuration = Date.now() - rpcStartTime
    console.log(`🧪 [${requestId}] RPC completed in ${rpcDuration}ms`)

    console.log(`🧪 [${requestId}] Raw RPC response - data:`, matches?.length || 0, 'matches')
    console.log(`🧪 [${requestId}] Raw RPC response - error:`, error)
    
    if (error) {
      console.error(`❌ [${requestId}] Supabase match_embeddings error:`, {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        rpcParams: { ...rpcParams, query_embedding: `[${queryEmbedding.length}D vector]` },
        duration: rpcDuration
      })
      
      // Try a simple query to test connection
      console.log(`🔄 [${requestId}] Testing database connection...`)
      const { data: testData, error: testError } = await supabase
        .from('embeddings')
        .select('id, source')
        .limit(1)
      
      console.log(`🧪 [${requestId}] Connection test result:`, {
        hasData: !!testData?.length,
        dataCount: testData?.length || 0,
        testError: testError
      })
      
      return NextResponse.json(
        { 
          error: 'Supabase match_embeddings failed', 
          details: error,
          rpcDuration,
          connectionTest: { hasData: !!testData?.length, error: testError },
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
    
    if (matches && matches.length > 0) {
      console.log("🧪 Top match similarity:", matches[0].similarity)
      console.log("🧪 Match sources:", matches.map(m => m.source))
      console.log("🧪 Match types:", matches.map(m => m.metadata?.type || 'unknown'))
      console.log("🧪 Sample match structure:", Object.keys(matches[0]))
      console.log("🧪 Full sample match:", matches[0])
    } else {
      console.log("⚠️ No matches found - running diagnostics...")
      
      // Debug: Check if embeddings table has any data
      const { data: allRows, error: countError } = await supabase
        .from('embeddings')
        .select('id, source, metadata')
        .limit(5)
      
      console.log("🧪 Sample embeddings rows:", allRows)
      console.log("🧪 Available types in DB:", allRows?.map(r => r.metadata?.type).filter(Boolean))
      console.log("🧪 Count query error:", countError)
      
      // If type filter was applied, try without it to see if that's the issue
      if (type) {
        console.log("🧪 Retrying without type filter to test...")
        const { data: unfiltered, error: unfilteredError } = await supabase.rpc('match_embeddings', {
          query_embedding: queryEmbedding,
          match_count: 3,
          similarity_threshold: 0.1
        })
        console.log("🧪 Unfiltered matches:", unfiltered?.length || 0)
        console.log("🧪 Unfiltered error:", unfilteredError)
      }
    }

    // Handle case where no matches are found
    if (!matches || matches.length === 0) {
      console.log("⚠️ No matches found for query")
      return NextResponse.json({
        response: "I couldn't find any relevant information in the knowledge base for your query.",
        sources: []
      })
    }

    // Step 3: Generate context from matched chunks with source attribution
    const context = matches.map((m: any, index: number) => 
      `[Source ${index + 1}: ${m.source}]\n${m.content}`
    ).join('\n\n---\n\n')
    console.log("🧪 Context length:", context.length)
    console.log("🧪 Context sources:", matches.map(m => m.source).join(', '))

    // Step 4: Generate a chat response
    console.log(`🔄 [${requestId}] Generating chat response...`)
    console.log(`🧪 [${requestId}] Using model:`, CHAT_MODEL)
    console.log(`🧪 [${requestId}] Context length:`, context.length)
    
    const chatStartTime = Date.now()
    let chat
    try {
      chat = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { 
            role: 'system', 
            content: `You are an expert assistant with access to a comprehensive knowledge base about business strategy, product development, project management, and organizational planning. 

Your role is to provide detailed, actionable, and contextual responses based on the retrieved information. Follow these guidelines:

1. ALWAYS ground your response in the provided context
2. Be specific and reference relevant details from the documents
3. If the context fully answers the question, provide a comprehensive response
4. If the context partially answers the question, clearly state what information is available and what might be missing
5. Use a professional but conversational tone
6. Structure your response with clear sections when appropriate
7. Include actionable insights and recommendations when relevant
8. If multiple sources provide different perspectives, acknowledge and synthesize them

Remember: Your knowledge comes from the provided context. Do not make assumptions beyond what the documents contain.` 
          },
          { 
            role: 'user', 
            content: `Please answer the following question using the provided context from our knowledge base. Be specific and reference the relevant information from the documents.

Question: ${query}

Context from knowledge base:
${context}

Please provide a detailed, contextual response based on this information.` 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
      const chatDuration = Date.now() - chatStartTime
      console.log(`✅ [${requestId}] Chat response generated successfully in ${chatDuration}ms`)
    } catch (error) {
      const chatDuration = Date.now() - chatStartTime
      console.error(`❌ [${requestId}] OpenAI chat completion failed:`, {
        error: error.message,
        code: error.code,
        type: error.type,
        model: CHAT_MODEL,
        contextLength: context.length,
        duration: chatDuration
      })
      return NextResponse.json(
        { 
          error: 'Failed to generate response', 
          details: error.message,
          model: CHAT_MODEL,
          contextLength: context.length,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    const responseData = {
      response: chat.choices[0].message.content,
      sources: matches.map((m: any) => ({
        source: m.source || 'unknown',
        similarity: m.similarity || 0,
        type: m.metadata?.type || m.type || 'unknown'
      })),
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        matchCount: matches.length,
        model: {
          embedding: EMBED_MODEL,
          chat: CHAT_MODEL
        }
      }
    }
    
    console.log(`🧪 [${requestId}] Final response data:`, {
      responseLength: responseData.response?.length || 0,
      sourceCount: responseData.sources.length,
      totalDuration: Date.now() - startTime
    })
    
    return NextResponse.json(responseData)

  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`❌ [${requestId}] RAG endpoint error:`, {
      error: error.message,
      stack: error.stack,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        requestId,
        timestamp: new Date().toISOString(),
        duration: totalDuration
      },
      { status: 500 }
    )
  }
}
