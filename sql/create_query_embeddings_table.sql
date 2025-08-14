-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify vector type is available
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension not properly installed';
    END IF;
END $$;

-- Create query_embeddings table for storing and caching query embeddings
CREATE TABLE IF NOT EXISTS query_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of normalized query for deduplication
  embedding vector(512) NOT NULL, -- Must match EMBEDDING_DIMENSIONS
  model_name TEXT NOT NULL, -- e.g., 'text-embedding-3-small'
  embedding_dimensions INTEGER NOT NULL DEFAULT 512,
  query_length INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_query_embeddings_hash ON query_embeddings(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_created_at ON query_embeddings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_last_used ON query_embeddings(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_model ON query_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_usage_count ON query_embeddings(usage_count DESC);

-- Create vector similarity index for finding similar queries (commented out for now)
-- CREATE INDEX IF NOT EXISTS idx_query_embeddings_vector 
-- ON query_embeddings USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);

-- Function to find similar queries
CREATE OR REPLACE FUNCTION find_similar_queries(
  query_embedding vector(512),
  similarity_threshold FLOAT DEFAULT 0.8,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  query_text TEXT,
  similarity FLOAT,
  usage_count INTEGER,
  last_used_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qe.id,
    qe.query_text,
    1 - (qe.embedding <=> query_embedding) AS similarity,
    qe.usage_count,
    qe.last_used_at
  FROM query_embeddings qe
  WHERE 1 - (qe.embedding <=> query_embedding) > similarity_threshold
  ORDER BY qe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION update_query_usage(query_hash_param TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE query_embeddings 
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE query_hash = query_hash_param;
END;
$$;
