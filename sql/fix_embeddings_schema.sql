-- Fix embeddings table and match_embeddings function for 1536-dimensional vectors

-- 1. Update the embeddings table to use vector(1536)
ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(1536);

-- 2. Drop and recreate the match_embeddings function with correct vector type
DROP FUNCTION IF EXISTS match_embeddings(vector(512), int, float, text);

-- 3. Create the updated match_embeddings function
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  source text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content,
    e.source,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE 
    (filter_type IS NULL OR e.metadata->>'type' = filter_type)
    AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Create an index on the embedding column for better performance
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
