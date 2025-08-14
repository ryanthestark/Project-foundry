-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create matches table for storing search results and analysis
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL, -- Links to chat_logs table
  query_hash TEXT NOT NULL, -- Links to query_embeddings table
  embedding_id UUID NOT NULL, -- ID from embeddings table that matched
  source TEXT NOT NULL, -- Source document name
  content TEXT NOT NULL, -- Matched content chunk
  similarity FLOAT NOT NULL, -- Cosine similarity score
  rank_position INTEGER NOT NULL, -- Position in search results (1, 2, 3...)
  metadata JSONB, -- Document metadata (type, etc.)
  content_length INTEGER NOT NULL,
  was_used_in_response BOOLEAN DEFAULT false, -- Whether this match influenced the final response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_matches_request_id ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_query_hash ON matches(query_hash);
CREATE INDEX IF NOT EXISTS idx_matches_embedding_id ON matches(embedding_id);
CREATE INDEX IF NOT EXISTS idx_matches_similarity ON matches(similarity DESC);
CREATE INDEX IF NOT EXISTS idx_matches_rank_position ON matches(rank_position);
CREATE INDEX IF NOT EXISTS idx_matches_source ON matches(source);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_was_used ON matches(was_used_in_response);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_matches_request_similarity ON matches(request_id, similarity DESC);
CREATE INDEX IF NOT EXISTS idx_matches_query_rank ON matches(query_hash, rank_position);

-- Function to get match statistics for a request
CREATE OR REPLACE FUNCTION get_match_stats(request_id_param TEXT)
RETURNS TABLE (
  total_matches INTEGER,
  avg_similarity FLOAT,
  max_similarity FLOAT,
  min_similarity FLOAT,
  unique_sources INTEGER,
  matches_used INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_matches,
    AVG(m.similarity)::FLOAT as avg_similarity,
    MAX(m.similarity)::FLOAT as max_similarity,
    MIN(m.similarity)::FLOAT as min_similarity,
    COUNT(DISTINCT m.source)::INTEGER as unique_sources,
    COUNT(CASE WHEN m.was_used_in_response THEN 1 END)::INTEGER as matches_used
  FROM matches m
  WHERE m.request_id = request_id_param;
END;
$$;

-- Function to get top sources by match frequency
CREATE OR REPLACE FUNCTION get_top_sources(
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
  SELECT 
    m.source,
    COUNT(*)::INTEGER as match_count,
    AVG(m.similarity)::FLOAT as avg_similarity,
    COUNT(CASE WHEN m.was_used_in_response THEN 1 END)::INTEGER as times_used
  FROM matches m
  WHERE m.created_at >= NOW() - INTERVAL '%s days' % days_back
  GROUP BY m.source
  ORDER BY match_count DESC, avg_similarity DESC
  LIMIT limit_count;
END;
$$;
