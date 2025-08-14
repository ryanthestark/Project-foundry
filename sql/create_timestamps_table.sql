-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create timestamps table for storing creation timestamps and metadata
CREATE TABLE IF NOT EXISTS timestamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- Type of entity (query, response, match, etc.)
  entity_id TEXT NOT NULL, -- ID of the entity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  source_table TEXT, -- Which table the entity belongs to
  metadata JSONB, -- Additional timestamp metadata
  timezone TEXT DEFAULT 'UTC',
  created_by TEXT, -- User or system that created the entity
  session_id TEXT, -- Session identifier if applicable
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- When this timestamp was indexed
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_timestamps_entity_type ON timestamps(entity_type);
CREATE INDEX IF NOT EXISTS idx_timestamps_entity_id ON timestamps(entity_id);
CREATE INDEX IF NOT EXISTS idx_timestamps_created_at ON timestamps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timestamps_source_table ON timestamps(source_table);
CREATE INDEX IF NOT EXISTS idx_timestamps_indexed_at ON timestamps(indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_timestamps_session_id ON timestamps(session_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_timestamps_type_created ON timestamps(entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timestamps_table_created ON timestamps(source_table, created_at DESC);

-- Function to get timestamp statistics by entity type
CREATE OR REPLACE FUNCTION get_timestamp_stats(
  entity_type_param TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  entity_type TEXT,
  total_count INTEGER,
  earliest_timestamp TIMESTAMP WITH TIME ZONE,
  latest_timestamp TIMESTAMP WITH TIME ZONE,
  avg_per_day FLOAT,
  unique_sessions INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.entity_type,
    COALESCE(COUNT(*), 0)::INTEGER as total_count,
    MIN(t.created_at) as earliest_timestamp,
    MAX(t.created_at) as latest_timestamp,
    COALESCE((COUNT(*)::FLOAT / GREATEST(days_back, 1)), 0.0) as avg_per_day,
    COALESCE(COUNT(DISTINCT t.session_id), 0)::INTEGER as unique_sessions
  FROM timestamps t
  WHERE t.created_at >= NOW() - (days_back * INTERVAL '1 day')
    AND (entity_type_param IS NULL OR t.entity_type = entity_type_param)
  GROUP BY t.entity_type
  ORDER BY total_count DESC;
END;
$$;

-- Function to get creation timeline for analysis
CREATE OR REPLACE FUNCTION get_creation_timeline(
  entity_type_param TEXT DEFAULT NULL,
  hours_back INTEGER DEFAULT 24,
  bucket_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  time_bucket TIMESTAMP WITH TIME ZONE,
  entity_count INTEGER,
  unique_sessions INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', t.created_at) as time_bucket,
    COALESCE(COUNT(*), 0)::INTEGER as entity_count,
    COALESCE(COUNT(DISTINCT t.session_id), 0)::INTEGER as unique_sessions
  FROM timestamps t
  WHERE t.created_at >= NOW() - (hours_back * INTERVAL '1 hour')
    AND (entity_type_param IS NULL OR t.entity_type = entity_type_param)
  GROUP BY date_trunc('hour', t.created_at)
  ORDER BY time_bucket DESC;
END;
$$;

-- Function to get recent activity
CREATE OR REPLACE FUNCTION get_recent_activity(
  limit_count INTEGER DEFAULT 50,
  entity_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  source_table TEXT,
  session_id TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.entity_type,
    t.entity_id,
    t.created_at,
    t.source_table,
    t.session_id,
    t.metadata
  FROM timestamps t
  WHERE (entity_type_filter IS NULL OR t.entity_type = entity_type_filter)
  ORDER BY t.created_at DESC
  LIMIT limit_count;
END;
$$;
