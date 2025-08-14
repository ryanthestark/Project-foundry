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
    // Only log top 5 matches to keep it lightweight
    const topMatches = matchesData.matches.slice(0, 5)
    
    // Calculate summary statistics
    const similarities = topMatches.map(m => m.similarity)
    const avgSimilarity = similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0
    const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0
    const minSimilarity = similarities.length > 0 ? Math.min(...similarities) : 0
    
    // Prepare JSONB data
    const matchesJsonb = {
      match_count: topMatches.length,
      avg_similarity: Math.round(avgSimilarity * 1000) / 1000,
      max_similarity: Math.round(maxSimilarity * 1000) / 1000,
      min_similarity: Math.round(minSimilarity * 1000) / 1000,
      sources: topMatches.map((match, index) => ({
        embedding_id: match.embeddingId || null,
        source: match.source,
        similarity: Math.round(match.similarity * 1000) / 1000,
        rank: match.rankPosition || index + 1
      })),
      metadata: {
        lightweight: true,
        timestamp: new Date().toISOString()
      }
    }

    const { error } = await supabaseAdmin
      .from('matches')
      .insert({
        request_id: matchesData.requestId,
        query_hash: matchesData.queryHash,
        matches_data: matchesJsonb
      })

    if (error) {
      console.error('Failed to log matches:', error)
      return false
    }

    console.log(`✅ Logged ${topMatches.length} lightweight matches as JSONB for request: ${matchesData.requestId}`)
    return true
  } catch (error) {
    console.error('Exception while logging matches:', error)
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
    // Simple word count without complex metrics
    const wordCount = responseData.responseText.split(/\s+/).length
    
    // Simple quality score
    let qualityScore = 0
    if (responseData.hasSourceReferences) qualityScore += 40
    if (responseData.hasDirectQuotes) qualityScore += 30
    if (responseData.groundingScore && responseData.groundingScore > 70) qualityScore += 30

    const { error } = await supabaseAdmin
      .from('responses')
      .insert({
        request_id: responseData.requestId,
        query_hash: responseData.queryHash,
        response_text: responseData.responseText.slice(0, 2000), // Truncate long responses
        response_length: responseData.responseText.length,
        model_name: responseData.modelName,
        temperature: null, // Skip detailed model params
        max_tokens: null,
        grounding_score: responseData.groundingScore || null,
        has_source_references: responseData.hasSourceReferences || false,
        has_direct_quotes: responseData.hasDirectQuotes || false,
        acknowledges_limitations: false, // Skip complex analysis
        avoids_ungrounded_claims: false,
        response_quality_score: qualityScore,
        word_count: wordCount,
        sentence_count: null, // Skip sentence analysis
        avg_sentence_length: null,
        readability_score: null,
        sources_cited: responseData.sourcesCited || 0,
        direct_quotes_count: null, // Skip quote counting
        metadata: { lightweight: true }
      })

    if (error) {
      console.error('Failed to log response:', error)
      return false
    }

    console.log(`✅ Lightweight response logged: ${responseData.requestId}`)
    return true
  } catch (error) {
    console.error('Exception while logging response:', error)
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
    const { error } = await supabaseAdmin
      .from('timestamps')
      .insert({
        entity_type: timestampData.entityType,
        entity_id: timestampData.entityId,
        created_at: timestampData.createdAt,
        source_table: null, // Skip source table tracking
        metadata: null, // Skip metadata
        timezone: 'UTC',
        created_by: null,
        session_id: timestampData.sessionId || null
      })

    if (error) {
      console.error('Failed to log timestamp:', error)
      return false
    }

    console.log(`✅ Lightweight timestamp logged: ${timestampData.entityType}`)
    return true
  } catch (error) {
    console.error('Exception while logging timestamp:', error)
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

// Lightweight RAG request logging
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
    model: string
    duration: number
    groundingScore: number
    length: number
  }
  performance: {
    embeddingDuration: number
    searchDuration: number
    chatDuration: number
    totalDuration: number
  }
  status: 'success' | 'error' | 'partial'
  errorMessage?: string
}) {
  try {
    console.log(`📊 [${ragData.requestId}] Logging lightweight RAG request...`)
    
    // Log the main request entry with minimal metadata
    const { error: requestError } = await supabaseAdmin
      .from('rag_requests')
      .insert({
        request_id: ragData.requestId,
        query: ragData.query.slice(0, 1000), // Truncate long queries
        query_type: ragData.queryType || null,
        query_hash: ragData.queryHash,
        embedding_model: ragData.embedding?.model || null,
        embedding_dimensions: ragData.embedding?.dimensions || null,
        embedding_cached: ragData.embedding?.cached || false,
        match_count: ragData.matches?.length || 0,
        response_model: ragData.response?.model || null,
        response_length: ragData.response?.length || 0,
        grounding_score: ragData.response?.groundingScore || null,
        embedding_duration_ms: ragData.performance.embeddingDuration,
        search_duration_ms: ragData.performance.searchDuration,
        chat_duration_ms: ragData.performance.chatDuration,
        total_duration_ms: ragData.performance.totalDuration,
        status: ragData.status,
        error_message: ragData.errorMessage?.slice(0, 500) || null, // Truncate long errors
        metadata: {
          embedding_cached: ragData.embedding?.cached || false,
          match_sources: ragData.matches?.slice(0, 3).map(m => m.source) || [], // Only top 3 sources
          avg_similarity: ragData.matches?.length ? 
            ragData.matches.reduce((sum, m) => sum + m.similarity, 0) / ragData.matches.length : 0
        }
      })

    if (requestError) {
      console.error('Failed to log RAG request:', requestError)
      return false
    }

    console.log(`✅ [${ragData.requestId}] RAG request logged successfully`)
    return true
  } catch (error) {
    console.error('Exception while logging RAG request:', error)
    return false
  }
}

// Utility function for logging RAG chat queries
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
  try {
    const { error } = await supabaseAdmin
      .from('chat_logs')
      .insert({
        request_id: logData.requestId,
        query: logData.query,
        query_type: logData.queryType || null,
        response: logData.response || null,
        sources: logData.sources || null,
        metadata: logData.metadata || null,
        embedding_duration_ms: logData.embeddingDuration || null,
        search_duration_ms: logData.searchDuration || null,
        chat_duration_ms: logData.chatDuration || null,
        total_duration_ms: logData.totalDuration || null,
        match_count: logData.matchCount || null,
        grounding_score: logData.groundingScore || null,
        error_message: logData.errorMessage || null,
        status: logData.status || 'success'
      })

    if (error) {
      console.error('Failed to log chat query:', error)
      // Don't throw - logging failures shouldn't break the main flow
    } else {
      console.log(`✅ Chat query logged successfully: ${logData.requestId}`)
    }
  } catch (error) {
    console.error('Exception while logging chat query:', error)
    // Don't throw - logging failures shouldn't break the main flow
  }
}
