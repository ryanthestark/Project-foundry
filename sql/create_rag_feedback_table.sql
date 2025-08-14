-- Creates feedback + improves rag_logs discoverability. Safe to re-run.

-- Feedback table: simple 1-5 sentiment (store 👍=1, 👎=-1), comment optional.
create table if not exists public.rag_feedback (
  id bigserial primary key,
  request_id text not null,
  query text not null,
  sentiment smallint not null,       -- 1 (up) or -1 (down)
  comment text,
  sources jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Foreign-key soft link (not enforced) to rag_logs by request_id, keep loose coupling.

-- Helpful indexes
create index if not exists rag_feedback_request_id_idx on public.rag_feedback (request_id);
create index if not exists rag_feedback_created_at_idx on public.rag_feedback (created_at desc);

-- Make rag_logs easier to query if not already done (no-op if exists).
do $$
begin
  if not exists (
    select 1
    from   pg_indexes
    where  schemaname='public' and indexname='rag_logs_created_at_idx'
  ) then
    execute 'create index rag_logs_created_at_idx on public.rag_logs (created_at desc);';
  end if;
end$$;
