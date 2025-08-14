// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { supabaseAdmin, logChatQuery, getQueryEmbedding, saveQueryEmbedding, findSimilarQueries, logMatches, logResponse, logTimestamp, logRAGRequest } from '@/lib/supabaseAdmin'
import { openai, EMBED_MODEL, CHAT_MODEL, EMBEDDING_DIMENSIONS, validateEmbeddingDimensions } from '@/lib/openai'
import { createHash } from 'crypto'

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
      queryEmbedding = cachedEmbedding.embedding
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
        
        queryEmbedding = embedRes.data[0].embedding
        
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
        
      } catch (error) {
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
    searchDuration = Date.now() - rpcStartTime
    console.log(`🧪 [${requestId}] RPC completed in ${searchDuration}ms`)

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
      
      errorMessage = `Supabase match_embeddings failed: ${error.message}`
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
      
      const noMatchResponse = "I couldn't find any relevant information in the knowledge base for your query."
      status = 'partial'
      
      // Log the partial result using supabaseAdmin (non-blocking)
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
      
      return NextResponse.json({
        response: noMatchResponse,
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
      chatDuration = Date.now() - chatStartTime
      console.log(`✅ [${requestId}] Chat response generated successfully in ${chatDuration}ms`)
    } catch (error) {
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
      
      // Log the error using supabaseAdmin (non-blocking)
      try {
        await logChatQuery({
          requestId,
          query,
          queryType,
          sources: matches.map((m: any) => ({
            source: m.source || 'unknown',
            similarity: m.similarity || 0,
            type: m.metadata?.type || m.type || 'unknown'
          })),
          errorMessage,
          status,
          embeddingDuration,
          searchDuration,
          chatDuration,
          matchCount: matches.length,
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
    const groundingValidation = validateResponseGrounding(generatedResponse, matches, query)
    console.log(`🧪 [${requestId}] Grounding validation:`, groundingValidation)
    
    const totalDuration = Date.now() - startTime
    const sources = matches.map((m: any) => ({
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
      totalDuration
    })
    
    // Count direct quotes in response
    const directQuotesCount = (generatedResponse.match(/["'].*?["']/g) || []).length

    // Log response for analysis using supabaseAdmin (non-blocking, lightweight)
    try {
      await logResponse({
        requestId,
        queryHash,
        responseText: generatedResponse,
        modelName: CHAT_MODEL,
        groundingScore: groundingValidation.score,
        hasSourceReferences: groundingValidation.hasSourceReferences,
        hasDirectQuotes: groundingValidation.hasDirectQuotes,
        sourcesCited: matches.length
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log response, but continuing:`, logError)
    }

    // Log matches for analysis using supabaseAdmin (non-blocking, lightweight)
    try {
      await logMatches({
        requestId,
        queryHash,
        matches: matches.map((match: any, index: number) => ({
          embeddingId: match.id,
          source: match.source,
          similarity: match.similarity,
          rankPosition: index + 1
        }))
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log matches, but continuing:`, logError)
    }

    // Log lightweight timestamps using supabaseAdmin (non-blocking)
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

    // Log unified RAG request data using supabaseAdmin (non-blocking)
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
        matches: matches.slice(0, 5).map((match: any, index: number) => ({
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
          sourcesCited: matches.length
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

    // Log successful completion using supabaseAdmin (keeping existing logging for compatibility) (non-blocking)
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
        matchCount: matches.length,
        groundingScore: groundingValidation.score,
        status: 'success'
      })
    } catch (logError) {
      console.error(`⚠️ [${requestId}] Failed to log successful completion, but continuing:`, logError)
    }
    
    return NextResponse.json(responseData)

  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`❌ [${requestId}] RAG endpoint error:`, {
      error: error.message,
      stack: error.stack,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    })
    
    // Log unified RAG request error using supabaseAdmin (non-blocking)
    try {
      await logRAGRequest({
        requestId,
        query: query || '[unknown]',
        queryType,
        queryHash: queryHash || 'unknown',
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

    // Log the unexpected error using supabaseAdmin (keeping existing logging for compatibility) (non-blocking)
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
