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
DECLARE
  match_record RECORD;
BEGIN
  -- Get the first match record for this request
  SELECT * INTO match_record FROM matches WHERE request_id = request_id_param LIMIT 1;
  
  -- If no record found, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0.0, 0.0, 0.0, 0, 0;
    RETURN;
  END IF;

  -- Return the statistics from the JSONB data
  RETURN QUERY
  SELECT 
    COALESCE((match_record.matches_data->>'match_count')::INTEGER, 0) as total_matches,
    COALESCE((match_record.matches_data->>'avg_similarity')::FLOAT, 0.0) as avg_similarity,
    COALESCE((match_record.matches_data->>'max_similarity')::FLOAT, 0.0) as max_similarity,
    COALESCE((match_record.matches_data->>'min_similarity')::FLOAT, 0.0) as min_similarity,
    COALESCE(jsonb_array_length(match_record.matches_data->'sources'), 0) as unique_sources,
    COALESCE((match_record.matches_data->>'match_count')::INTEGER, 0) as matches_used;
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
    source_name,
    source_count::INTEGER as match_count,
    source_avg_sim::FLOAT as avg_similarity,
    source_count::INTEGER as times_used
  FROM (
    SELECT 
      source_elem->>'source' as source_name,
      COUNT(*) as source_count,
      AVG((source_elem->>'similarity')::FLOAT) as source_avg_sim
    FROM matches m
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN jsonb_typeof(m.matches_data->'sources') = 'array' 
        THEN m.matches_data->'sources' 
        ELSE '[]'::jsonb 
      END
    ) as source_elem
    WHERE m.created_at >= NOW() - (days_back * INTERVAL '1 day')
      AND m.matches_data ? 'sources'
    GROUP BY source_elem->>'source'
  ) source_stats
  ORDER BY source_count DESC, source_avg_sim DESC
  LIMIT limit_count;
END;
$$;
