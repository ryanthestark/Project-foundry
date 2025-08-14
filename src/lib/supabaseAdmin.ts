import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Utility functions for query embeddings cache
export async function getQueryEmbedding(queryHash: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('query_embeddings')
      .select('*')
      .eq('query_hash', queryHash)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Failed to get query embedding:', error)
      return null
    }

    if (data) {
      // Update usage statistics
      await supabaseAdmin.rpc('update_query_usage', { query_hash_param: queryHash })
    }

    return data
  } catch (error) {
    console.error('Exception while getting query embedding:', error)
    return null
  }
}

export async function saveQueryEmbedding(embeddingData: {
  queryText: string
  queryHash: string
  embedding: number[]
  modelName: string
  embeddingDimensions: number
}) {
  try {
    const { error } = await supabaseAdmin
      .from('query_embeddings')
      .insert({
        query_text: embeddingData.queryText,
        query_hash: embeddingData.queryHash,
        embedding: `[${embeddingData.embedding.join(',')}]`,
        model_name: embeddingData.modelName,
        embedding_dimensions: embeddingData.embeddingDimensions,
        query_length: embeddingData.queryText.length
      })

    if (error) {
      console.error('Failed to save query embedding:', error)
      return false
    }

    console.log(`✅ Query embedding cached: ${embeddingData.queryHash}`)
    return true
  } catch (error) {
    console.error('Exception while saving query embedding:', error)
    return false
  }
}

export async function findSimilarQueries(embedding: number[], threshold: number = 0.8, limit: number = 5) {
  try {
    const { data, error } = await supabaseAdmin.rpc('find_similar_queries', {
      query_embedding: `[${embedding.join(',')}]`,
      similarity_threshold: threshold,
      match_count: limit
    })

    if (error) {
      console.error('Failed to find similar queries:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while finding similar queries:', error)
    return []
  }
}

// Lightweight matches logging as JSONB
export async function logMatches(matchesData: {
  requestId: string
  queryHash: string
  matches: Array<{
    embeddingId?: string
    source: string
    similarity: number
    rankPosition: number
  }>
}) {
  try {
    // Defensive validation
    if (!matchesData?.requestId || typeof matchesData.requestId !== 'string') {
      console.error('Invalid requestId for matches logging:', matchesData?.requestId)
      return false
    }
    
    if (!matchesData?.queryHash || typeof matchesData.queryHash !== 'string') {
      console.error('Invalid queryHash for matches logging:', matchesData?.queryHash)
      return false
    }
    
    if (!Array.isArray(matchesData?.matches)) {
      console.error('Invalid matches array for logging:', typeof matchesData?.matches)
      return false
    }
    
    // Filter and validate matches
    const validMatches = matchesData.matches.filter(match => {
      return match && 
             typeof match.source === 'string' && 
             match.source.length > 0 &&
             typeof match.similarity === 'number' && 
             !isNaN(match.similarity) &&
             match.similarity >= 0 && 
             match.similarity <= 1
    }).slice(0, 5) // Only log top 5 matches to keep it lightweight
    
    if (validMatches.length === 0) {
      console.log(`No valid matches to log for request: ${matchesData.requestId}`)
      return true // Not an error, just no valid matches
    }
    
    // Calculate summary statistics with error handling
    let matchesJsonb
    try {
      const similarities = validMatches.map(m => m.similarity)
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length
      const maxSimilarity = Math.max(...similarities)
      const minSimilarity = Math.min(...similarities)
      
      matchesJsonb = {
        match_count: validMatches.length,
        avg_similarity: Math.round(avgSimilarity * 1000) / 1000,
        max_similarity: Math.round(maxSimilarity * 1000) / 1000,
        min_similarity: Math.round(minSimilarity * 1000) / 1000,
        sources: validMatches.map((match, index) => ({
          embedding_id: match.embeddingId ? String(match.embeddingId).slice(0, 100) : null,
          source: String(match.source).slice(0, 200),
          similarity: Math.round(match.similarity * 1000) / 1000,
          rank: typeof match.rankPosition === 'number' ? match.rankPosition : index + 1
        })),
        metadata: {
          lightweight: true,
          timestamp: new Date().toISOString(),
          original_count: matchesData.matches.length,
          valid_count: validMatches.length
        }
      }
    } catch (jsonError) {
      console.error('Error preparing matches JSONB:', jsonError)
      matchesJsonb = {
        match_count: validMatches.length,
        error: 'Failed to process match statistics',
        timestamp: new Date().toISOString()
      }
    }

    const insertData = {
      request_id: String(matchesData.requestId).slice(0, 100),
      query_hash: String(matchesData.queryHash).slice(0, 100),
      matches_data: matchesJsonb
    }

    const { error } = await supabaseAdmin
      .from('matches')
      .insert(insertData)

    if (error) {
      console.error('Failed to log matches:', {
        error: error,
        requestId: matchesData.requestId,
        errorCode: error.code,
        errorMessage: error.message
      })
      return false
    }

    console.log(`✅ Logged ${validMatches.length} lightweight matches as JSONB for request: ${matchesData.requestId}`)
    return true
  } catch (error) {
    console.error('Exception while logging matches:', {
      error: error.message,
      stack: error.stack,
      requestId: matchesData?.requestId || 'unknown'
    })
    return false
  }
}

export async function getMatchStats(requestId: string) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_match_stats', {
      request_id_param: requestId
    })

    if (error) {
      console.error('Failed to get match stats:', error)
      return null
    }

    return data?.[0] || null
  } catch (error) {
    console.error('Exception while getting match stats:', error)
    return null
  }
}

export async function getTopSources(limitCount: number = 10, daysBack: number = 30) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_top_sources', {
      limit_count: limitCount,
      days_back: daysBack
    })

    if (error) {
      console.error('Failed to get top sources:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while getting top sources:', error)
    return []
  }
}

// Lightweight response logging
export async function logResponse(responseData: {
  requestId: string
  queryHash: string
  responseText: string
  modelName: string
  groundingScore?: number
  hasSourceReferences?: boolean
  hasDirectQuotes?: boolean
  sourcesCited?: number
}) {
  try {
    // Defensive validation
    if (!responseData?.requestId || typeof responseData.requestId !== 'string') {
      console.error('Invalid requestId for response logging:', responseData?.requestId)
      return false
    }
    
    if (!responseData?.queryHash || typeof responseData.queryHash !== 'string') {
      console.error('Invalid queryHash for response logging:', responseData?.queryHash)
      return false
    }
    
    if (!responseData?.responseText || typeof responseData.responseText !== 'string') {
      console.error('Invalid responseText for logging:', typeof responseData?.responseText)
      return false
    }
    
    if (!responseData?.modelName || typeof responseData.modelName !== 'string') {
      console.error('Invalid modelName for logging:', responseData?.modelName)
      return false
    }
    
    // Safe word count calculation
    let wordCount = 0
    try {
      const words = responseData.responseText.trim().split(/\s+/).filter(word => word.length > 0)
      wordCount = words.length
    } catch (wordError) {
      console.error('Error calculating word count:', wordError)
      wordCount = Math.floor(responseData.responseText.length / 5) // Rough estimate
    }
    
    // Safe quality score calculation
    let qualityScore = 0
    try {
      if (responseData.hasSourceReferences === true) qualityScore += 40
      if (responseData.hasDirectQuotes === true) qualityScore += 30
      if (typeof responseData.groundingScore === 'number' && responseData.groundingScore > 70) qualityScore += 30
      qualityScore = Math.max(0, Math.min(100, qualityScore)) // Clamp between 0-100
    } catch (scoreError) {
      console.error('Error calculating quality score:', scoreError)
      qualityScore = 0
    }

    const insertData = {
      request_id: String(responseData.requestId).slice(0, 100),
      query_hash: String(responseData.queryHash).slice(0, 100),
      response_text: String(responseData.responseText).slice(0, 2000),
      response_length: Math.max(0, responseData.responseText.length),
      model_name: String(responseData.modelName).slice(0, 100),
      temperature: null,
      max_tokens: null,
      grounding_score: typeof responseData.groundingScore === 'number' ? Math.max(0, Math.min(100, responseData.groundingScore)) : null,
      has_source_references: Boolean(responseData.hasSourceReferences),
      has_direct_quotes: Boolean(responseData.hasDirectQuotes),
      acknowledges_limitations: false,
      avoids_ungrounded_claims: false,
      response_quality_score: qualityScore,
      word_count: wordCount,
      sentence_count: null,
      avg_sentence_length: null,
      readability_score: null,
      sources_cited: typeof responseData.sourcesCited === 'number' ? Math.max(0, responseData.sourcesCited) : 0,
      direct_quotes_count: null,
      metadata: { 
        lightweight: true,
        timestamp: new Date().toISOString(),
        validation_passed: true
      }
    }

    const { error } = await supabaseAdmin
      .from('responses')
      .insert(insertData)

    if (error) {
      console.error('Failed to log response:', {
        error: error,
        requestId: responseData.requestId,
        errorCode: error.code,
        errorMessage: error.message
      })
      return false
    }

    console.log(`✅ Lightweight response logged: ${responseData.requestId}`)
    return true
  } catch (error) {
    console.error('Exception while logging response:', {
      error: error.message,
      stack: error.stack,
      requestId: responseData?.requestId || 'unknown'
    })
    return false
  }
}

export async function getResponseQualityStats(daysBack: number = 30, modelFilter?: string) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_response_quality_stats', {
      days_back: daysBack,
      model_filter: modelFilter || null
    })

    if (error) {
      console.error('Failed to get response quality stats:', error)
      return null
    }

    return data?.[0] || null
  } catch (error) {
    console.error('Exception while getting response quality stats:', error)
    return null
  }
}

export async function getTopResponses(limitCount: number = 10, minGroundingScore: number = 70) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_top_responses', {
      limit_count: limitCount,
      min_grounding_score: minGroundingScore
    })

    if (error) {
      console.error('Failed to get top responses:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while getting top responses:', error)
    return []
  }
}

// Lightweight timestamp logging
export async function logTimestamp(timestampData: {
  entityType: string
  entityId: string
  createdAt: Date | string
  sessionId?: string
}) {
  try {
    // Defensive validation
    if (!timestampData?.entityType || typeof timestampData.entityType !== 'string') {
      console.error('Invalid entityType for timestamp logging:', timestampData?.entityType)
      return false
    }
    
    if (!timestampData?.entityId || typeof timestampData.entityId !== 'string') {
      console.error('Invalid entityId for timestamp logging:', timestampData?.entityId)
      return false
    }
    
    if (!timestampData?.createdAt) {
      console.error('Invalid createdAt for timestamp logging:', timestampData?.createdAt)
      return false
    }
    
    // Validate and format timestamp
    let formattedTimestamp
    try {
      if (timestampData.createdAt instanceof Date) {
        formattedTimestamp = timestampData.createdAt.toISOString()
      } else if (typeof timestampData.createdAt === 'string') {
        // Validate it's a valid date string
        const testDate = new Date(timestampData.createdAt)
        if (isNaN(testDate.getTime())) {
          throw new Error('Invalid date string')
        }
        formattedTimestamp = testDate.toISOString()
      } else {
        throw new Error('Invalid date type')
      }
    } catch (dateError) {
      console.error('Error formatting timestamp:', dateError)
      formattedTimestamp = new Date().toISOString() // Fallback to current time
    }

    const insertData = {
      entity_type: String(timestampData.entityType).slice(0, 50),
      entity_id: String(timestampData.entityId).slice(0, 100),
      created_at: formattedTimestamp,
      source_table: null,
      metadata: null,
      timezone: 'UTC',
      created_by: null,
      session_id: timestampData.sessionId ? String(timestampData.sessionId).slice(0, 100) : null
    }

    const { error } = await supabaseAdmin
      .from('timestamps')
      .insert(insertData)

    if (error) {
      console.error('Failed to log timestamp:', {
        error: error,
        entityType: timestampData.entityType,
        entityId: timestampData.entityId,
        errorCode: error.code,
        errorMessage: error.message
      })
      return false
    }

    console.log(`✅ Lightweight timestamp logged: ${timestampData.entityType}`)
    return true
  } catch (error) {
    console.error('Exception while logging timestamp:', {
      error: error.message,
      stack: error.stack,
      entityType: timestampData?.entityType || 'unknown',
      entityId: timestampData?.entityId || 'unknown'
    })
    return false
  }
}

export async function getTimestampStats(entityType?: string, daysBack: number = 30) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_timestamp_stats', {
      entity_type_param: entityType || null,
      days_back: daysBack
    })

    if (error) {
      console.error('Failed to get timestamp stats:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while getting timestamp stats:', error)
    return []
  }
}

export async function getCreationTimeline(entityType?: string, hoursBack: number = 24, bucketHours: number = 1) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_creation_timeline', {
      entity_type_param: entityType || null,
      hours_back: hoursBack,
      bucket_hours: bucketHours
    })

    if (error) {
      console.error('Failed to get creation timeline:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while getting creation timeline:', error)
    return []
  }
}

export async function getRecentActivity(limitCount: number = 50, entityTypeFilter?: string) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_recent_activity', {
      limit_count: limitCount,
      entity_type_filter: entityTypeFilter || null
    })

    if (error) {
      console.error('Failed to get recent activity:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception while getting recent activity:', error)
    return []
  }
}

// Unified RAG logging to single table
export async function logRAGRequest(ragData: {
  requestId: string
  query: string
  queryType?: string
  queryHash: string
  embedding?: {
    model: string
    dimensions: number
    duration: number
    cached: boolean
  }
  matches?: Array<{
    source: string
    similarity: number
    rank: number
  }>
  response?: {
    text?: string
    model: string
    duration: number
    groundingScore: number
    length: number
    hasSourceReferences?: boolean
    hasDirectQuotes?: boolean
    sourcesCited?: number
  }
  performance: {
    embeddingDuration: number
    searchDuration: number
    chatDuration: number
    totalDuration: number
  }
  status: 'success' | 'error' | 'partial'
  errorMessage?: string
  sessionId?: string
}) {
  try {
    console.log(`📊 [${ragData.requestId}] Logging unified RAG request...`)
    
    // Defensive validation of input data
    if (!ragData.requestId || typeof ragData.requestId !== 'string') {
      console.error('Invalid requestId for logging:', ragData.requestId)
      return false
    }
    
    if (!ragData.query || typeof ragData.query !== 'string') {
      console.error('Invalid query for logging:', typeof ragData.query)
      return false
    }
    
    if (!ragData.queryHash || typeof ragData.queryHash !== 'string') {
      console.error('Invalid queryHash for logging:', ragData.queryHash)
      return false
    }
    
    // Prepare matches data as JSONB with error handling
    let matchesJsonb = null
    try {
      if (ragData.matches && Array.isArray(ragData.matches) && ragData.matches.length > 0) {
        const validMatches = ragData.matches.filter(m => 
          m && typeof m.source === 'string' && typeof m.similarity === 'number' && !isNaN(m.similarity)
        )
        
        if (validMatches.length > 0) {
          const similarities = validMatches.map(m => m.similarity)
          matchesJsonb = {
            match_count: validMatches.length,
            avg_similarity: similarities.reduce((a, b) => a + b, 0) / similarities.length,
            max_similarity: Math.max(...similarities),
            min_similarity: Math.min(...similarities),
            sources: validMatches.slice(0, 5).map(match => ({
              source: String(match.source).slice(0, 200), // Truncate long source names
              similarity: Math.round(match.similarity * 1000) / 1000,
              rank: typeof match.rank === 'number' ? match.rank : 0
            }))
          }
        }
      }
    } catch (matchError) {
      console.error('Error preparing matches data:', matchError)
      matchesJsonb = { error: 'Failed to process matches data' }
    }
    
    // Prepare insert data with defensive checks
    const insertData = {
      request_id: String(ragData.requestId).slice(0, 100),
      query: String(ragData.query).slice(0, 2000),
      query_type: ragData.queryType ? String(ragData.queryType).slice(0, 50) : null,
      query_hash: String(ragData.queryHash).slice(0, 100),
      
      // Embedding data with validation
      embedding_model: ragData.embedding?.model ? String(ragData.embedding.model).slice(0, 100) : null,
      embedding_dimensions: ragData.embedding?.dimensions && typeof ragData.embedding.dimensions === 'number' ? ragData.embedding.dimensions : null,
      embedding_cached: Boolean(ragData.embedding?.cached),
      embedding_duration_ms: ragData.performance?.embeddingDuration && typeof ragData.performance.embeddingDuration === 'number' ? Math.max(0, ragData.performance.embeddingDuration) : null,
      
      // Search/match data
      match_count: ragData.matches && Array.isArray(ragData.matches) ? ragData.matches.length : 0,
      matches_data: matchesJsonb,
      search_duration_ms: ragData.performance?.searchDuration && typeof ragData.performance.searchDuration === 'number' ? Math.max(0, ragData.performance.searchDuration) : null,
      
      // Response data with validation
      response_text: ragData.response?.text ? String(ragData.response.text).slice(0, 3000) : null,
      response_model: ragData.response?.model ? String(ragData.response.model).slice(0, 100) : null,
      response_length: ragData.response?.length && typeof ragData.response.length === 'number' ? Math.max(0, ragData.response.length) : 0,
      response_duration_ms: ragData.performance?.chatDuration && typeof ragData.performance.chatDuration === 'number' ? Math.max(0, ragData.performance.chatDuration) : null,
      grounding_score: ragData.response?.groundingScore && typeof ragData.response.groundingScore === 'number' ? Math.max(0, Math.min(100, ragData.response.groundingScore)) : null,
      has_source_references: Boolean(ragData.response?.hasSourceReferences),
      has_direct_quotes: Boolean(ragData.response?.hasDirectQuotes),
      sources_cited: ragData.response?.sourcesCited && typeof ragData.response.sourcesCited === 'number' ? Math.max(0, ragData.response.sourcesCited) : 0,
      
      // Performance and status
      total_duration_ms: ragData.performance?.totalDuration && typeof ragData.performance.totalDuration === 'number' ? Math.max(0, ragData.performance.totalDuration) : null,
      status: ['success', 'error', 'partial'].includes(ragData.status) ? ragData.status : 'error',
      error_message: ragData.errorMessage ? String(ragData.errorMessage).slice(0, 1000) : null,
      
      // Metadata with error handling
      session_id: ragData.sessionId ? String(ragData.sessionId).slice(0, 100) : null,
      metadata: {
        lightweight: true,
        embedding_cached: Boolean(ragData.embedding?.cached),
        timestamp: new Date().toISOString(),
        validation_passed: true
      }
    }
    
    // Log to unified rag_logs table
    const { error: logError } = await supabaseAdmin
      .from('rag_logs')
      .insert(insertData)

    if (logError) {
      console.error('Failed to log unified RAG request:', {
        error: logError,
        requestId: ragData.requestId,
        errorCode: logError.code,
        errorMessage: logError.message
      })
      return false
    }

    console.log(`✅ [${ragData.requestId}] Unified RAG request logged successfully`)
    return true
  } catch (error) {
    console.error('Exception while logging unified RAG request:', {
      error: error.message,
      stack: error.stack,
      requestId: ragData?.requestId || 'unknown'
    })
    return false
  }
}

// Legacy function - now redirects to unified logging
export async function logChatQuery(logData: {
  requestId: string
  query: string
  queryType?: string
  response?: string
  sources?: any[]
  metadata?: any
  embeddingDuration?: number
  searchDuration?: number
  chatDuration?: number
  totalDuration?: number
  matchCount?: number
  groundingScore?: number
  errorMessage?: string
  status?: 'success' | 'error' | 'partial'
}) {
  // Redirect to unified logging
  return logRAGRequest({
    requestId: logData.requestId,
    query: logData.query,
    queryType: logData.queryType,
    queryHash: 'legacy', // Use placeholder for legacy calls
    performance: {
      embeddingDuration: logData.embeddingDuration || 0,
      searchDuration: logData.searchDuration || 0,
      chatDuration: logData.chatDuration || 0,
      totalDuration: logData.totalDuration || 0
    },
    response: logData.response ? {
      text: logData.response,
      model: 'unknown',
      duration: logData.chatDuration || 0,
      groundingScore: logData.groundingScore || 0,
      length: logData.response.length,
      sourcesCited: logData.matchCount || 0
    } : undefined,
    status: logData.status || 'success',
    errorMessage: logData.errorMessage
  })
}
