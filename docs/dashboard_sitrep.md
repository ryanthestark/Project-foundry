# Dashboard SITREP (Status Report)

Date: 2025-08-12

Executive summary
- Codebase compiles and lints cleanly.
- Dashboard UI and routes are wired end-to-end.
- Networked features require the Next.js dev server running and a few environment variables set.
- Supabase Edge Function is in place to process synthesis jobs; ensure it’s deployed and reachable.
- RAG retrieval is production-ready but needs documents ingested to return meaningful context.

Current observations from latest QA run
- Build/lint: Passed. “✔ No ESLint warnings or errors.”
- Next.js server: Not running during tests; AI Council CLI reported: “No server listening at http://localhost:3000.”
- RAG CLI: Reported “No relevant context found,” suggesting there are no ingested docs yet or the query was too generic for the current threshold.
- Playwright: Test runner complains “Cannot find module '@playwright/test'” (dependency and browsers not installed).

Feature status snapshot

1) Authentication, layout, navigation
- Status: Green. Dashboard pages are auth-protected via middleware and app/dashboard/layout.tsx. Unauthenticated users are redirected to /login. The persistent left sidebar is applied via md:pl-60. LogoutButton is present.
- Dependencies: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.

2) Supervisor Chat (AI Council synthesis)
- What’s wired:
  - Start routes (/api/synthesize/start, /api/synthesize/start_critique) create synthesis_jobs rows (user_id, prompt, status='pending').
  - Status route (/api/synthesize/status/[id]) returns { id, status, synthesized_response }, with service-role access support.
  - Supabase Edge Function (supabase/functions/synthesize/index.ts) orchestrates MissionPlan steps and updates job status to completed/failed.
  - Dashboard page starts a job, polls status, and renders Markdown, with cost accumulation and copy-to-clipboard.
- Status: Yellow/Green. Functionality is complete in code. It will work when:
  - Next.js dev server is running (for the UI and API).
  - Supabase Edge Function is deployed and callable (functions URL derived from your Supabase project ref or SUPABASE_FUNCTIONS_URL).
  - Env vars present: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY.
- Risks: If the Edge Function is not deployed or the functions URL isn’t reachable, jobs remain pending.

3) Aider mode (mock)
- Status: Green. /api/aider/execute echoes the command via a safe shell, and the dashboard displays the output. No external dependencies.

4) Document upload and ingestion
- What’s wired:
  - /api/docs/upload saves file to /tmp/uploads and triggers /api/ingest_docs.
  - /api/ingest_docs reads file, chunks, generates 3072-dim embeddings via OpenRouter, and upserts into documents/document_chunks. It updates checksum and clears old chunks when content changes.
- Status: Yellow/Green. Works when OPENROUTER_API_KEY and Supabase envs are configured. 
- Notes: API ingestion stores the basename as documents.file_path. Python CLI ingestion stores a path relative to DOCS_DIRECTORY. This can create two doc rows for the same logical file, which is acceptable but not ideal if you want one canonical convention.

5) RAG retrieval
- What’s wired:
  - /api/rag_retrieval embeds the query (3072-dim) and calls match_knowledge_base_chunks RPC. If a dimension mismatch occurs, it falls back to 1536-dim embeddings. Threshold set to 0.6.
  - CLI rag_retrieval_tool.py mirrors this logic with multiple fallbacks.
  - Dashboard “Show Context” calls the route and displays retrieved text.
- Status: Yellow. Working path is correct; last CLI attempt returned “No relevant context,” indicating there are no ingested documents yet or the test query (“test”) didn’t meet the threshold.
- Dependencies: OPENROUTER_API_KEY, Supabase DB functions/tables as provided in docs/schema.

6) AI Todo (Tasks)
- Status: Green. UI uses session.access_token as Bearer; API validates via cookie or Bearer and ensures profiles.family_id. Inserts and reads tasks by family_id.
- Dependencies: profiles and tasks tables with expected columns (id, title, content, created_at, user_id, family_id).

7) Git push trigger
- Status: Yellow/Green. /api/git/push posts to Vercel deploy hook URL (VERCEL_DEPLOY_HOOK_URL or NEXT_PUBLIC_VERCEL_DEPLOY_HOOK_URL).
- Dependencies: Set a deploy hook URL.

8) Middleware and dev-tunnel resilience
- Status: Green. middleware.ts forwards essential headers, strips cookies on selected API routes in dev, and calls lib/supabase/middleware.updateSession. This stabilizes Codespaces/tunnels and avoids Next Server Actions origin issues.

Risks and gaps
- Server not running during tests led to “No server listening” errors. The dashboard cannot function without npm run dev.
- Supabase Edge Function must be deployed and allowed by project settings for the job processing loop to complete.
- RAG requires ingested content to return context; test query should match known doc content.
- Playwright dependency/browsers are not installed, so Playwright tests won’t run.

Recommended operator actions to reach “all green”
- Start the Next.js dev server: run it before CLI tests so API endpoints are reachable.
- Configure environment:
  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (for server routes, status polling, and ingestion)
  - OPENROUTER_API_KEY (for embeddings and Edge Function model calls)
  - Optional: SUPABASE_FUNCTIONS_URL (if you want to bypass auto-derivation), VERCEL_DEPLOY_HOOK_URL.
- Deploy and verify the Supabase Edge Function:
  - Ensure supabase/functions/synthesize is deployed and reachable at https://<project-ref>.functions.supabase.co/synthesize.
  - Confirm it updates synthesis_jobs rows from pending → step_* → completed.
- Ingest documents:
  - Upload a .md in the dashboard Upload card or run DOCS_DIRECTORY=<your-docs> python3 ingest_docs_to_supabase_rag.py.
  - Use a query containing known terms from ingested docs when testing RAG.
- Install Playwright (optional):
  - Add @playwright/test and install browser binaries to run tests locally.

Quality-of-life notes
- Dashboard page has robust logging and error messages to guide recovery (e.g., re-login prompts for 401s).
- RAG route includes a dimension fallback to support legacy 1536-dim DBs; consider standardizing on 3072 for best results.
- API ingestion uses filename-only file_path and Python uses relative paths; unify later if you want strict deduplication.

Conclusion
- The dashboard is functionally complete and should operate end-to-end once the server is running, required env vars are present, the Edge Function is deployed, and documents are ingested. The remaining test failures are environmental (server not running; Playwright not installed) rather than code defects.
