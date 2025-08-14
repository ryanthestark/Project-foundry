# 🚀 Project Bruno – Production Launch Checklist

**Purpose:** Ensure 95–99% confidence in stability before pushing code to `main`, triggering production deployment on Vercel.

---

## 1. Pre-Flight Checks

- [ ] **Pull latest `main`** to ensure local branch is synced:
  ```bash
  git checkout main
  git pull origin main
  ```

- [ ] **Run QA Tests (types + lint)**:
  ```bash
  npm run test:qa
  ```

- [ ] **No lint errors, warnings, or TypeScript errors**.

- [ ] **Verify .env.production** exists on Vercel with all keys:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENROUTER_API_KEY`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `NEXT_PUBLIC_ADMIN_EMAIL`

---

## 2. Local Functional Testing

Run the app locally:
```bash
npm run dev
```

### Test Primary Flows

#### Authentication
- [ ] Email/password login
- [ ] Google Auth login (redirects properly to `/dashboard`)
- [ ] Logout works and clears session
- [ ] Login persistence after refresh

#### Dashboard (User 0 / Admin View)
- [ ] **Supervisor Chat**
  - [ ] Text prompt → Response
  - [ ] RAG Context retrieval
  - [ ] Image upload works & context is handled
  - [ ] Aider mode accepts plain text
- [ ] **Document Upload** (Markdown ingestion via `/api/docs/upload`)
- [ ] **Tasks**
  - [ ] Add task
  - [ ] Task appears immediately
  - [ ] Page reload persists task
- [ ] **RAG Research mode** returns context

#### Dashboard (User 1 / Non-Admin View)
- [ ] Login redirect works for limited-role account
- [ ] Tasks work
- [ ] No admin-only controls visible

#### AI Council (`/dashboard` & `/supervisor-chat`)
- [ ] Multi-model response
- [ ] Synthesis job starts & completes

#### Journaling
- [ ] POST to `/api/journal` works (Bearer & cookie)
- [ ] GET returns today's entry

---

## 3. UI/UX Verification

Test on:
- [ ] Chrome desktop (responsive shrink)
- [ ] Chrome on iPhone (PWA look & feel)
- [ ] Installable PWA prompt shown
- [ ] Bottom navigation functional
- [ ] Dark theme consistent

---

## 4. Performance / Console

- [ ] No unhandled errors in browser console
- [ ] Network tab: major API calls <2s where possible
- [ ] Lighthouse PWA audit passes >90 in Performance, PWA, Accessibility

---

## 5. Commit & Deployment

- [ ] Commit final QA fixes:
  ```bash
  git add .
  git commit -m "chore: final QA pre-prod launch"
  ```

- [ ] Push to `main`:
  ```bash
  git push origin main
  ```

- [ ] Watch Vercel dashboard for build success (no failed steps)

---

## 6. Post-Deploy Smoke Test

After deployment completes:
- [ ] Visit prod domain in incognito
- [ ] Repeat basic auth + core flow tests
- [ ] Test mobile PWA on-device (including offline install page)
- [ ] Validate envs are correct in prod by inspecting network requests

---

**Prepared By:** Strategic Ops – Launch Readiness  
**Last Updated:** 2025-08-08
