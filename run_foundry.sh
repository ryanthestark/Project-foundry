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

# 3. Run Aider with GOAL + file adds
aider --yes --map-tokens 16384 <<EOF
You are auditing and fixing a Next.js + Supabase + OpenAI "Foundry" repo so the local runner and RAG chat work end-to-end.

## SCOPE
- Verify and repair: file structure, imports/aliases, ts-node + ESM config, env loading, Supabase admin client, runner loop, API routes, and scripts.
- Do not introduce frameworks or major refactors; keep minimal, working defaults.
- Make changes directly and show unified diffs in your final report.

## ACCEPTANCE TESTS
1) \`node --loader ts-node/esm src/runner.ts\` starts, polls Supabase without TypeErrors, and idles when no jobs exist.
2) \`npm run dev\` serves \`/dashboard/mission-control\`, RAG chat responds, and launching a mission enqueues a job in \`autonomous_jobs\`.
3) With the runner running, a queued job flips to \`completed\` (or \`failed\`) and status polling in the UI shows the terminal state.

## NON-NEGOTIABLES
- Fix path alias resolution so imports compile in Next.js and runner.
- Runner must work locally without Vercel.

/add tsconfig.json
/add package.json
/add next.config.js
/add .env.local
/add src/runner.ts
/add src/lib/supabaseClient.ts
/add src/lib/supabaseAdmin.ts
/add src/app/api/chat/route.ts
/add src/app/api/orchestrator/start/route.ts
/add src/app/api/orchestrator/status/[id]/route.ts
EOF

echo "[SUCCESS] run_foundry.sh completed at $(date)"
