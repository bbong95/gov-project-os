# M06 Private RFP Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the M06 private RFP original flow with immutable SHA-256 metadata, project-scoped Supabase Storage RLS, authorized retrieval, privacy classification, audit evidence, and an accessible upload UI.

**Architecture:** A Next.js route handler receives a small RFP original and uses the signed-in user's Supabase SSR session through a `StorageProvider`. PostgreSQL document policies and `storage.objects` policies enforce project isolation; the browser receives no privileged key or permanent object URL.

**Tech Stack:** TypeScript, Next.js 16 App Router, OpenNext Cloudflare, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.3, PostgreSQL 17, Supabase Storage/CLI 2.115.0, pgTAP, Vitest, Playwright, axe-core.

**Spec:** `docs/superpowers/specs/2026-08-24-m06-private-rfp-upload-design.md`

## Global Constraints

- Preserve the complete GOV Project OS lifecycle; implement M06 only and stop at the M07 gate.
- Write and observe a failing behavior test before each production behavior.
- Keep original bytes immutable and separate from later parsing or AI interpretation.
- Require `project_id`, server-computed SHA-256, and explicit privacy classification.
- Use the authenticated user's session and database/Storage RLS; add no service-role application endpoint.
- Never expose an OpenAI or service-role key to browser code, responses, or logs.
- Treat file bytes, filename, extension, and media type as untrusted; do not render, execute, parse, or send them to AI.
- Use only runtime-generated synthetic documents and `.test` identities.
- Keep the critical flow keyboard operable with labels, focus, and textual status/error output.
- Add no banned infrastructure or additional provider.

---

### Task 1: Document metadata schema, private bucket, and immutable audit contract

**Files:**
- Create: `supabase/tests/database/rfp_document_schema_test.sql`
- Create via CLI: `supabase/migrations/*_private_rfp_upload.sql`

**Interfaces:**
- Consumes: M05 tenant/project/Auth schema and the local Supabase Storage schema.
- Produces: `public.privacy_classification`, `public.documents`, `public.audit_events`, the `rfp-originals` private bucket, constraints, indexes, explicit grants, and RLS-enabled tables.

- [x] **Step 1: Write the failing schema contract**

Assert the enum values, both tables, required `project_id`/SHA/classification columns, path/size/hash constraints, composite project foreign key, immutable privilege set, RLS flags, indexes, audit trigger/function contract, and a private 6 MiB bucket.

- [x] **Step 2: Run the database suite and capture RED**

Run: `pnpm test:rls`

Expected: only the new M06 schema assertions fail because its enum, tables, trigger, and bucket are absent; the existing 43 M05 checks stay green.

- [x] **Step 3: Check the CLI contract and create the migration through Supabase CLI**

Run: `pnpm supabase migration new --help`

Run: `pnpm supabase migration new private_rfp_upload`

Add the enum, tables, constraints, indexes, explicit revokes/grants, private bucket row, restricted audit trigger function, and RLS enablement. Do not add document or Storage access policies yet.

- [x] **Step 4: Reset and verify the schema contract is GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Expected: M05 plus M06 schema/smoke checks pass.

- [x] **Step 5: Commit the schema boundary**

Commit: `feat: add private rfp document schema`

### Task 2: Document RLS, immutability, and audit behavior

**Files:**
- Create: `supabase/tests/database/rfp_document_isolation_test.sql`
- Modify: `supabase/migrations/*_private_rfp_upload.sql`

**Interfaces:**
- Consumes: Task 1 tables and M05 membership roles.
- Produces: project/tenant-admin document read policy, writer-only insert policy, immutable authenticated metadata, and transactionally derived upload audit events.

- [x] **Step 1: Write synthetic real-role behavior tests**

Assert assigned editor insert/read, cross-project read count zero, cross-project insert rejection, viewer/reviewer insert rejection, tenant-admin same-tenant insert, anonymous denial, missing `project_id`, missing/invalid SHA-256, update/delete denial, and exactly one derived `RFP_ORIGINAL_UPLOADED` audit event.

- [x] **Step 2: Run the database suite and capture RED**

Run: `pnpm test:rls`

Expected: allowed document access and audit assertions fail because no document policies/trigger behavior are active for authenticated callers; denial assertions remain secure.

- [x] **Step 3: Add minimum document policies and audit trigger behavior**

Use indexed `(select auth.uid())` membership checks. Grant authenticated `SELECT, INSERT` only. Add no authenticated update/delete or audit mutation policy.

- [x] **Step 4: Reset and verify document behavior is GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Expected: every metadata, isolation, immutability, and audit assertion passes with unauthorized counts at zero.

- [x] **Step 5: Commit the document authorization behavior**

Commit: `feat: enforce immutable rfp document rls`

### Task 3: Real Supabase Storage RLS and overwrite denial

**Files:**
- Modify: `tests/e2e/support/local-supabase.ts`
- Create: `tests/e2e/rfp-storage.spec.ts`
- Modify: `supabase/migrations/*_private_rfp_upload.sql`

**Interfaces:**
- Consumes: the private bucket, document policies, publishable client, and runtime-only synthetic users.
- Produces: writer upload, member authenticated download, cross-project/anonymous denial, no list access, no overwrite, and orphan-only compensation delete.

- [x] **Step 1: Extend the runtime-only synthetic fixture without exposing secrets**

Create assigned and cross-tenant users/projects, expose only synthetic IDs/names/credentials and helper functions that return signed-in publishable clients. Keep the service credential closed inside the support module and clean Storage objects, audit rows, documents, tenants, and Auth users on disposal.

- [x] **Step 2: Write the failing real Storage behavior test**

Upload synthetic bytes as the assigned editor, register metadata, verify assigned download bytes, then assert anonymous and cross-project clients cannot read or list. Attempt both duplicate `upsert: false` and replacement `upsert: true`, assert both fail, and verify bytes/SHA remain unchanged. Exercise orphan compensation without deleting a registered original.

- [x] **Step 3: Run the targeted Storage test and capture RED**

Run: `pnpm exec playwright test tests/e2e/rfp-storage.spec.ts`

Expected: the assigned upload fails because `storage.objects` has no M06 insert policy.

- [x] **Step 4: Add operation-specific Storage policies**

Add writer-only `INSERT`, matching-document authenticated-get `SELECT`, and owner-only/no-document `DELETE`. Add no `UPDATE` policy and no public/anonymous policy. Restrict object path shape to `<project_id>/<document_id>/original`.

- [x] **Step 5: Reset and verify real Storage behavior is GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm exec playwright test tests/e2e/rfp-storage.spec.ts`

Run: `pnpm test:rls`

Expected: Storage behavior and all database tests pass; cross-project/anonymous reads and replacement attempts remain denied.

- [x] **Step 6: Run database advisors and commit**

Run: `pnpm supabase db advisors --local --type security --level warn --fail-on error`

Run: `pnpm supabase db advisors --local --type performance --level warn --fail-on error`

Commit: `feat: enforce private rfp storage isolation`

### Task 4: Server validation, SHA-256, and StorageProvider

**Files:**
- Create: `src/lib/documents/rfp-original.test.ts`
- Create: `src/lib/documents/rfp-original.ts`
- Create: `src/lib/storage/storage-provider.ts`
- Create: `src/lib/storage/supabase-private-storage.ts`

**Interfaces:**
- Consumes: Web `File`/`ArrayBuffer`, Web Crypto, and an authenticated Supabase client.
- Produces: `validateRfpOriginal(file, classification)`, `sha256Hex(bytes)`, safe download disposition, `StorageProvider`, and `SupabasePrivateStorageProvider` with upload/download/orphan-remove operations.

- [x] **Step 1: Write failing unit behavior tests**

Assert allowed extensions, empty/over-6-MiB rejection, required known classification, stable SHA-256 hex for synthetic bytes, CR/LF-safe download naming, and provider upload with `upsert: false`.

- [x] **Step 2: Run targeted Vitest and capture RED**

Run: `pnpm test -- src/lib/documents/rfp-original.test.ts`

Expected: module-not-found or missing-export failure for the unimplemented server helpers.

- [x] **Step 3: Implement the minimum Web-runtime-compatible helpers and provider**

Use `crypto.subtle.digest`, generated object paths, `server-only`, and the Supabase user's client. Return structured fixed errors; do not log raw file or provider details.

- [x] **Step 4: Re-run targeted Vitest for GREEN and commit**

Run: `pnpm test -- src/lib/documents/rfp-original.test.ts`

Commit: `feat: add rfp original storage provider`

### Task 5: Accessible project upload, list, and authorized download

**Files:**
- Create: `tests/e2e/rfp-upload.spec.ts`
- Create: `src/app/projects/[projectId]/rfp/upload/route.ts`
- Create: `src/app/projects/[projectId]/rfp/page.tsx`
- Create: `src/app/projects/[projectId]/documents/[documentId]/download/route.ts`
- Modify: `src/app/projects/page.tsx`

**Interfaces:**
- Consumes: Task 4 helpers/provider and Task 3 RLS.
- Produces: project RFP workflow link, upload POST, fixed textual result codes, RLS-backed document list, and private no-store download response.

- [x] **Step 1: Write the real browser behavior test**

Sign in as the synthetic editor, follow the project RFP link, select a synthetic file, select `INTERNAL`, submit by keyboard, assert textual success and exact displayed server SHA-256, download identical bytes, and assert a cross-project user receives 404 while an anonymous request is redirected to login. Also assert a viewer sees documents but no upload form.

- [x] **Step 2: Run the targeted browser test and capture RED**

Run: `pnpm exec playwright test tests/e2e/rfp-upload.spec.ts`

Expected: the project has no RFP workflow link or upload screen.

- [x] **Step 3: Implement the minimum routes and semantic UI**

Re-verify Auth inside both route handlers. Use fixed redirects/errors, server SHA-256, generated object paths, authenticated StorageProvider calls, metadata insert, orphan compensation, RLS-backed listing, sanitized content disposition, and `Cache-Control: private, no-store`. Do not parse or preview the document.

- [x] **Step 4: Re-run browser behavior for GREEN and commit**

Run: `pnpm exec playwright test tests/e2e/rfp-upload.spec.ts`

Commit: `feat: add accessible private rfp upload`

### Task 6: Accessibility, security, verification, and M06 gate

**Files:**
- Create: `tests/a11y/rfp-upload.spec.ts`
- Modify: `docs/goal/GOAL_STATE.md`
- Modify: `docs/goal/VERIFICATION_LOG.md`
- Modify: `docs/goal/DECISIONS.md`
- Modify: `docs/goal/HUMAN_CHECKPOINTS.md`

**Interfaces:**
- Consumes: all M06 database, Storage, server, and browser behavior.
- Produces: fresh M06 evidence and the M07 stage gate without beginning parsing.

- [x] **Step 1: Write and run the targeted accessibility behavior**

Scan the upload/list screen with the existing WCAG A/AA tags and drive file, classification, submit, and download controls by accessible name and keyboard.

Run: `pnpm exec playwright test tests/a11y/rfp-upload.spec.ts`

Expected: RED only if the new flow has a detectable accessibility defect; apply only the required semantic/focus/status fix and rerun to GREEN.

- [x] **Step 2: Run the fresh affected verification set**

Run: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:eval`, `pnpm supabase db reset --local --no-seed`, `pnpm test:rls`, both database advisors, `pnpm test:e2e`, `pnpm test:a11y`, `pnpm audit --audit-level high`, `pnpm build`, secret/fixture scans, and the disposable Linux OpenNext build/Workers HTTP probe.

Expected: zero test failures, zero unauthorized reads/writes, original bytes unchanged after overwrite attempts, no high dependency vulnerability, no browser privileged secret, no real customer fixture, and Workers HTTP 200.

- [x] **Step 3: Self-review the M06 diff**

Inspect the complete diff for authorization gaps, path/header injection, mutation privileges, secret exposure, original/interpretation mixing, accessibility regressions, accidental M07 parsing, and banned infrastructure. Fix only verified issues and rerun affected checks.

- [x] **Step 4: Persist evidence and commit coherent records**

Record every RED/GREEN and final command with exit code/counts. Set M06 complete and M07 not started, commit the evidence, verify the worktree, and stop at the M07 gate.

Commit: `docs: record m06 verification`
