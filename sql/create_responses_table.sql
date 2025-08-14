-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create responses table for storing generated responses and analysis
CREATE TABLE IF NOT EXISTS responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL, -- Links to chat_logs table
  query_hash TEXT NOT NULL, -- Links to query_embeddings table
  response_text TEXT NOT NULL, -- The generated response
  response_length INTEGER NOT NULL,
  model_name TEXT NOT NULL, -- e.g., 'gpt-4o-mini'
  temperature FLOAT,
  max_tokens INTEGER,
  grounding_score INTEGER, -- Score from grounding validation
  has_source_references BOOLEAN DEFAULT false,
  has_direct_quotes BOOLEAN DEFAULT false,
  acknowledges_limitations BOOLEAN DEFAULT false,
  avoids_ungrounded_claims BOOLEAN DEFAULT false,
  response_quality_score FLOAT, -- Overall quality assessment
  sentiment_score FLOAT, -- Positive/negative sentiment
  readability_score FLOAT, -- Text readability assessment
  word_count INTEGER,
  sentence_count INTEGER,
  avg_sentence_length FLOAT,
  sources_cited INTEGER, -- Number of sources referenced
  direct_quotes_count INTEGER, -- Number of direct quotes used
  metadata JSONB, -- Additional response metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_responses_request_id ON responses(request_id);
CREATE INDEX IF NOT EXISTS idx_responses_query_hash ON responses(query_hash);
CREATE INDEX IF NOT EXISTS idx_responses_model_name ON responses(model_name);
CREATE INDEX IF NOT EXISTS idx_responses_grounding_score ON responses(grounding_score DESC);
CREATE INDEX IF NOT EXISTS idx_responses_quality_score ON responses(response_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_responses_response_length ON responses(response_length);
CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_word_count ON responses(word_count);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_responses_model_quality ON responses(model_name, response_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_responses_grounding_quality ON responses(grounding_score DESC, response_quality_score DESC);

-- Function to calculate response quality metrics
CREATE OR REPLACE FUNCTION calculate_response_metrics(response_text_param TEXT)
RETURNS TABLE (
  word_count INTEGER,
  sentence_count INTEGER,
  avg_sentence_length FLOAT,
  readability_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  words INTEGER;
  sentences INTEGER;
  avg_length FLOAT;
  readability FLOAT;
BEGIN
  -- Count words (simple split on whitespace, filter out empty strings)
  words := COALESCE(array_length(array_remove(string_to_array(trim(response_text_param), ' '), ''), 1), 0);
  
  -- Count sentences (simple count of sentence endings)
  sentences := (length(response_text_param) - length(replace(replace(replace(response_text_param, '.', ''), '!', ''), '?', '')));
  
  -- Avoid division by zero
  IF sentences = 0 THEN
    sentences := 1;
  END IF;
  
  -- Calculate average sentence length
  avg_length := words::FLOAT / sentences::FLOAT;
  
  -- Simple readability score (inverse of average sentence length, normalized)
  readability := GREATEST(0.0, LEAST(100.0, 100.0 - (avg_length - 10.0) * 2.0));
  
  RETURN QUERY SELECT words, sentences, avg_length, readability;
END;
$$;

-- Function to get response quality statistics
CREATE OR REPLACE FUNCTION get_response_quality_stats(
  days_back INTEGER DEFAULT 30,
  model_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_responses INTEGER,
  avg_grounding_score FLOAT,
  avg_quality_score FLOAT,
  avg_response_length FLOAT,
  avg_word_count FLOAT,
  responses_with_sources INTEGER,
  responses_with_quotes INTEGER,
  responses_acknowledging_limits INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_responses,
    AVG(r.grounding_score)::FLOAT as avg_grounding_score,
    AVG(r.response_quality_score)::FLOAT as avg_quality_score,
    AVG(r.response_length)::FLOAT as avg_response_length,
    AVG(r.word_count)::FLOAT as avg_word_count,
    COUNT(CASE WHEN r.has_source_references THEN 1 END)::INTEGER as responses_with_sources,
    COUNT(CASE WHEN r.has_direct_quotes THEN 1 END)::INTEGER as responses_with_quotes,
    COUNT(CASE WHEN r.acknowledges_limitations THEN 1 END)::INTEGER as responses_acknowledging_limits
  FROM responses r
  WHERE r.created_at >= NOW() - (days_back * INTERVAL '1 day')
    AND (model_filter IS NULL OR r.model_name = model_filter);
END;
$$;

-- Function to get top performing responses
CREATE OR REPLACE FUNCTION get_top_responses(
  limit_count INTEGER DEFAULT 10,
  min_grounding_score INTEGER DEFAULT 70
)
RETURNS TABLE (
  id UUID,
  request_id TEXT,
  response_text TEXT,
  grounding_score INTEGER,
  response_quality_score FLOAT,
  word_count INTEGER,
  sources_cited INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.request_id,
    LEFT(r.response_text, 200) || '...' as response_text,
    r.grounding_score,
    r.response_quality_score,
    r.word_count,
    r.sources_cited,
    r.created_at
  FROM responses r
  WHERE r.grounding_score >= min_grounding_score
  ORDER BY r.response_quality_score DESC, r.grounding_score DESC
  LIMIT limit_count;
END;
$$;
