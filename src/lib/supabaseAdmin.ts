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
