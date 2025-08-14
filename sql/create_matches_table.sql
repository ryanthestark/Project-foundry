-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create matches table for storing search results and analysis
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL, -- Links to chat_logs table
  query_hash TEXT NOT NULL, -- Links to query_embeddings table
  matches_data JSONB NOT NULL, -- All match data stored as JSONB
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_matches_request_id ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_query_hash ON matches(query_hash);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- Create JSONB indexes for efficient queries on match data
CREATE INDEX IF NOT EXISTS idx_matches_data_gin ON matches USING gin(matches_data);
CREATE INDEX IF NOT EXISTS idx_matches_similarity ON matches USING btree(((matches_data->>'avg_similarity')::float) DESC);
CREATE INDEX IF NOT EXISTS idx_matches_count ON matches USING btree(((matches_data->>'match_count')::integer) DESC);

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
    COALESCE((m.matches_data->>'match_count')::INTEGER, 0) as total_matches,
    COALESCE((m.matches_data->>'avg_similarity')::FLOAT, 0.0) as avg_similarity,
    COALESCE((m.matches_data->>'max_similarity')::FLOAT, 0.0) as max_similarity,
    COALESCE((m.matches_data->>'min_similarity')::FLOAT, 0.0) as min_similarity,
    COALESCE(jsonb_array_length(m.matches_data->'sources'), 0) as unique_sources,
    COALESCE((m.matches_data->>'match_count')::INTEGER, 0) as matches_used
  FROM matches m
  WHERE m.request_id = request_id_param
  LIMIT 1;
  
  -- If no rows returned, return a row of zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0.0, 0.0, 0.0, 0, 0;
  END IF;
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
  WITH source_data AS (
    SELECT 
      source_elem->>'source' as source_name,
      (source_elem->>'similarity')::FLOAT as similarity_value
    FROM matches m,
         jsonb_array_elements(
           CASE 
             WHEN jsonb_typeof(m.matches_data->'sources') = 'array' 
             THEN m.matches_data->'sources' 
             ELSE '[]'::jsonb 
           END
         ) as source_elem
    WHERE m.created_at >= NOW() - (days_back * INTERVAL '1 day')
      AND m.matches_data ? 'sources'
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
