-- Create chat_logs table for storing RAG query logs
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL,
  query TEXT NOT NULL,
  query_type TEXT,
  response TEXT,
  sources JSONB,
  metadata JSONB,
  embedding_duration_ms INTEGER,
  search_duration_ms INTEGER,
  chat_duration_ms INTEGER,
  total_duration_ms INTEGER,
  match_count INTEGER,
  grounding_score INTEGER,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_request_id ON chat_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_status ON chat_logs(status);
CREATE INDEX IF NOT EXISTS idx_chat_logs_query_type ON chat_logs(query_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_logs_updated_at 
    BEFORE UPDATE ON chat_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
