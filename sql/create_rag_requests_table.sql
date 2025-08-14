-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create rag_requests table for comprehensive RAG request logging
CREATE TABLE IF NOT EXISTS rag_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  query_type TEXT,
  query_hash TEXT NOT NULL,
  embedding_model TEXT,
  embedding_dimensions INTEGER,
  embedding_cached BOOLEAN DEFAULT false,
  match_count INTEGER DEFAULT 0,
  response_model TEXT,
  response_length INTEGER,
  grounding_score INTEGER,
  embedding_duration_ms INTEGER,
  search_duration_ms INTEGER,
  chat_duration_ms INTEGER,
  total_duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rag_requests_request_id ON rag_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_rag_requests_query_hash ON rag_requests(query_hash);
CREATE INDEX IF NOT EXISTS idx_rag_requests_status ON rag_requests(status);
CREATE INDEX IF NOT EXISTS idx_rag_requests_created_at ON rag_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_requests_query_type ON rag_requests(query_type);
CREATE INDEX IF NOT EXISTS idx_rag_requests_total_duration ON rag_requests(total_duration_ms);
CREATE INDEX IF NOT EXISTS idx_rag_requests_grounding_score ON rag_requests(grounding_score DESC);

-- Create composite indexes for analytics
CREATE INDEX IF NOT EXISTS idx_rag_requests_status_created ON rag_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_requests_type_performance ON rag_requests(query_type, total_duration_ms);

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
  avg_chat_duration FLOAT,
  avg_grounding_score FLOAT,
  avg_match_count FLOAT,
  cached_embedding_rate FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_requests,
    COUNT(CASE WHEN r.status = 'success' THEN 1 END)::INTEGER as successful_requests,
    COUNT(CASE WHEN r.status = 'error' THEN 1 END)::INTEGER as error_requests,
    COUNT(CASE WHEN r.status = 'partial' THEN 1 END)::INTEGER as partial_requests,
    AVG(r.total_duration_ms)::FLOAT as avg_total_duration,
    AVG(r.embedding_duration_ms)::FLOAT as avg_embedding_duration,
    AVG(r.search_duration_ms)::FLOAT as avg_search_duration,
    AVG(r.chat_duration_ms)::FLOAT as avg_chat_duration,
    AVG(r.grounding_score)::FLOAT as avg_grounding_score,
    AVG(r.match_count)::FLOAT as avg_match_count,
    (COUNT(CASE WHEN r.embedding_cached THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1) * 100) as cached_embedding_rate
  FROM rag_requests r
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
  FROM rag_requests r
  WHERE (status_filter IS NULL OR r.status = status_filter)
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;
