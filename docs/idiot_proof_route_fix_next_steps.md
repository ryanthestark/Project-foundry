# Idiot‑Proof Steps After Route Fix (Next.js dev server is running)

Goal: Verify Dashboard end‑to‑end now that the route conflict is fixed and the server is up.

Read this top‑to‑bottom and run commands exactly as shown.

1) Confirm you’re hitting localhost, not the Codespaces public URL
- Ensure the CLI and curl use localhost to avoid GitHub login pages:
  - export BRUNO_API_BASE_URL="http://localhost:3000"
- Open in a browser:
  - http://localhost:3000/login
  - Log in with your Supabase user.

2) Ensure server has required envs loaded (in .env.local) and dev server was restarted
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENROUTER_API_KEY
- If you changed .env.local, stop and restart:
  - npm run dev

3) Provide a bearer in your shell (for CLI and curl)
- The tools prefer SUPABASE_SERVICE_ROLE_KEY:
  - export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

4) Quick API sanity check (MUST return JSON, not HTML)
- Run this from your shell:
  - curl -sS -X POST "http://localhost:3000/api/synthesize/start_critique" -H "Content-Type: application/json" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -d '{"code_snippet":"print(123)","critique_prompt":"Review this code"}'
- Expected: JSON like {"success":true,"jobId":"<uuid>"} or an inline “stub” completion message if edge function URL is not configured.
- If you get HTML or a login page: you are not hitting localhost. Recheck BRUNO_API_BASE_URL and the URL you’re cURLing.

5) Run the AI Council CLI end‑to‑end
- From repo root:
  - python3 ai_council_tool.py
- Expected:
  - “Submitting critique job…”
  - Job ID printed
  - Polling → status becomes completed
  - Final Markdown printed (or inline stub response if edge function not configured)

6) Ingest documents (so RAG “Show Context” has content)
- If you haven’t set up a Python venv and requirements:
  - python3 -m venv venv && . venv/bin/activate
  - pip install --upgrade pip
  - pip install langchain langchain_openai openai tiktoken supabase python-dotenv requests
- Ingest your docs (adjust folder as needed):
  - DOCS_DIRECTORY=docs python3 ingest_docs_to_supabase_rag.py
- Verify in Supabase:
  - documents has new rows
  - document_chunks has rows for those documents

7) Test RAG from CLI
- Use a phrase you know exists in your docs:
  - python3 rag_retrieval_tool.py "your known phrase"
- Expected: Context chunks printed. If “No relevant context,” ingest more docs or try a more specific query.

8) Test Dashboard UI flows
- Supervisor Chat:
  - Go to /dashboard
  - Enter a prompt and click “Send Prompt”
  - Watch status change; final Markdown should render
  - Toggle “Show Context” to see retrieved chunks
- Upload Knowledge:
  - In the Upload card, select a .md/.txt/.csv
  - Click “Upload & Index”
  - Expect a success toast and logs showing /api/ingest_docs
- Tasks:
  - Go to /dashboard/tasks
  - Add a task; confirm it appears and persists on refresh

9) Supabase Edge Function (recommended)
- If deployed and configured, jobs will be processed by the function and not rely on inline fallback.
- Ensure function envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY.

10) Troubleshooting quick hits
- 401 Unauthorized on start_critique:
  - Ensure SUPABASE_SERVICE_ROLE_KEY is exported in your shell
  - Ensure .env.local has Supabase/Router vars, then restart npm run dev
  - Use localhost, not app.github.dev
- HTML page in responses:
  - You’re hitting the public Codespaces URL; switch to http://localhost:3000
- “No relevant context” in RAG:
  - Ingest docs first and query for known text
- Route conflicts:
  - Ensure only one dynamic route exists at /api/synthesize/status/[id]
  - Remove any duplicate [jobId] versions

You’re done when:
- CLI and UI can start a job and poll to completion
- RAG shows context from your ingested docs
- Tasks can be created and listed without errors
