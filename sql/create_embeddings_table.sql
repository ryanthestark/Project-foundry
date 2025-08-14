-- Create embeddings table for RAG pipeline
CREATE TABLE IF NOT EXISTS embeddings (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  source text NOT NULL,
  embedding vector(512) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for metadata filtering
CREATE INDEX IF NOT EXISTS embeddings_metadata_type_idx ON embeddings 
USING gin ((metadata->>'type'));

-- Create index for source lookups
CREATE INDEX IF NOT EXISTS embeddings_source_idx ON embeddings (source);
