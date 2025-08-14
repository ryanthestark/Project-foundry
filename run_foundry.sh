#!/usr/bin/env bash
set -euxo pipefail

echo "== run_foundry.sh: starting at $(date) =="
echo "PWD: $(pwd)"

# 1. Ensure Python venv exists
if [[ ! -d "venv" ]]; then
  echo "[INFO] Creating Python virtual environment..."
  python3 -m venv venv
fi
echo "[INFO] Activating venv..."
source venv/bin/activate

# 2. Ensure Aider is installed
if ! command -v aider >/dev/null 2>&1; then
  echo "[INFO] Installing aider-chat and dependencies..."
  pip install --upgrade pip
  pip install "aider-chat[playwright]" "python-dotenv"
else
  echo "[INFO] Aider already installed: $(aider --version)"
fi

# 3. Tell git to ignore venv if not already
if ! grep -q "^venv/$" .gitignore; then
  echo "[INFO] Adding venv/ to .gitignore"
  echo "venv/" >> .gitignore
fi

# 4. Remove venv from git index if somehow tracked
if git ls-files --error-unmatch venv >/dev/null 2>&1; then
  echo "[INFO] Removing venv from git index"
  git rm -r --cached venv
fi

# 5. Run Aider with mission goal
aider --yes --map-tokens 16384 <<EOF
You are auditing and fixing a Next.js + Supabase + OpenAI "Foundry" repo so the local runner and RAG chat work end-to-end.

## GOAL
- Fix missing RAG responses: diagnose why /api/chat/rag isn't returning matches or context despite successful ingestion.
- Validate Supabase RPC, vector dimensions, metadata filtering, and frontend display logic.
- Print match count and embedding slice for debug, and repair issues in route.ts or Supabase function as needed.

## ACCEPTANCE TESTS
1. \`npm run ingest\` succeeds without embedding dimension errors.
2. RAG chat responds with context when user queries "Summarize the strategy documents".
3. Runner starts, polls Supabase, and executes jobs without errors.

## REQUIRED FILES
/add tsconfig.json
/add package.json
/add next.config.js
/add .env.local
/add src/runner.ts
/add src/lib/supabaseClient.ts
/add src/lib/supabaseAdmin.ts
/add src/app/api/chat/route.ts
/add src/app/api/chat/rag/route.ts
/add src/app/api/orchestrator/start/route.ts
/add src/app/api/orchestrator/status/[id]/route.ts
/add src/scripts/ingest.ts
/add supabase/functions/match_embeddings.sql
EOF

echo "[SUCCESS] run_foundry.sh completed at $(date)"
