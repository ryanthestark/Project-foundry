-- Create the match_embeddings function for RAG similarity search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(512),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.3,
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
    (1 - (e.embedding <=> query_embedding::vector)) as similarity
  FROM embeddings e
  WHERE 
    (1 - (e.embedding <=> query_embedding::vector)) > similarity_threshold
    AND (filter_type IS NULL OR e.metadata->>'type' = filter_type)
  ORDER BY e.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
