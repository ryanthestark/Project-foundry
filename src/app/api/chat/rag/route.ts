// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import {
  supabaseAdmin,
  logChatQuery,
  getQueryEmbedding,
  saveQueryEmbedding,
  findSimilarQueries,
  logMatches,
  logResponse,
  logTimestamp,
  logRAGRequest
} from '@/lib/supabaseAdmin'
import {
  openai,
  EMBED_MODEL,
  CHAT_MODEL,
  EMBEDDING_DIMENSIONS,
  validateEmbeddingDimensions
} from '@/lib/openai'
import { createHash } from 'crypto'
import { logRagEventNonBlocking, toNumberArray512 } from '@/lib/ragLogger'

// ---------- NEW: normalize any embedding shape into number[] ----------
function normalizeEmbedding(input: any): number[] {
  if (Array.isArray(input)) return input.map(Number)
  if (input && typeof input === 'object' && typeof input.length === 'number') {
    try { return Array.from(input as ArrayLike<number>).map(Number) } catch {}
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) return parsed.map(Number)
    } catch {
      const cleaned = input.trim().replace(/^\[|\]$/g, '')
      if (cleaned.length) {
        return cleaned.split(',').map(x => Number(x.trim())).filter(n => Number.isFinite(n))
      }
    }
  }
  // Fallback to zeros to avoid crashes; validation will still warn downstream.
  return new Array(EMBEDDING_DIMENSIONS).fill(0)
}

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
  validation.hasSourceReferences = sourceReferencePatterns.some(pattern => pattern.test(responseLower))

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
  validation.acknowledgesLimitations = limitationPatterns.some(pattern => pattern.test(responseLower))

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
  validation.avoidsUngroundedClaims = !ungroundedPatterns.some(pattern => pattern.test(responseLower))

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

  // Initialize timing variables for detailed logging
  let embeddingDuration = 0
  let searchDuration = 0
  let chatDuration = 0
  let query = ''
  let queryType = ''
  let errorMessage = ''
  let status: 'success' | 'error' | 'partial' = 'success'

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

    const { query: rawQuery, type } = body
    query = rawQuery
    queryType = type

    if (!query || typeof query !== 'string') {
      console.error(`❌ [${requestId}] Missing or invalid query parameter:`, { query, type: typeof query })

      errorMessage = 'Query parameter is required and must be a string'
      status = 'error'

      // Log the error using supabaseAdmin (non-blocking)
      try {
        await logChatQuery({
          requestId,
          query: query || '[invalid]',
          queryType,
          errorMessage,
          status,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
      }

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

      errorMessage = `Query is too long (max 10000 characters): ${query.length}`
      status = 'error'

      // Log the error using supabaseAdmin (non-blocking)
      try {
        await logChatQuery({
          requestId,
          query: query.slice(0, 1000) + '...[truncated]',
          queryType,
          errorMessage,
          status,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
      }

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

    // Step 1: Check for cached embedding or create new one
    const normalizedQuery = query.trim().toLowerCase()
    const queryHash = createHash('sha256').update(normalizedQuery).digest('hex')
    console.log(`🔍 [${requestId}] Query hash: ${queryHash.slice(0, 8)}...`)

    let queryEmbedding: number[]
    const embedStartTime = Date.now()

    // Try to get cached embedding first
    console.log(`🔄 [${requestId}] Checking for cached embedding...`)
    const cachedEmbedding = await getQueryEmbedding(queryHash)

    if (cachedEmbedding && cachedEmbedding.model_name === EMBED_MODEL) {
      console.log(`✅ [${requestId}] Using cached embedding (used ${cachedEmbedding.usage_count} times)`)
      queryEmbedding = normalizeEmbedding(cachedEmbedding.embedding)
      embeddingDuration = Date.now() - embedStartTime

      // Find and log similar queries for analytics
      const similarQueries = await findSimilarQueries(queryEmbedding, 0.9, 3)
      if (similarQueries.length > 0) {
        console.log(`🔍 [${requestId}] Found ${similarQueries.length} similar queries:`,
          similarQueries.map(q => ({
            text: q.query_text.slice(0, 50) + '...',
            similarity: q.similarity.toFixed(3),
            usage: q.usage_count
          }))
        )
      }
    } else {
      console.log(`🔄 [${requestId}] Creating new embedding...`)
      let embedRes
      try {
        embedRes = await openai.embeddings.create({
          input: query,
          model: EMBED_MODEL,
          dimensions: EMBEDDING_DIMENSIONS, // Must match Supabase vector schema
        })
        embeddingDuration = Date.now() - embedStartTime
        console.log(`✅ [${requestId}] Embedding created in ${embeddingDuration}ms`)

        queryEmbedding = normalizeEmbedding(embedRes.data[0].embedding)

        // Cache the new embedding for future use (non-blocking)
        try {
          await saveQueryEmbedding({
            queryText: query,
            queryHash,
            embedding: queryEmbedding,
            modelName: EMBED_MODEL,
            embeddingDimensions: EMBEDDING_DIMENSIONS
          })
        } catch (cacheError) {
          console.error(`⚠️ [${requestId}] Failed to cache embedding, but continuing:`, cacheError)
        }

      } catch (error: any) {
        embeddingDuration = Date.now() - embedStartTime
        console.error(`❌ [${requestId}] OpenAI embedding failed:`, {
          error: error.message,
          code: error.code,
          type: error.type,
          model: EMBED_MODEL,
          queryLength: query.length,
          duration: embeddingDuration
        })

        errorMessage = `Failed to create embedding: ${error.message}`
        status = 'error'

        // Log the error using supabaseAdmin (non-blocking)
        try {
          await logChatQuery({
            requestId,
            query,
            queryType,
            errorMessage,
            status,
            embeddingDuration,
            totalDuration: Date.now() - startTime
          })
        } catch (logError) {
          console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
        }

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
    }

    // Safe debug prints on normalized arrays
    console.log(`🧪 [${requestId}] Embedding dimensions:`, queryEmbedding.length)
    try {
      console.log(`🧪 [${requestId}] Embedding sample (first 5):`, queryEmbedding.slice(0, 5).map(v => Number(v).toFixed(4)))
      console.log(`🧪 [${requestId}] Embedding sample (middle 5):`, queryEmbedding.slice(250, 255).map(v => Number(v).toFixed(4)))
      console.log(`🧪 [${requestId}] Embedding sample (last 5):`, queryEmbedding.slice(-5).map(v => Number(v).toFixed(4)))
    } catch {}

    console.log(`🧪 [${requestId}] Using model:`, EMBED_MODEL)

    // Validate embedding dimensions match Supabase schema (post-normalization)
    try {
      validateEmbeddingDimensions(queryEmbedding)
      console.log(`✅ [${requestId}] Embedding dimensions validated: ${queryEmbedding.length} matches vector(${EMBEDDING_DIMENSIONS})`)
    } catch (error: any) {
      console.error(`❌ [${requestId}] Embedding validation failed:`, error.message)

      errorMessage = `Embedding validation failed: ${error.message}`
      status = 'error'

      // Log the error using supabaseAdmin (non-blocking)
      try {
        await logChatQuery({
          requestId,
          query,
          queryType,
          errorMessage,
          status,
          embeddingDuration,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
      }

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
    // Convert array to proper vector format for PostgreSQL (vector literal)
    const vectorString: string = `[${queryEmbedding.join(',')}]`

    // Always send filter_type (null when empty) to force 4-arg RPC signature
    const rpcParams: {
      query_embedding: string
      match_count: number
      similarity_threshold: number
      filter_type: string | null
    } = {
      query_embedding: vectorString,
      match_count: 8,
      similarity_threshold: 0.30, // similarity in [0..1]
      filter_type: null
    }

    if (type && String(type).trim()) {
      rpcParams.filter_type = String(type).trim()
      console.log("🧪 Applying type filter:", rpcParams.filter_type)
    } else {
      console.log("🧪 No type filter applied (sending null)")
    }

    console.log(`🧪 [${requestId}] RPC params:`, {
      match_count: rpcParams.match_count,
      similarity_threshold: rpcParams.similarity_threshold,
      filter_type: rpcParams.filter_type ?? 'null',
      query_embedding: `[${queryEmbedding.length}D vector string]`,
    })

    console.log(`🔄 [${requestId}] Calling Supabase match_embeddings RPC...`)
    const rpcStartTime = Date.now()
    const { data: matches, error } = await supabase.rpc('match_embeddings', rpcParams)
    searchDuration = Date.now() - rpcStartTime
    console.log(`🧪 [${requestId}] RPC completed in ${searchDuration}ms`)

    console.log(`🧪 [${requestId}] Raw RPC response - data:`, matches?.length || 0, 'matches')
    console.log(`🧪 [${requestId}] Raw RPC response - error:`, error)

    // ---------- NEW: belt & suspenders post-filter ----------
    const MIN_SIMILARITY = 0.30
    const filteredMatches = (matches ?? []).filter((m: any) => (m?.similarity ?? 0) >= MIN_SIMILARITY)

    console.log(`🧪 [${requestId}] Match count breakdown:`, {
      total: matches?.length || 0,
      kept: filteredMatches.length,
      dropped_low_sim: (matches?.length || 0) - filteredMatches.length
    })

    if (error) {
      console.error(`❌ [${requestId}] Supabase match_embeddings error:`, {
        error,
        code: (error as any).code,
        message: (error as any).message,
        details: (error as any).details,
        hint: (error as any).hint,
        rpcParams: { ...rpcParams, query_embedding: `[${queryEmbedding.length}D vector]` },
        duration: searchDuration
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

      errorMessage = `Supabase match_embeddings failed: ${(error as any).message}`
      status = 'error'

      // Log the error using supabaseAdmin (non-blocking)
      try {
        await logChatQuery({
          requestId,
          query,
          queryType,
          errorMessage,
          status,
          embeddingDuration,
          searchDuration,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
      }

      return NextResponse.json(
        {
          error: 'Supabase match_embeddings failed',
          details: error,
          rpcDuration: searchDuration,
          connectionTest: { hasData: !!testData?.length, error: testError },
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    if (filteredMatches.length > 0) {
      console.log("🧪 Top match similarity:", filteredMatches[0].similarity?.toFixed(4))
      console.log("🧪 All kept similarities:", filteredMatches.map((m: any) => m.similarity?.toFixed(4)))
      console.log("🧪 Match sources:", filteredMatches.map((m: any) => m.source))
      console.log("🧪 Match types:", filteredMatches.map((m: any) => m.metadata?.type || 'unknown'))
      console.log("🧪 Sample match structure:", Object.keys(filteredMatches[0]))
      console.log("🧪 Sample match content preview:", (filteredMatches[0].content ?? '').slice(0, 100) + '...')
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
          query_embedding: vectorString, // correct vector literal
          match_count: 3,
          similarity_threshold: 0.1
        })
        console.log("🧪 Unfiltered matches:", unfiltered?.length || 0)
        console.log("🧪 Unfiltered error:", unfilteredError)
      }
    }

    // Handle case where no matches are found
    if (filteredMatches.length === 0) {
      console.log("⚠️ No matches found for query")

      const noMatchResponse = "I couldn't find any relevant information in the knowledge base for your query."
      status = 'partial'

      // Existing lightweight analytics logs
      try {
        await logChatQuery({
          requestId,
          query,
          queryType,
          response: noMatchResponse,
          sources: [],
          embeddingDuration,
          searchDuration,
          matchCount: 0,
          status,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log partial result, but continuing:`, logError)
      }

      // NEW: rag_logs (non-blocking, fire-and-forget)
      logRagEventNonBlocking({
        query,
        queryEmbedding: toNumberArray512(queryEmbedding),
        matches: [],
        response: { response: noMatchResponse, sources: [] },
      })

      return NextResponse.json({
        response: noMatchResponse,
        sources: []
      })
    }

    // Step 3: Generate context from matched chunks with source attribution
    const context = filteredMatches.map((m: any, index: number) =>
      `[Source ${index + 1}: ${m.source}]\n${m.content}`
    ).join('\n\n---\n\n')
    console.log("🧪 Context length:", context.length)
    console.log("🧪 Context sources:", filteredMatches.map((m: any) => m.source).join(', '))

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
      chatDuration = Date.now() - chatStartTime
      console.log(`✅ [${requestId}] Chat response generated successfully in ${chatDuration}ms`)
    } catch (error: any) {
      chatDuration = Date.now() - chatStartTime
      console.error(`❌ [${requestId}] OpenAI chat completion failed:`, {
        error: error.message,
        code: error.code,
        type: error.type,
        model: CHAT_MODEL,
        contextLength: context.length,
        duration: chatDuration
      })

      errorMessage = `Failed to generate response: ${error.message}`
      status = 'error'

      // Existing analytics logs
      try {
        await logChatQuery({
          requestId,
          query,
          queryType,
          sources: filteredMatches.map((m: any) => ({
            source: m.source || 'unknown',
            similarity: m.similarity || 0,
            type: m.metadata?.type || m.type || 'unknown'
          })),
          errorMessage,
          status,
          embeddingDuration,
          searchDuration,
          chatDuration,
          matchCount: filteredMatches.length,
          totalDuration: Date.now() - startTime
        })
      } catch (logError) {
        console.error(`⚠️ [${requestId}] Failed to log error, but continuing:`, logError)
      }

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
    const groundingValidation = validateResponseGrounding(generatedResponse, filteredMatches, query)
    console.log(`🧪 [${requestId}] Grounding validation:`, groundingValidation)

    const totalDuration = Date.now() - startTime
    const sources = filteredMatches.map((m: any) => ({
      source: m.source || 'unknown',
      similarity: m.similarity || 0,
      type: m.metadata?.type || m.type || 'unknown'
    }))

    const responseData = {
      response: generatedResponse,
      sources,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        matchCount: filteredMatches.length,
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
      totalDuration
    })

    // Existing lightweight analytics logs
    try {
      await logResponse({
        requestId,
        queryHash,
        responseText: generatedResponse,
        modelName: CHAT_MODEL,
        groundingScore: groundingValidation.score,
        hasSourceReferences: groundingValidation.hasSourceReferences,
        hasDirectQuotes: groundingValidation.hasDirectQuotes,
        sourcesCited: filteredMatches.length
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log response, but continuing:`, logError)
    }

    try {
      await logMatches({
        requestId,
        queryHash,
        matches: filteredMatches.map((match: any, index: number) => ({
          embeddingId: match.id,
          source: match.source,
          similarity: match.similarity,
          rankPosition: index + 1
        }))
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log matches, but continuing:`, logError)
    }

    // Lightweight timestamps
    const requestTimestamp = new Date(startTime)
    try {
      await logTimestamp({
        entityType: 'rag_request',
        entityId: requestId,
        createdAt: requestTimestamp,
        sessionId: requestId
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log timestamp, but continuing:`, logError)
    }

    // Unified RAG request data
    try {
      await logRAGRequest({
        requestId,
        query,
        queryType,
        queryHash,
        embedding: {
          model: EMBED_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          duration: embeddingDuration,
          cached: !!cachedEmbedding
        },
        matches: filteredMatches.slice(0, 5).map((match: any, index: number) => ({
          source: match.source,
          similarity: match.similarity,
          rank: index + 1
        })),
        response: {
          text: generatedResponse,
          model: CHAT_MODEL,
          duration: chatDuration,
          groundingScore: groundingValidation.score,
          length: generatedResponse.length,
          hasSourceReferences: groundingValidation.hasSourceReferences,
          hasDirectQuotes: groundingValidation.hasDirectQuotes,
          sourcesCited: filteredMatches.length
        },
        performance: {
          embeddingDuration,
          searchDuration,
          chatDuration,
          totalDuration
        },
        status: 'success',
        sessionId: requestId
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log unified RAG request, but continuing:`, logError)
    }

    // Existing success completion log
    try {
      await logChatQuery({
        requestId,
        query,
        queryType,
        response: generatedResponse,
        sources,
        metadata: {
          grounding: groundingValidation,
          model: { embedding: EMBED_MODEL, chat: CHAT_MODEL }
        },
        embeddingDuration,
        searchDuration,
        chatDuration,
        totalDuration,
        matchCount: filteredMatches.length,
        groundingScore: groundingValidation.score,
        status: 'success'
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log successful completion, but continuing:`, logError)
    }

    // NEW: rag_logs (non-blocking, fire-and-forget)
    logRagEventNonBlocking({
      query,
      queryEmbedding: toNumberArray512(queryEmbedding),
      matches: filteredMatches,
      response: responseData,
    })

    return NextResponse.json(responseData)

  } catch (error: any) {
    const totalDuration = Date.now() - startTime
    console.error(`❌ [${requestId}] RAG endpoint error:`, {
      error: error.message,
      stack: error.stack,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    })

    // Unified RAG request error (existing)
    try {
      await logRAGRequest({
        requestId,
        query: query || '[unknown]',
        queryType,
        queryHash: (typeof query === 'string' && query.trim()) ? createHash('sha256').update(query.trim().toLowerCase()).digest('hex') : 'unknown',
        performance: {
          embeddingDuration,
          searchDuration,
          chatDuration,
          totalDuration
        },
        status: 'error',
        errorMessage: error.message,
        sessionId: requestId
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log unified RAG error, but continuing:`, logError)
    }

    // Existing unexpected error log
    try {
      await logChatQuery({
        requestId,
        query: query || '[unknown]',
        queryType,
        errorMessage: `Internal server error: ${error.message}`,
        status: 'error',
        embeddingDuration,
        searchDuration,
        chatDuration,
        totalDuration
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log unexpected error, but continuing:`, logError)
    }

    // NEW: rag_logs (non-blocking, best-effort)
    try {
      logRagEventNonBlocking({
        query: query || 'UNKNOWN',
        queryEmbedding: new Array(512).fill(0),
        matches: [],
        response: { error: String(error?.message ?? error) },
      })
    } catch {}

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
