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

// Utility functions for matches logging
export async function logMatches(matchesData: {
  requestId: string
  queryHash: string
  matches: Array<{
    embeddingId?: string
    source: string
    content: string
    similarity: number
    rankPosition: number
    metadata?: any
    wasUsedInResponse?: boolean
  }>
}) {
  try {
    const matchRecords = matchesData.matches.map((match, index) => ({
      request_id: matchesData.requestId,
      query_hash: matchesData.queryHash,
      embedding_id: match.embeddingId || null,
      source: match.source,
      content: match.content,
      similarity: match.similarity,
      rank_position: match.rankPosition || index + 1,
      metadata: match.metadata || null,
      content_length: match.content.length,
      was_used_in_response: match.wasUsedInResponse || false
    }))

    const { error } = await supabaseAdmin
      .from('matches')
      .insert(matchRecords)

    if (error) {
      console.error('Failed to log matches:', error)
      return false
    }

    console.log(`✅ Logged ${matchRecords.length} matches for request: ${matchesData.requestId}`)
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

// Utility functions for response logging and analysis
export async function logResponse(responseData: {
  requestId: string
  queryHash: string
  responseText: string
  modelName: string
  temperature?: number
  maxTokens?: number
  groundingScore?: number
  hasSourceReferences?: boolean
  hasDirectQuotes?: boolean
  acknowledgesLimitations?: boolean
  avoidsUngroundedClaims?: boolean
  sourcesCited?: number
  directQuotesCount?: number
  metadata?: any
}) {
  try {
    // Calculate response metrics
    const { data: metrics, error: metricsError } = await supabaseAdmin.rpc('calculate_response_metrics', {
      response_text_param: responseData.responseText
    })

    if (metricsError) {
      console.error('Failed to calculate response metrics:', metricsError)
    }

    const responseMetrics = metrics?.[0] || {
      word_count: 0,
      sentence_count: 0,
      avg_sentence_length: 0,
      readability_score: 0
    }

    // Calculate overall quality score
    let qualityScore = 0
    if (responseData.hasSourceReferences) qualityScore += 25
    if (responseData.hasDirectQuotes) qualityScore += 20
    if (responseData.acknowledgesLimitations) qualityScore += 15
    if (responseData.avoidsUngroundedClaims) qualityScore += 20
    if (responseMetrics.readability_score) qualityScore += (responseMetrics.readability_score * 0.2)

    const { error } = await supabaseAdmin
      .from('responses')
      .insert({
        request_id: responseData.requestId,
        query_hash: responseData.queryHash,
        response_text: responseData.responseText,
        response_length: responseData.responseText.length,
        model_name: responseData.modelName,
        temperature: responseData.temperature || null,
        max_tokens: responseData.maxTokens || null,
        grounding_score: responseData.groundingScore || null,
        has_source_references: responseData.hasSourceReferences || false,
        has_direct_quotes: responseData.hasDirectQuotes || false,
        acknowledges_limitations: responseData.acknowledgesLimitations || false,
        avoids_ungrounded_claims: responseData.avoidsUngroundedClaims || false,
        response_quality_score: qualityScore,
        word_count: responseMetrics.word_count,
        sentence_count: responseMetrics.sentence_count,
        avg_sentence_length: responseMetrics.avg_sentence_length,
        readability_score: responseMetrics.readability_score,
        sources_cited: responseData.sourcesCited || 0,
        direct_quotes_count: responseData.directQuotesCount || 0,
        metadata: responseData.metadata || null
      })

    if (error) {
      console.error('Failed to log response:', error)
      return false
    }

    console.log(`✅ Response logged successfully: ${responseData.requestId}`)
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

// Utility functions for timestamp logging and analysis
export async function logTimestamp(timestampData: {
  entityType: string
  entityId: string
  createdAt: Date | string
  sourceTable?: string
  metadata?: any
  timezone?: string
  createdBy?: string
  sessionId?: string
}) {
  try {
    const { error } = await supabaseAdmin
      .from('timestamps')
      .insert({
        entity_type: timestampData.entityType,
        entity_id: timestampData.entityId,
        created_at: timestampData.createdAt,
        source_table: timestampData.sourceTable || null,
        metadata: timestampData.metadata || null,
        timezone: timestampData.timezone || 'UTC',
        created_by: timestampData.createdBy || null,
        session_id: timestampData.sessionId || null
      })

    if (error) {
      console.error('Failed to log timestamp:', error)
      return false
    }

    console.log(`✅ Timestamp logged: ${timestampData.entityType}:${timestampData.entityId}`)
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

// Comprehensive RAG request logging
export async function logRAGRequest(ragData: {
  requestId: string
  query: string
  queryType?: string
  queryHash: string
  embedding?: {
    vector: number[]
    model: string
    dimensions: number
    duration: number
    cached: boolean
  }
  matches?: Array<{
    id?: string
    source: string
    content: string
    similarity: number
    rank: number
    metadata?: any
  }>
  response?: {
    text: string
    model: string
    temperature: number
    maxTokens: number
    duration: number
    groundingScore: number
    qualityMetrics: any
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
    console.log(`📊 [${ragData.requestId}] Logging comprehensive RAG request data...`)
    
    // Log the main request entry
    const { error: requestError } = await supabaseAdmin
      .from('rag_requests')
      .insert({
        request_id: ragData.requestId,
        query: ragData.query,
        query_type: ragData.queryType || null,
        query_hash: ragData.queryHash,
        embedding_model: ragData.embedding?.model || null,
        embedding_dimensions: ragData.embedding?.dimensions || null,
        embedding_cached: ragData.embedding?.cached || false,
        match_count: ragData.matches?.length || 0,
        response_model: ragData.response?.model || null,
        response_length: ragData.response?.text?.length || 0,
        grounding_score: ragData.response?.groundingScore || null,
        embedding_duration_ms: ragData.performance.embeddingDuration,
        search_duration_ms: ragData.performance.searchDuration,
        chat_duration_ms: ragData.performance.chatDuration,
        total_duration_ms: ragData.performance.totalDuration,
        status: ragData.status,
        error_message: ragData.errorMessage || null,
        metadata: {
          embedding: ragData.embedding ? {
            model: ragData.embedding.model,
            dimensions: ragData.embedding.dimensions,
            cached: ragData.embedding.cached
          } : null,
          response: ragData.response ? {
            model: ragData.response.model,
            temperature: ragData.response.temperature,
            maxTokens: ragData.response.maxTokens,
            qualityMetrics: ragData.response.qualityMetrics
          } : null,
          performance: ragData.performance
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
