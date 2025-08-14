-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create unified rag_logs table for all RAG request logging
CREATE TABLE IF NOT EXISTS rag_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  query_type TEXT,
  query_hash TEXT NOT NULL,
  
  -- Embedding data
  embedding_model TEXT,
  embedding_dimensions INTEGER,
  embedding_cached BOOLEAN DEFAULT false,
  embedding_duration_ms INTEGER,
  
  -- Search/match data
  match_count INTEGER DEFAULT 0,
  matches_data JSONB, -- Store match details as JSONB
  search_duration_ms INTEGER,
  
  -- Response data
  response_text TEXT,
  response_model TEXT,
  response_length INTEGER,
  response_duration_ms INTEGER,
  grounding_score INTEGER,
  has_source_references BOOLEAN DEFAULT false,
  has_direct_quotes BOOLEAN DEFAULT false,
  sources_cited INTEGER DEFAULT 0,
  
  -- Performance and status
  total_duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  error_message TEXT,
  
  -- Metadata and timestamps
  metadata JSONB,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rag_logs_request_id ON rag_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_rag_logs_query_hash ON rag_logs(query_hash);
CREATE INDEX IF NOT EXISTS idx_rag_logs_status ON rag_logs(status);
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at ON rag_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_query_type ON rag_logs(query_type);
CREATE INDEX IF NOT EXISTS idx_rag_logs_total_duration ON rag_logs(total_duration_ms);
CREATE INDEX IF NOT EXISTS idx_rag_logs_grounding_score ON rag_logs(grounding_score DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_session_id ON rag_logs(session_id);

-- Create JSONB indexes for match data
CREATE INDEX IF NOT EXISTS idx_rag_logs_matches_gin ON rag_logs USING gin(matches_data);

-- Create composite indexes for analytics
CREATE INDEX IF NOT EXISTS idx_rag_logs_status_created ON rag_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_type_performance ON rag_logs(query_type, total_duration_ms);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_rag_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rag_logs_updated_at 
    BEFORE UPDATE ON rag_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_rag_logs_updated_at();

-- Function to get RAG performance statistics
CREATE OR REPLACE FUNCTION get_rag_performance_stats(
  days_back INTEGER DEFAULT 7,
  status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_requests INTEGER,
  successful_requests INTEGER,
  error_requests INTEGER,
  partial_requests INTEGER,
  avg_total_duration FLOAT,
  avg_embedding_duration FLOAT,
  avg_search_duration FLOAT,
  avg_response_duration FLOAT,
  avg_grounding_score FLOAT,
  avg_match_count FLOAT,
  cached_embedding_rate FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(*), 0)::INTEGER as total_requests,
    COALESCE(COUNT(CASE WHEN r.status = 'success' THEN 1 END), 0)::INTEGER as successful_requests,
    COALESCE(COUNT(CASE WHEN r.status = 'error' THEN 1 END), 0)::INTEGER as error_requests,
    COALESCE(COUNT(CASE WHEN r.status = 'partial' THEN 1 END), 0)::INTEGER as partial_requests,
    COALESCE(AVG(r.total_duration_ms), 0.0)::FLOAT as avg_total_duration,
    COALESCE(AVG(r.embedding_duration_ms), 0.0)::FLOAT as avg_embedding_duration,
    COALESCE(AVG(r.search_duration_ms), 0.0)::FLOAT as avg_search_duration,
    COALESCE(AVG(r.response_duration_ms), 0.0)::FLOAT as avg_response_duration,
    COALESCE(AVG(r.grounding_score), 0.0)::FLOAT as avg_grounding_score,
    COALESCE(AVG(r.match_count), 0.0)::FLOAT as avg_match_count,
    COALESCE((COUNT(CASE WHEN r.embedding_cached THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1) * 100), 0.0) as cached_embedding_rate
  FROM rag_logs r
  WHERE r.created_at >= NOW() - (days_back * INTERVAL '1 day')
    AND (status_filter IS NULL OR r.status = status_filter);
END;
$$;

-- Function to get recent RAG requests
CREATE OR REPLACE FUNCTION get_recent_rag_requests(
  limit_count INTEGER DEFAULT 20,
  status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  request_id TEXT,
  query TEXT,
  query_type TEXT,
  status TEXT,
  total_duration_ms INTEGER,
  match_count INTEGER,
  grounding_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.request_id,
    LEFT(r.query, 100) || CASE WHEN LENGTH(r.query) > 100 THEN '...' ELSE '' END as query,
    r.query_type,
    r.status,
    r.total_duration_ms,
    r.match_count,
    r.grounding_score,
    r.created_at
  FROM rag_logs r
  WHERE (status_filter IS NULL OR r.status = status_filter)
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to get top sources from match data
CREATE OR REPLACE FUNCTION get_top_sources_from_logs(
  limit_count INTEGER DEFAULT 10,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  source TEXT,
  match_count INTEGER,
  avg_similarity FLOAT,
  times_used INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH source_data AS (
    SELECT 
      source_elem->>'source' as source_name,
      (source_elem->>'similarity')::FLOAT as similarity_value
    FROM rag_logs r,
         jsonb_array_elements(
           CASE 
             WHEN jsonb_typeof(r.matches_data->'sources') = 'array' 
             THEN r.matches_data->'sources' 
             ELSE '[]'::jsonb 
           END
         ) as source_elem
    WHERE r.created_at >= NOW() - (days_back * INTERVAL '1 day')
      AND r.matches_data ? 'sources'
      AND source_elem ? 'source'
  )
  SELECT 
    sd.source_name as source,
    COUNT(*)::INTEGER as match_count,
    AVG(sd.similarity_value)::FLOAT as avg_similarity,
    COUNT(*)::INTEGER as times_used
  FROM source_data sd
  WHERE sd.source_name IS NOT NULL
  GROUP BY sd.source_name
  ORDER BY COUNT(*) DESC, AVG(sd.similarity_value) DESC
  LIMIT limit_count;
END;
$$;
