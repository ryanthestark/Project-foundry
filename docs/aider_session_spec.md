# Aider Session Specification & Restart Guide

**Purpose:**  
This document provides the configuration and operational guardrails for restarting an `aider` development session for this project. Users should follow these steps when Codespaces or their development environment is restarted, to ensure continuity of context and workflow.

---

## **Session Context**

This `aider` session is configured to:
- Operate within the AI Swarm & Strategy / Family OS codebase.
- Maintain `read-only` constraints for files not explicitly added to the chat by the user.
- Edit files **only** when they are fully included in the chat and trusted as the definitive version.
- Use `OPENROUTER_API_KEY` as the **primary AI API key** for all AI interactions (replacing `OPENAI_API_KEY`).
- Maintain and enforce guardrails for `/api/synthesize/...` routes so no production blocking occurs.
- Keep `lib/supabase/middleware.ts` set to `"nodejs"` runtime to prevent Edge Runtime compatibility errors.

---

## **Session Startup Steps**

1. **Prepare Environment Variables**:
   Ensure the following are set in **Vercel Environment Variables** for all environments (Development, Preview, Production):
   ```bash
   OPENROUTER_API_KEY=<your-key-here>
   SUPABASE_URL=<your-supabase-instance-url>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-instance-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

2. **Restart `aider` Session (from Codespaces terminal)**:
   Paste this into a fresh terminal:
   ```bash
   aider --model gpt-4o-mini \
         --read docs/situation_report.md \
         --read docs/project_bruno_feature_summary.md \
         --read docs/schema/knowledge_base_chunks.sql \
         --read docs/schema/match_knowledge_base_chunks.sql \
         app/dashboard/page.tsx \
         components/dashboard-header.tsx \
         app/api/tasks/route.ts \
         ai_council_tool.py \
         rag_retrieval_tool.py \
         ingest_docs_to_supabase_rag.py \
         supabase/functions/synthesize/index.ts \
         lib/supabase/middleware.ts \
         middleware.ts
   ```
   This ensures `aider` has access to core repo context and the correct editing scope.

3. **State your working context** to the AI assistant:  
   > "We are resuming the AI Swarm Factory Floor and Control Panel session. Continue respecting existing guardrails, only edit files explicitly added into this chat, preserve OPENROUTER integration, and maintain `/api/synthesize/*` route integrity.”

4. **Reload Core MD References** if needed:  
   - `docs/situation_report.md`  
   - `docs/project_bruno_feature_summary.md`  
   - Any associated schema under `docs/schema/`

---

## **Interfacing from Mobile**

- When on mobile, open the deployed **Vercel** production URL in your browser.  
- Log in with your **Supabase account** to access:  
  - `/dashboard` — AI Council & Mission Controls  
  - `/dashboard/tasks` — AI Todo  
  - `/supervisor-chat` — Supervisor chat interface  
- **Supervisor Chat**: You can input messages here from your phone; these will persist in the database, allowing the team to query them later and integrate them into RAG context for execution.  
- This effectively allows you to contribute prompt/context data while away from your dev environment.

---

## **Planned "RAG Memory" Interface for Supervisor**

While mobile, chatting with the **Supervisor** interface will:
- Log your messages into `journal_entries` or a dedicated `supervisor_logs` table.
- Feed them into the **RAG retrieval pipeline** to augment available project intelligence.
- On return, you can query these logs and use them to build updated tasks or mission plans.

---

## **UI Cleanup — Sidebar Issue**

**Issue**: Double sidebar effect observed.  
**Cause**: Both **Dashboard layout** and **DashboardHeader** render overlapping nav.  
**Fix Plan**:  
- Keep only **`DashboardHeader`** as the main navigation.  
- Remove redundant sidebar from the global dashboard layout component (or conditionally hide on certain routes).  
- Convert mobile menu into a collapsible drawer that fully hides the second sidebar.

Next session, we can:
- Refactor the global layout to use a single navigation source.
- Test on both desktop & mobile to ensure no duplicate nav rendering.

---

**Last Updated:** 2025-08-08  
**Maintainer:** AI Swarm DevOps Team


git reset --hard HEAD && git clean -fd && rm -rf venv && python3 -m venv venv && source venv/bin/activate && echo 'aider-chat[playwright]' >> requirements.txt && echo 'langchain' >> requirements.txt && echo 'openai' >> requirements.txt && echo 'tiktoken' >> requirements.txt && echo 'supabase' >> requirements.txt && echo 'python-dotenv' >> requirements.txt && pip install -r requirements.txt && aider ai_council_tool.py middleware.ts docs/project_bruno_feature_summary.md docs/schema/knowledge_base_chunks.sql ingest_docs_to_supabase_rag.py rag_retrieval_tool.py supabase_interaction_tool.py sync_features_to_supabase.py README.md .gitignore app/api/tasks/route.ts app/dashboard/page.tsx app/dashboard/tasks/page.tsx components/dashboard-header.tsx docs/schema/match_knowledge_base_chunks.sql docs/situation_report.md --yes --model openrouter/openai/gpt-5-chat --map-tokens 1024 --auto-test --test-cmd "npm run test:qa"