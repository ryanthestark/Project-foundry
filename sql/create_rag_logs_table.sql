-- sql/create_rag_logs_table.sql
-- Safe to run multiple times.

-- 1) Ensure pgvector is available
create extension if not exists vector;

-- 2) Main logs table
create table if not exists public.rag_logs (
  id               bigserial primary key,
  query            text not null,
  query_embedding  vector(512) not null,
  matches          jsonb not null,
  response         jsonb not null,
  created_at       timestamptz not null default now()
);

-- 3) Indexes for performance & analytics
create index if not exists rag_logs_created_at_idx
  on public.rag_logs (created_at);

-- Optional ANN index so you can do “similar queries” on logged query vectors later
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'rag_logs_query_embedding_ivfflat_idx'
  ) then
    execute 'create index rag_logs_query_embedding_ivfflat_idx
             on public.rag_logs using ivfflat (query_embedding vector_l2_ops)
             with (lists = 100);';
  end if;
end$$;

-- JSONB indexes for ad‑hoc filtering/searching in logs
create index if not exists rag_logs_matches_gin_idx
  on public.rag_logs using gin (matches);

create index if not exists rag_logs_response_gin_idx
  on public.rag_logs using gin (response);

-- 4) RLS (service role bypasses; enable read for authenticated for dashboards)
alter table public.rag_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'rag_logs' and policyname = 'rag_logs_read_auth'
  ) then
    create policy rag_logs_read_auth
      on public.rag_logs for select
      to authenticated
      using (true);
  end if;
end$$;

-- 5) (Optional but recommended) Support fast type filtering on your embeddings table
--    NOTE: This assumes your embeddings live in public.embeddings with metadata JSONB.
create index if not exists idx_embeddings_metadata_type
  on public.embeddings using gin ((metadata->>'type'));

-- (Optional) Ensure your embeddings ANN index matches cosine ops (good for semantic similarity)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'embeddings_embedding_ivfflat_cos_idx'
  ) then
    execute 'create index embeddings_embedding_ivfflat_cos_idx
             on public.embeddings using ivfflat (embedding vector_cosine_ops)
             with (lists = 100);';
  end if;
end$$;
