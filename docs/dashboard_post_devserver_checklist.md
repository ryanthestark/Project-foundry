# Dashboard Operational Status and Next Steps (with dev server running)

Date: 2025-08-12

Summary
- The Next.js dev server is now running; client and API routes are reachable.
- Most dashboard features are wired and ready, but several environment and data prerequisites must be satisfied to see end-to-end outcomes.
- One lint issue remains in the RAG API route (no-explicit-any) that will keep `npm run test:qa` red until addressed.

Current status by feature

1) Authentication, layout, navigation
- Status: Working.
- Notes: Middleware will 500 on missing envs; ensure both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in the environment used by the dev server.

2) Tasks (AI Todo)
- Status: Working end-to-end once authenticated.
- Test: Visit /dashboard/tasks, add a task; should persist and list.

3) AI Council Synthesis (Supervisor Chat)
- Status: Start and status endpoints respond; Edge Function should process jobs to completion.
- Requirements:
  - Supabase Edge Function deployed at https://<project-ref>.functions.supabase.co/synthesize
  - Function envs set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
  - Database table synthesis_jobs with columns at least: id, user_id, prompt (jsonb), status, synthesized_response, session_id (nullable)
  - Storage bucket mission_artifacts exists (Edge Function saves shell command artifacts)
- CLI testing:
  - AI Council Tool requires a bearer; export AI_COUNCIL_BEARER_TOKEN (a user access token) or SUPABASE_SERVICE_ROLE_KEY.
  - With server running and bearer set, the tool should start a job and poll status to "completed" if the function is active.

4) RAG retrieval
- Status: API route reachable; fallback to 1536-dim is implemented; returns empty context until documents are ingested.
- Requirements:
  - OPENROUTER_API_KEY set in server env (for embeddings)
  - RAG schema deployed (documents, document_chunks with vector(3072), RPC match_knowledge_base_chunks)
  - Documents ingested via:
    - CLI: DOCS_DIRECTORY=<path> python3 ingest_docs_to_supabase_rag.py
    - or Dashboard upload card (Upload & Index), which calls /api/ingest_docs
- Lint blocker (for `npm run test:qa`):
  - app/api/rag_retrieval/route.ts uses explicit `any` in 3 places; ESLint @typescript-eslint/no-explicit-any errors remain. Functionality unaffected, but the QA step will fail until types are tightened.

5) Document upload and ingestion
- Status: Working if envs set (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY).
- Behavior:
  - /api/docs/upload saves a file to /tmp/uploads and triggers /api/ingest_docs.
  - /api/ingest_docs chunks, embeds (3072), and upserts rows (documents + document_chunks).
- Note: API ingestion stores filename (basename) in documents.file_path; Python CLI stores a relative path. This can yield two entries for the same logical doc; acceptable but can be standardized later.

6) Git push trigger
- Status: Works when VERCEL_DEPLOY_HOOK_URL or NEXT_PUBLIC_VERCEL_DEPLOY_HOOK_URL is set.

7) Playwright tests
- Status: Not installed; the runner errors out before tests. Only blocks that test stage, not app functionality.

Action plan to get everything fully functional

A) Environment setup (required)
1. Ensure these vars are set in the Next.js dev environment:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - OPENROUTER_API_KEY
   - Optional: SUPABASE_FUNCTIONS_URL (if you prefer an explicit URL), VERCEL_DEPLOY_HOOK_URL
2. Ensure Supabase Storage bucket:
   - Create a bucket named mission_artifacts (public/private as you prefer) so the Edge Function can persist artifacts.

B) Deploy and verify the Supabase Edge Function
1. Deploy supabase/functions/synthesize with env vars SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY.
2. Confirm it’s reachable at:
   - https://<project-ref>.functions.supabase.co/synthesize
3. Validate that inserting a pending synthesis_jobs row triggers state transitions to completed and writes synthesized_response.

C) Ingest documents for RAG
1. Using CLI:
   - Set envs (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY).
   - Run DOCS_DIRECTORY=docs python3 ingest_docs_to_supabase_rag.py
   - Confirm rows in documents and document_chunks.
2. Using dashboard:
   - Upload a .md file in the Upload Knowledge Document card.
   - Confirm ingestion logged and rows created.
3. Test RAG:
   - Use a query containing identifiable terms from your ingested doc.
   - Toggle Show Context on the dashboard or run python3 rag_retrieval_tool.py "<query>".

D) Run Supervisor Chat end-to-end
1. In your shell, export a bearer:
   - export AI_COUNCIL_BEARER_TOKEN="<user access token>"  OR
   - export SUPABASE_SERVICE_ROLE_KEY="<service role key>"
2. From the repo root:
   - python3 ai_council_tool.py
   - Expect: job created → status polled → completed with Markdown response.
3. In the UI (/dashboard):
   - Enter a prompt, include Show Context if needed, hit Send Prompt.
   - Expect: job status updates to completed and renders Markdown.

E) Resolve remaining QA blockers (code quality only; optional for functionality)
- app/api/rag_retrieval/route.ts:
  - Replace explicit `any` usages (‘as any’ casts and `catch (e: any)`) with proper types to satisfy @typescript-eslint/no-explicit-any.
  - Once that is done, `npm run test:qa` will be fully green.

Quick operator checklist

- [ ] Start dev server: npm run dev
- [ ] Set envs in the dev shell: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
- [ ] Deploy and verify Supabase Edge Function synthesize
- [ ] Create Storage bucket: mission_artifacts
- [ ] Ingest docs (CLI or dashboard upload), then verify documents/document_chunks in Supabase
- [ ] Test RAG: send a query that exists in your ingested docs; verify context appears
- [ ] Test Supervisor Chat: start a job (UI and CLI) and confirm completion
- [ ] Optional: Install Playwright to run tests (npm i -D @playwright/test && npx playwright install)
- [ ] Optional: Approve code change to remove `any` types in RAG API for lint clean

If you want, I can proceed to:
- Tighten types in app/api/rag_retrieval/route.ts to clear the lint errors.
- Standardize documents.file_path conventions between API and CLI ingestion (optional).
- Add a smoke-test script or Playwright test that validates RAG and synthesis happy paths (once @playwright/test is installed).
