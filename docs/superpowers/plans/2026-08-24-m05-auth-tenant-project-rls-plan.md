# M05 Auth / Tenant / Project / RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M05 authentication and database-enforced tenant/project isolation slice with accessible login/logout and fresh security evidence.

**Architecture:** Supabase Auth sessions are managed by Next.js Server Actions and the official SSR cookie adapter. PostgreSQL membership rows and operation-specific RLS policies are the authorization source of truth; the project page queries through the signed-in Data API session.

**Tech Stack:** TypeScript, Next.js 16 App Router/Proxy, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.3, PostgreSQL 17, Supabase CLI 2.115.0, pgTAP, Vitest, Playwright, axe-core.

**Spec:** `docs/superpowers/specs/2026-08-24-m05-auth-tenant-project-rls-design.md`

## Global Constraints

- Preserve the full lifecycle scope; implement only M05 behavior in this plan.
- Write and observe a failing behavior test before each production behavior.
- Keep authorization in PostgreSQL RLS; do not use user-editable JWT metadata.
- Give `anon` no tenant/project table privileges and explicitly grant only required Data API privileges.
- Never expose a service-role or OpenAI credential to browser code or logs.
- Use only synthetic `.test` identities and fictional organization/project data.
- Keep login and logout keyboard-operable with labels, visible focus, accessible names, and textual errors.
- Add no banned infrastructure or provider.

---

### Task 1: Schema contract and minimal tables

**Files:**
- Create: `supabase/tests/database/auth_tenant_project_schema_test.sql`
- Create: `supabase/migrations/20260824041339_auth_tenant_project_rls.sql`

**Interfaces:**
- Consumes: Supabase local PostgreSQL 17 and pgTAP runner.
- Produces: `public.membership_role`, `public.tenants`, `public.tenant_memberships`, `public.projects`, and `public.project_memberships` with keys, constraints, indexes, grants, and RLS enabled.

- [x] **Step 1: Write the failing schema test**

Assert the enum labels, four tables, primary/composite foreign keys, RLS flags, role constraints, indexes, and least-privilege grants with pgTAP catalog queries.

- [x] **Step 2: Run the schema test to verify RED**

Run: `pnpm test:rls`

Expected: assertion failures report the absent M05 enum/tables; the runner itself remains valid.

- [x] **Step 3: Create the migration through the CLI and add minimal schema**

Run: `pnpm supabase migration new auth_tenant_project_rls`

Add the enum, four tables, constraints, indexes, explicit revokes/grants, and `ENABLE ROW LEVEL SECURITY`. Do not add access policies yet.

- [x] **Step 4: Reset and verify the schema test is GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Expected: schema and runner smoke tests pass.

### Task 2: Project isolation policies

**Files:**
- Create: `supabase/tests/database/project_isolation_test.sql`
- Modify: `supabase/migrations/20260824041339_auth_tenant_project_rls.sql`

**Interfaces:**
- Consumes: the Task 1 schema and `auth.uid()` request claims.
- Produces: operation-specific select/update policies enforcing the role matrix.

- [ ] **Step 1: Write behavior tests with synthetic tenant, project, user, and membership rows**

Use real `anon` and `authenticated` PostgreSQL roles. Assert assigned-project read succeeds, cross-project read returns zero, assigned editor update succeeds, cross-project update returns zero, anonymous select is denied, and viewer/reviewer writes return zero.

- [ ] **Step 2: Run the isolation test to verify RED**

Run: `pnpm test:rls`

Expected: assigned read/write assertions fail because RLS has no policies.

- [ ] **Step 3: Add minimal select/update policies**

Use `(select auth.uid())` and indexed `EXISTS` membership lookups. Add no insert/delete or membership-management policies.

- [ ] **Step 4: Reset and verify GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Expected: all schema, runner, and project-isolation assertions pass with unauthorized read/write count zero.

- [ ] **Step 5: Run database advisors**

Run: `pnpm supabase db advisors --local --type security --level warn --fail-on error`

Run: `pnpm supabase db advisors --local --type performance --level warn --fail-on error`

Expected: no error-level findings introduced by M05.

### Task 3: Accessible login, protected project list, and logout

**Files:**
- Create: `tests/e2e/support/local-supabase.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/projects/actions.ts`
- Create: `src/app/projects/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, Supabase Auth, and the Task 2 project policies.
- Produces: `/login`, `/projects`, `login(FormData)`, `logout()`, `createServerSupabaseClient()`, and `updateSession(request)`.

- [ ] **Step 1: Write the real browser behavior test**

Create a runtime-only synthetic user and assigned/cross-tenant projects with a service credential held only in test memory. Drive the login form by accessible labels and keyboard, assert only the assigned project appears, then activate logout by keyboard and assert the login heading returns.

- [ ] **Step 2: Run the auth E2E test to verify RED**

Run: `pnpm exec playwright test tests/e2e/auth.spec.ts`

Expected: the test fails because `/login` and its labelled controls do not exist.

- [ ] **Step 3: Add the minimum server client, proxy, actions, and pages**

Use the SSR cookie adapter, `signInWithPassword`, `getClaims`, RLS-backed `.from("projects").select(...)`, and `signOut`. Return one generic Korean authentication error and fixed redirects only.

- [ ] **Step 4: Run targeted unit and E2E tests for GREEN**

Run: `pnpm test -- src/app/page.test.tsx`

Run: `pnpm exec playwright test tests/e2e/auth.spec.ts`

Expected: the home semantic contract and real login/project/logout flow pass.

### Task 4: Accessibility, security, and M05 Gate

**Files:**
- Create: `tests/a11y/auth.spec.ts`
- Modify: `docs/goal/GOAL_STATE.md`
- Modify: `docs/goal/VERIFICATION_LOG.md`
- Modify: `docs/goal/DECISIONS.md`
- Modify: `docs/goal/HUMAN_CHECKPOINTS.md`

**Interfaces:**
- Consumes: all M05 database and UI behavior.
- Produces: fresh M05 verification evidence and the M06 stage gate without starting M06.

- [ ] **Step 1: Write and observe accessibility RED if the new screens violate the contract**

Scan `/login` and the signed-in `/projects` page with the existing WCAG A/AA axe tags, and drive the critical controls using keyboard locators.

- [ ] **Step 2: Apply only fixes required by the failing accessibility behavior**

Keep semantic landmarks, visible focus, labels, accessible names, and text status. Re-run the targeted scan until GREEN.

- [ ] **Step 3: Run the fresh affected verification set**

Run: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:eval`, `pnpm test:rls`, `pnpm test:e2e`, `pnpm test:a11y`, `pnpm audit --audit-level high`, `pnpm build`, and the existing Linux Workers preview HTTP probe.

Expected: zero failures, zero unauthorized cross-project reads/writes, no high dependency vulnerability, and HTTP 200 from the Workers preview.

- [ ] **Step 4: Persist evidence and commit coherent changes**

Record every RED/GREEN and final command with exit code and counts. Set M05 complete and M06 not started, then commit database behavior, Auth UI behavior, and state evidence as small coherent commits.
