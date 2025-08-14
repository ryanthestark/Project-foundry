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
