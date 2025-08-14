// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { openai, EMBED_MODEL, CHAT_MODEL, EMBEDDING_DIMENSIONS, validateEmbeddingDimensions } from '@/lib/openai'

// Validate that the response is properly grounded in the provided context
function validateResponseGrounding(response: string, sources: any[], query: string) {
  const validation = {
    hasSourceReferences: false,
    hasDirectQuotes: false,
    acknowledgesLimitations: false,
    avoidsUngroundedClaims: true,
    score: 0
  }
  
  const responseLower = response.toLowerCase()
  
  // Check for source references
  const sourceReferencePatterns = [
    /according to/i,
    /based on/i,
    /the document/i,
    /source \d+/i,
    /from the/i,
    /as stated in/i,
    /the information shows/i,
    /documents indicate/i
  ]
  validation.hasSourceReferences = sourceReferencePatterns.some(pattern => pattern.test(response))
  
  // Check for direct quotes (text in quotes)
  validation.hasDirectQuotes = /["'].*?["']/.test(response) || response.includes('"') || response.includes("'")
  
  // Check for acknowledgment of limitations
  const limitationPatterns = [
    /don't have.*information/i,
    /not enough.*information/i,
    /limited.*information/i,
    /insufficient.*context/i,
    /cannot.*determine/i,
    /unclear.*from.*context/i,
    /would need.*more.*information/i
  ]
  validation.acknowledgesLimitations = limitationPatterns.some(pattern => pattern.test(response))
  
  // Check for potentially ungrounded claims (red flags)
  const ungroundedPatterns = [
    /in general/i,
    /typically/i,
    /usually/i,
    /commonly/i,
    /it is known that/i,
    /research shows/i,
    /studies indicate/i,
    /experts recommend/i
  ]
  validation.avoidsUngroundedClaims = !ungroundedPatterns.some(pattern => pattern.test(response))
  
  // Calculate grounding score
  let score = 0
  if (validation.hasSourceReferences) score += 30
  if (validation.hasDirectQuotes) score += 25
  if (validation.acknowledgesLimitations) score += 20
  if (validation.avoidsUngroundedClaims) score += 25
  
  validation.score = score
  
  return validation
}

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
        dimensions: EMBEDDING_DIMENSIONS, // Must match Supabase vector schema
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
    console.log(`🧪 [${requestId}] Embedding sample (first 5):`, queryEmbedding.slice(0, 5).map(v => v.toFixed(4)))
    console.log(`🧪 [${requestId}] Embedding sample (middle 5):`, queryEmbedding.slice(250, 255).map(v => v.toFixed(4)))
    console.log(`🧪 [${requestId}] Embedding sample (last 5):`, queryEmbedding.slice(-5).map(v => v.toFixed(4)))
    console.log(`🧪 [${requestId}] Using model:`, EMBED_MODEL)

    // Validate embedding dimensions match Supabase schema
    try {
      validateEmbeddingDimensions(queryEmbedding)
      console.log(`✅ [${requestId}] Embedding dimensions validated: ${queryEmbedding.length} matches vector(${EMBEDDING_DIMENSIONS})`)
    } catch (error) {
      console.error(`❌ [${requestId}] Embedding validation failed:`, error.message)
      return NextResponse.json(
        { 
          error: 'Embedding validation failed', 
          details: error.message,
          expected: EMBEDDING_DIMENSIONS,
          actual: queryEmbedding.length,
          model: EMBED_MODEL,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    // Step 2: Search Supabase via RPC with proper parameter formatting
    // Convert array to proper vector format for PostgreSQL
    const vectorString = `[${queryEmbedding.join(',')}]`
    
    const rpcParams: any = {
      query_embedding: vectorString,
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
      query_embedding: `[${queryEmbedding.length}D vector string]`,
      filter_type: rpcParams.filter_type || 'none'
    })

    console.log(`🔄 [${requestId}] Calling Supabase match_embeddings RPC...`)
    const rpcStartTime = Date.now()
    const { data: matches, error } = await supabase.rpc('match_embeddings', rpcParams)
    const rpcDuration = Date.now() - rpcStartTime
    console.log(`🧪 [${requestId}] RPC completed in ${rpcDuration}ms`)

    console.log(`🧪 [${requestId}] Raw RPC response - data:`, matches?.length || 0, 'matches')
    console.log(`🧪 [${requestId}] Raw RPC response - error:`, error)
    console.log(`🧪 [${requestId}] Match count breakdown:`, {
      total: matches?.length || 0,
      withSimilarity: matches?.filter(m => m.similarity > 0).length || 0,
      highSimilarity: matches?.filter(m => m.similarity > 0.5).length || 0,
      mediumSimilarity: matches?.filter(m => m.similarity > 0.3 && m.similarity <= 0.5).length || 0,
      lowSimilarity: matches?.filter(m => m.similarity <= 0.3).length || 0
    })
    
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
      console.log("🧪 Top match similarity:", matches[0].similarity?.toFixed(4))
      console.log("🧪 All match similarities:", matches.map(m => m.similarity?.toFixed(4)))
      console.log("🧪 Match sources:", matches.map(m => m.source))
      console.log("🧪 Match types:", matches.map(m => m.metadata?.type || 'unknown'))
      console.log("🧪 Sample match structure:", Object.keys(matches[0]))
      console.log("🧪 Sample match content preview:", matches[0].content?.slice(0, 100) + '...')
      console.log("🧪 Full sample match metadata:", {
        id: matches[0].id,
        source: matches[0].source,
        similarity: matches[0].similarity,
        metadata: matches[0].metadata,
        contentLength: matches[0].content?.length
      })
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
            content: `You are a knowledge base assistant that MUST base all responses strictly on the provided context documents. You have NO knowledge outside of what is explicitly provided in the context.

CRITICAL REQUIREMENTS:
1. ONLY use information explicitly stated in the provided context
2. NEVER add information from your general knowledge
3. If the context doesn't contain enough information to answer the question, explicitly state this
4. Always cite which source document(s) you're referencing
5. Use direct quotes from the context when possible
6. If the context is empty or irrelevant, state "I don't have relevant information in the knowledge base to answer this question"

RESPONSE FORMAT:
- Start with a direct answer based on the context
- Include specific references to source documents
- Use quotes from the context to support your points
- End by noting any limitations in the available information

Remember: You are a retrieval system, not a general AI assistant. Your value comes from accurately representing what's in the knowledge base, not from adding external knowledge.` 
          },
          { 
            role: 'user', 
            content: `Question: ${query}

Available context from knowledge base:
${context}

Instructions: Answer the question using ONLY the information provided in the context above. If the context doesn't contain sufficient information to answer the question, clearly state this limitation. Always reference which source documents you're using.` 
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

    const generatedResponse = chat.choices[0].message.content
    
    // Validate that response is grounded in context
    console.log(`🔍 [${requestId}] Validating response grounding...`)
    const groundingValidation = validateResponseGrounding(generatedResponse, matches, query)
    console.log(`🧪 [${requestId}] Grounding validation:`, groundingValidation)
    
    const responseData = {
      response: generatedResponse,
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
        grounding: groundingValidation,
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
