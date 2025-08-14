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
LANGUAGE sql
AS $$
  SELECT
    e.id,
    e.content,
    e.source,
    e.metadata,
    (1 - (e.embedding <=> query_embedding)) as similarity
  FROM embeddings e
  WHERE 
    (1 - (e.embedding <=> query_embedding)) > similarity_threshold
    AND (filter_type IS NULL OR e.metadata->>'type' = filter_type)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
