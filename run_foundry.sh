#!/usr/bin/env bash
set -euxo pipefail

echo "== run_foundry.sh: starting at $(date) =="
echo "PWD: $(pwd)"

# 0) Basic sanity: ensure we're in repo root (has package.json)
test -f package.json

# 1) Python venv
if [[ ! -d "venv" ]]; then
  echo "[INFO] Creating Python virtual environment..."
  python3 -m venv venv
fi
echo "[INFO] Activating venv..."
source venv/bin/activate

# 2) Ensure Aider present
if ! command -v aider >/dev/null 2>&1; then
  echo "[INFO] Installing aider-chat and deps..."
  pip install --upgrade pip
  pip install "aider-chat[playwright]" "python-dotenv"
else
  echo "[INFO] Aider already installed: $(aider --version)"
fi

# 3) Ensure SQL dir exists
mkdir -p sql

# 4) Write schema files (idempotent)
cat > sql/create_rag_feedback_table.sql <<'SQL'
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
SQL

# 5) Run SQL via psql if SUPABASE_DB_URL is set (otherwise print manual)
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "[INFO] Applying SQL to Supabase..."
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/create_rag_feedback_table.sql
else
  echo "[WARN] SUPABASE_DB_URL not set. Apply SQL manually:"
  echo "psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f sql/create_rag_feedback_table.sql"
fi

# 6) Launch Aider with mission to implement:
#    - Feedback API + UI
#    - Logs list API
#    - /dashboard/logs page
#    - Minimal supabaseAdmin helpers
aider --yes --map-tokens 16384 <<'AIDER'
You are updating the Foundry codebase to add **RAG feedback** and a **Logs viewer**.

## GOAL
1) Backend
   - Create POST /api/rag/feedback to record 👍/👎 and optional comment into public.rag_feedback.
   - Create GET /api/rag/logs to list recent rag_logs with basic filters (q, type, limit, offset).
   - Add supabaseAdmin helpers: insertRagFeedback(), listRagLogs().

2) Frontend
   - In /dashboard/mission-control, add inline 👍 / 👎 buttons under the answer box.
     * Click sends POST to /api/rag/feedback with: { requestId, query, sentiment: 1|-1, comment?, sources? }.
     * Disable button + show toast on success/fail (no blocking on chat).
   - New page /dashboard/logs
     * Table of recent logs (request_id, created_at, left(query,80), match_count), with
       - search box (q),
       - type dropdown (strategy/spec/analysis/…),
       - pagination (limit 25, next/prev).
     * Clicking a row opens a drawer/modal with full JSON of that log (response, matches, timings).

3) Non-goals
   - No auth work; assume builder-only usage.
   - No streaming changes yet.
   - Keep code minimal, production-friendly.

## FILES TO MODIFY/ADD
/add src/lib/supabaseAdmin.ts
/add src/app/api/rag/feedback/route.ts
/add src/app/api/rag/logs/route.ts
/add src/app/dashboard/logs/page.tsx
/add src/components/Logs/LogTable.tsx
/add src/components/Logs/LogDrawer.tsx
/add src/components/ui/toast.tsx
/add src/components/ui/use-toast.ts
/add src/app/dashboard/mission-control/page.tsx

## REQUIREMENTS & DETAILS

### A) supabaseAdmin helpers
- append safe, typed helpers:

```ts
// src/lib/supabaseAdmin.ts (append)
export async function insertRagFeedback(params: {
  requestId: string;
  query: string;
  sentiment: 1 | -1;
  comment?: string;
  sources?: any[];
}) {
  const { requestId, query, sentiment, comment, sources=[] } = params;
  const { data, error } = await supabaseAdmin
    .from('rag_feedback')
    .insert({
      request_id: requestId,
      query,
      sentiment,
      comment: comment ?? null,
      sources
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

// Lightweight list for logs page; supports q, type, limit, offset
export async function listRagLogs(params: {
  q?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const { q, type, limit = 25, offset = 0 } = params;
  let query = supabaseAdmin.from('rag_logs')
    .select('id, created_at, query, matches, response')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q && q.trim()) {
    // simple ilike on query
    query = query.ilike('query', `%${q.trim()}%`);
  }
  if (type && type.trim()) {
    // filter by any match having metadata->>type = type (client also supports filter at source)
    // To keep it simple, filter where response JSON contains the type string or query contains type
    // (since matches is stored JSONB, exact containment can vary by schema; keep practical)
    query = query.or(`query.ilike.%${type.trim()}%,response::text.ilike.%\\"type\\": \\"${type.trim()}\\"%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  // derive match_count
  const rows = (data ?? []).map(r => ({
    ...r,
    match_count: Array.isArray(r.matches) ? r.matches.length : 0
  }));
  return rows;
}
B) POST /api/rag/feedback
Validate sentiment ∈ {1,-1}, requestId non-empty, query non-empty.

Return 200 JSON { ok: true, id }.

ts
Copy
Edit
// src/app/api/rag/feedback/route.ts
import { NextResponse } from 'next/server'
import { insertRagFeedback } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { requestId, query, sentiment, comment, sources } = body ?? {}

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json({ error: 'requestId required' }, { status: 400 })
    }
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }
    if (sentiment !== 1 && sentiment !== -1) {
      return NextResponse.json({ error: 'sentiment must be 1 or -1' }, { status: 400 })
    }

    const row = await insertRagFeedback({ requestId, query, sentiment, comment, sources })
    return NextResponse.json({ ok: true, id: row.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
C) GET /api/rag/logs
Query params: ?q=…&type=…&limit=25&offset=0

ts
Copy
Edit
// src/app/api/rag/logs/route.ts
import { NextResponse } from 'next/server'
import { listRagLogs } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? undefined
    const type = url.searchParams.get('type') ?? undefined
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    const rows = await listRagLogs({ q, type, limit, offset })
    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
D) UI: Toast hook (minimal)
/add src/components/ui/use-toast.ts and src/components/ui/toast.tsx with a minimal headless toast or use any tiny approach (even alert() fallback if you prefer). Keep it simple if shadcn isn’t installed.

E) Update Mission Control (👍/👎)
In src/app/dashboard/mission-control/page.tsx, locate where the RAG response renders.

Under the response box, add two buttons:

👍 calls fetch('/api/rag/feedback', { method:'POST', body: JSON.stringify({ requestId, query, sentiment:1, sources }), headers:{'Content-Type':'application/json'} })

👎 same with sentiment:-1, plus an optional comment textarea that appears on click.

F) Logs Page
src/app/dashboard/logs/page.tsx renders:

Search input, type dropdown, prev/next buttons.

<LogTable rows={rows} onOpen={setActiveRow}/> and a <LogDrawer row={activeRow} onClose={...} />.

src/components/Logs/LogTable.tsx contains a simple table (created_at, request_id if present, left(query,80), match_count).

src/components/Logs/LogDrawer.tsx displays pretty-printed JSON (response, matches, timings if present).

G) Notes
No blocking on feedback; always handle errors with a toast/snackbar and disable buttons after one click.

Keep imports relative to existing project structure and Tailwind classes consistent with the codebase.

Ensure TypeScript passes next dev.

AIDER

echo "[SUCCESS] run_foundry.sh completed at $(date)"

yaml
Copy
Edit

---

## 🧪 “Idiot‑proof” smoke tests

1) **SQL exists**
```bash
psql "$SUPABASE_DB_URL" -c "\d+ public.rag_feedback" || true
Start dev

bash
Copy
Edit
npm run dev
Logs API

bash
Copy
Edit
curl -sS "http://localhost:3000/api/rag/logs?limit=3" | jq
Feedback API (fake data)

bash
Copy
Edit
curl -sS http://localhost:3000/api/rag/feedback \
  -H "Content-Type: application/json" \
  -d '{"requestId":"test_req_123","query":"hello world","sentiment":1,"comment":"great answer","sources":[]}' | jq
UI

Visit http://localhost:3000/dashboard/mission-control, run any query, click 👍/👎.

Visit http://localhost:3000/dashboard/logs, try search and pagination.