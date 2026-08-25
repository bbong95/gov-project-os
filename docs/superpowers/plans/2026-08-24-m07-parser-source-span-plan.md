# M07 Parser / SourceSpan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse an authorized private synthetic RFP into immutable, project-isolated SourceSpans with exact original text, deterministic normalization, real source location, stable hashes, an accessible review flow, and measured kordoc Workers compatibility.

**Architecture:** The authenticated Next.js server route downloads the immutable private original, rechecks its SHA-256, selects an in-process `DocumentParser`, and persists one complete parse snapshot plus ordered SourceSpans through a guarded PostgreSQL function. TXT is the deterministic reference parser; kordoc formats are enabled only when an exact-version synthetic fixture passes the actual Workers bundle and runtime matrix.

**Tech Stack:** TypeScript, Next.js 16.3.2 App Router, OpenNext Cloudflare 1.20.2, Cloudflare Workers compatibility date 2026-08-20, Web Crypto, Supabase SSR 0.12.4/Data API 2.112.3/PostgreSQL 17/RLS/Private Storage, Supabase CLI 2.115.0, pgTAP, Vitest 4.1.11, Playwright 1.62.1, axe-core 4.13.0, and evidence-gated kordoc 4.9.1.

**Spec:** `docs/superpowers/specs/2026-08-24-m07-parser-source-span-design.md`

## Global Constraints

- Preserve the complete GOV Project OS lifecycle; implement M07 only and stop at the M08 gate.
- Write each production behavior test first and observe the expected failure before implementation.
- Keep immutable original bytes, parser output, normalized text, and every later AI interpretation separate.
- Every persisted SourceSpan requires a real location, non-empty original text, separately derived normalized text, and lowercase SHA-256 of the original text.
- Use immutable parse snapshots; a new parser or normalization version creates a new row and never rewrites an older snapshot.
- Recompute the private original's SHA-256 before parsing and fail closed on a metadata mismatch.
- Use the authenticated user's Supabase session, project RLS, and a narrowly guarded persistence function; add no service-role production endpoint.
- Treat documents and extracted text as untrusted data; render escaped text only, execute no document content, and call no AI in M07.
- Use only runtime-generated or explicitly synthetic fixtures and `.test` identities. Never commit real or restricted customer material.
- Keep parse and source-review flows keyboard operable with semantic HTML, visible focus, accessible names, and textual status.
- Add no Redis, Neo4j, Elasticsearch, Kubernetes, LangChain, LlamaIndex, microservice, multi-agent runtime, R2, Hyperdrive, Cloudflare Access, second AI provider, or vector database.
- Parser limits are fixed at 20,000 spans, 256 KiB UTF-8 per original/normalized span, and 16 MiB total extracted UTF-8 text for M07.
- Kordoc OCR, formula OCR, image OCR, model download, subprocess, and persistent local-filesystem paths remain disabled.

## File Map

### Parser domain

- Create `src/lib/parsing/document-parser.ts`: parser interface, location union, result types, fixed error codes, versions, and limits.
- Create `src/lib/parsing/source-span.ts`: deterministic normalization, per-span hash, location validation, and canonical parse-result hash.
- Create `src/lib/parsing/plain-text-document-parser.ts`: strict UTF-8/BOM/paragraph/line parser.
- Create `src/lib/parsing/plain-text-document-parser.test.ts`: synthetic contract and plain-text behavior RED/GREEN.
- Create `src/lib/parsing/parser-registry.ts`: explicit canonical media-type routing; stored upload media type is never sufficient evidence.
- Create `src/lib/parsing/prepare-rfp-parse.ts`: private-byte integrity check, parser invocation, limits, and persistence payload mapping.
- Create `src/lib/parsing/prepare-rfp-parse.test.ts`: integrity, unsupported-format, fixed-error, and inert-input behavior.
- Conditionally create `src/lib/parsing/kordoc-document-parser.ts` and `.test.ts` only for formats proven compatible in Task 2.

### Persistence and authorization

- Create `supabase/migrations/20260824093651_parser_source_span.sql`: immutable parse/span schema, indexes, location/hash helpers, RLS, guarded atomic RPC, and audit event.
- Create `supabase/tests/database/source_span_schema_test.sql`: catalog/constraint/grant/function contract.
- Create `supabase/tests/database/source_span_isolation_test.sql`: real-role persistence, isolation, immutability, idempotency, and hash behavior.

### Server and UI

- Create `src/app/projects/[projectId]/documents/[documentId]/parse/route.ts`: authenticated inline parse POST with fixed redirects.
- Create `src/app/projects/[projectId]/documents/[documentId]/source/page.tsx`: authorized immutable SourceSpan review.
- Modify `src/app/projects/[projectId]/rfp/page.tsx`: parse status/action/source links and corrected M07 copy.
- Modify `tests/e2e/support/local-supabase.ts`: same-project viewer plus parse/span cleanup.
- Create `tests/e2e/rfp-parse.spec.ts`: real upload → parse → evidence → isolation flow.
- Create `tests/a11y/rfp-source-span.spec.ts`: keyboard and axe coverage.

### Compatibility and evidence

- Create `docs/compatibility/2026-08-24-kordoc-workers.md`: exact-version per-format evidence.
- Create `docs/adr/ADR-0001-parser-runtime-boundary-draft.md` only if a required kordoc format fails Workers build/runtime; keep status `DRAFT-NOT-ACCEPTED` and add no infrastructure.
- Create `scripts/verify-workers-preview.ps1`: tracked-source Linux OpenNext build and synthetic Workers HTTP probe with cleanup.
- Modify `docs/goal/GOAL_STATE.md`, `VERIFICATION_LOG.md`, `DECISIONS.md`, and `HUMAN_CHECKPOINTS.md`: M07 state and fresh evidence.

---

### Task 1: DocumentParser contract and deterministic TXT SourceSpans

**Files:**
- Create: `src/lib/parsing/document-parser.ts`
- Create: `src/lib/parsing/source-span.ts`
- Create: `src/lib/parsing/plain-text-document-parser.ts`
- Create: `src/lib/parsing/plain-text-document-parser.test.ts`

**Interfaces:**
- Consumes: `sha256Hex(bytes)` from `src/lib/documents/rfp-original.ts`, Web `TextDecoder`, and Web Crypto.
- Produces: `DocumentParser`, `ParseInput`, `ParsedDocument`, `ParsedSourceSpan`, `SourceLocation`, `DocumentParseError`, `normalizeSourceText()`, `hashParsedSourceSpan()`, `hashParsedDocument()`, and `PlainTextDocumentParser`.

- [x] **Step 1: Write the failing parser contract tests**

Use this contract shape in `plain-text-document-parser.test.ts`:

```ts
const DOCUMENT_ID = "40000000-0000-4000-8000-000000000001";
const SOURCE_SHA = "a".repeat(64);

function textInput(text: string): ParseInput {
	return {
		documentId: DOCUMENT_ID,
		originalFilename: "m07-synthetic-rfp.txt",
		canonicalMimeType: "text/plain",
		sourceSha256: SOURCE_SHA,
		bytes: new TextEncoder().encode(text).buffer,
	};
}

it("preserves exact paragraph text and one-based line locations", async () => {
	const result = await new PlainTextDocumentParser().parse(
		textInput("  첫째 항목\r\n둘째 항목  \r\n\r\n셋째 항목"),
	);
	expect(result.spans).toMatchObject([
		{
			ordinal: 1,
			location: { kind: "TEXT_LINES", lineStart: 1, lineEnd: 2 },
			originalText: "  첫째 항목\r\n둘째 항목  ",
			normalizedText: "첫째 항목\n둘째 항목",
		},
		{
			ordinal: 2,
			location: { kind: "TEXT_LINES", lineStart: 4, lineEnd: 4 },
			originalText: "셋째 항목",
			normalizedText: "셋째 항목",
		},
	]);
});

it("pins the original-text SHA-256 and rejects empty source", async () => {
	const result = await new PlainTextDocumentParser().parse(textInput("abc"));
	expect(result.spans[0]?.originalTextSha256).toBe(
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	);
	await expect(new PlainTextDocumentParser().parse(textInput(" \r\n\t\n"))).rejects.toMatchObject({
		code: "EMPTY_SOURCE",
	});
});
```

Also cover fatal invalid UTF-8, initial BOM handling, NFC normalization, stable result hash, location validation, 20,000-span/256-KiB/16-MiB limits, and injection-shaped text retained as inert `originalText`.

- [x] **Step 2: Run the targeted unit test and confirm RED**

Run: `pnpm test -- src/lib/parsing/plain-text-document-parser.test.ts`

Expected: FAIL with module-not-found for `plain-text-document-parser`; all pre-existing unit/Eval tests remain untouched.

- [x] **Step 3: Implement the minimum parser types and errors**

Define these public types in `document-parser.ts`:

```ts
export const PARSER_LIMITS = {
	maxSpans: 20_000,
	maxSpanUtf8Bytes: 256 * 1024,
	maxTotalUtf8Bytes: 16 * 1024 * 1024,
} as const;

export type SourceLocation =
	| { kind: "TEXT_LINES"; lineStart: number; lineEnd: number }
	| { kind: "PAGE"; pageNumber: number; blockIndex?: number; pageMode: "LAYOUT" | "SECTION_APPROXIMATE" }
	| { kind: "SHEET"; sheetIndex: number; sheetName?: string; cellRange?: string }
	| { kind: "SECTION"; sectionIndex: number; label?: string; blockIndex?: number };

export type ParsedSourceSpan = {
	ordinal: number;
	location: SourceLocation;
	originalText: string;
	normalizedText: string;
	originalTextSha256: string;
};

export type ParseInput = {
	documentId: string;
	originalFilename: string;
	canonicalMimeType: string;
	sourceSha256: string;
	bytes: ArrayBuffer;
};

export type ParsedDocument = {
	parserKey: string;
	parserVersion: string;
	normalizationVersion: string;
	detectedFormat: "txt" | "hwp" | "hwpx" | "pdf" | "xlsx" | "docx";
	warnings: Array<{ code: string; location?: SourceLocation }>;
	spans: ParsedSourceSpan[];
	resultSha256: string;
};

export interface DocumentParser {
	supports(mimeType: string): boolean;
	parse(input: ParseInput): Promise<ParsedDocument>;
}
```

`DocumentParseError.code` is one of `UNSUPPORTED_FORMAT`, `INVALID_TEXT_ENCODING`, `EMPTY_SOURCE`, `SOURCE_INTEGRITY_FAILED`, `PARSE_LIMIT_EXCEEDED`, or `PARSE_FAILED`. Its message is fixed and never includes parser/provider detail.

- [x] **Step 4: Implement deterministic normalization, hashing, and TXT parsing**

Use parser constants `plain-text`, `1.0.0`, and `nfc-lines-v1`. Decode with `new TextDecoder("utf-8", { fatal: true })`, remove only an initial U+FEFF encoding marker, scan line offsets without rewriting the input, omit blank separators, and slice each maximal non-blank paragraph from its first content byte to its last content character. Normalize only the separate normalized field.

Canonical result hashing serializes ordered objects with keys `ordinal`, `location`, `originalTextSha256`, and `normalizedText` in that order and location keys in the union order above, with `JSON.stringify` and no whitespace.

- [x] **Step 5: Run targeted and affected unit tests for GREEN**

Run: `pnpm test -- src/lib/parsing/plain-text-document-parser.test.ts`

Run: `pnpm test`

Expected: the new contract and all existing unit/Eval-inclusive Vitest files pass.

- [x] **Step 6: Commit the parser contract**

```powershell
git add -- src/lib/parsing/document-parser.ts src/lib/parsing/source-span.ts src/lib/parsing/plain-text-document-parser.ts src/lib/parsing/plain-text-document-parser.test.ts
git commit -m "feat: add deterministic source span parser"
```

### Task 2: Exact-version kordoc Workers compatibility spike

**Files:**
- Create: `docs/compatibility/2026-08-24-kordoc-workers.md`
- Conditionally create: `docs/adr/ADR-0001-parser-runtime-boundary-draft.md`
- Disposable only: `temp/m07-kordoc-spike/`

**Interfaces:**
- Consumes: kordoc 4.9.1, Node 24.19.0, Wrangler 4.125.0, compatibility date 2026-08-20, and synthetic HWPX/PDF/XLSX/DOCX inputs. HWP remains `NOT_RUN_NO_SYNTHETIC_FIXTURE` unless a clearly synthetic fixture is generated or obtained without customer data.
- Produces: a committed matrix whose only outcome values are `PASS`, `FAIL_BUILD`, `FAIL_RUNTIME`, `FAIL_CONTRACT`, or `NOT_RUN_NO_SYNTHETIC_FIXTURE`; optionally an unaccepted ADR draft with exact evidence.

- [x] **Step 1: Build the disposable probe without changing production dependencies**

Create a scratch package and Worker entry under `temp/m07-kordoc-spike`. The Worker accepts fixture bytes by POST, calls `parse(arrayBuffer, { ocr: false, formulaOcr: false })`, and returns only success, detected type, warning codes, page mode, block count, and extracted non-empty text length. It never returns fixture bytes or full text.

Install in the scratch directory only:

```powershell
pnpm --dir temp/m07-kordoc-spike add --save-exact kordoc@4.9.1 jszip@3.10.1
```

Generate explicitly synthetic HWPX with kordoc's generator, minimal DOCX/XLSX ZIPs with `jszip`, and a minimal text-layer PDF. Do not copy kordoc repository corpora or public-sector documents.

- [x] **Step 2: Probe package import and bare Workers bundle**

Run the scratch Node import/parse probe, then:

```powershell
pnpm exec wrangler deploy temp/m07-kordoc-spike/worker.ts --dry-run --outdir temp/m07-kordoc-spike/dist --compatibility-date 2026-08-20
```

Expected: record the actual exit code and bundle size. Import-only success is insufficient.

- [x] **Step 3: Classify actual local Workers runtime per format — not run because no deployable bundle exists**

Start the scratch Worker with Wrangler local runtime on loopback, POST each synthetic fixture, capture only the structured summary, and stop the process. Test HWPX, PDF, XLSX, and DOCX independently. Mark HWP `NOT_RUN_NO_SYNTHETIC_FIXTURE` unless a synthetic-only source is proven.

For each format, require non-empty extracted text, correct detected format, no subprocess/model download/OCR, and a real page/sheet/section location signal when the library exposes one.

- [x] **Step 4: Record the immutable compatibility report**

The report includes exact versions, install mode, dependency audit, Worker bundle exit/size, runtime exit, per-format outcome, location precision, warning codes, and sanitized failure excerpt. It explicitly lists the MIME types allowed into production; every non-PASS format remains disabled.

If a format fails, create the ADR draft with `Status: DRAFT-NOT-ACCEPTED`, current-architecture failure evidence, security/privacy impact, rollback, and the statement that no parser service or infrastructure is authorized.

- [x] **Step 5: Remove the disposable scratch directory safely and commit evidence**

Resolve the absolute scratch path, verify it is below the repository's ignored `temp` directory, then remove only `temp/m07-kordoc-spike`. Confirm `package.json` and `pnpm-lock.yaml` are unchanged.

```powershell
git add -- docs/compatibility/2026-08-24-kordoc-workers.md docs/adr/ADR-0001-parser-runtime-boundary-draft.md
git commit -m "docs: record kordoc workers compatibility"
```

Omit the ADR path from `git add` when every tested format passes.

### Task 3: Evidence-gated KordocDocumentParser

**Files:**
- Conditionally create: `src/lib/parsing/kordoc-document-parser.ts`
- Conditionally create: `src/lib/parsing/kordoc-document-parser.test.ts`
- Conditionally modify: `package.json`
- Conditionally modify: `pnpm-lock.yaml`
- Modify: `docs/compatibility/2026-08-24-kordoc-workers.md`

**Interfaces:**
- Consumes: only MIME types marked `PASS` by Task 2 and Task 1 parser types/hash functions.
- Produces: `KORDOC_WORKERS_SUPPORTED_MIME_TYPES` and `KordocDocumentParser`; produces no code or dependency when Task 2 has zero PASS binary formats.

- [x] **Step 1: Apply the evidence branch — N/A, zero Workers-compatible binary formats**

If no binary format is `PASS`, mark this task `N/A — zero compatible formats` in the plan execution record and retain the TXT-only registry. Do not add kordoc to the production package.

If at least one binary format is `PASS`, continue with every following step for exactly those formats.

- [x] **Step 2: N/A — no PASS format, so no production adapter contract is authorized**

For each PASS fixture, assert `supports()` only for its canonical MIME, byte-level format mismatch denial, structured block-to-span conversion, original block/cell text rather than rendered Markdown, real location precision, deterministic normalization/hash, and allowlisted warning codes. Assert all FAIL/NOT_RUN MIME types return false.

Run: `pnpm test -- src/lib/parsing/kordoc-document-parser.test.ts`

Expected: FAIL with module-not-found before the dependency/adapter exists.

- [x] **Step 3: N/A — production dependency remains unchanged**

Run: `pnpm add --save-exact kordoc@4.9.1`

The adapter calls kordoc in buffer mode only, with OCR/formula OCR disabled. It recursively walks structured blocks, skips empty evidence, labels approximate section boundaries, and never invents a page/sheet/cell value. `supports()` is backed by a readonly set containing only Task 2 PASS MIME types.

- [x] **Step 4: N/A — Task 2 bundle and audit evidence blocks the adapter**

Run: `pnpm test -- src/lib/parsing/kordoc-document-parser.test.ts`

Run: `pnpm audit --audit-level high`

Run: `pnpm build`

Run the tracked-source Linux OpenNext Workers build/runtime probe from Task 8 with a server route that imports the adapter.

If any check fails, remove the adapter and production dependency, restore the lockfile through `pnpm remove kordoc`, update the report outcome, and keep only the compatibility evidence/ADR draft. Do not weaken the gate.

- [x] **Step 5: N/A — no adapter commit is created**

```powershell
git add -- package.json pnpm-lock.yaml src/lib/parsing/kordoc-document-parser.ts src/lib/parsing/kordoc-document-parser.test.ts docs/compatibility/2026-08-24-kordoc-workers.md
git commit -m "feat: add workers-compatible kordoc parser"
```

Skip this commit when no binary adapter survives all checks.

### Task 4: Immutable parse and SourceSpan schema contract

**Files:**
- Create: `supabase/tests/database/source_span_schema_test.sql`
- Create: `supabase/migrations/20260824093651_parser_source_span.sql`

**Interfaces:**
- Consumes: M05 tenant/project schema, M06 immutable `documents`/`audit_events`, and the `extensions.digest` pgcrypto function.
- Produces: `public.document_parses`, `public.source_spans`, composite scope keys, immutable privileges, indexes, RLS-enabled tables, and private location/canonical-hash helpers.

- [x] **Step 1: Write the failing pgTAP schema contract**

Assert both tables, RLS flags, required columns, positive span count/ordinal, lowercase hashes, non-empty text, validated location JSON, restrictive composite foreign keys, parser-version idempotency key, project listing indexes, authenticated SELECT-only grants, zero anon grants, and existence/security configuration of private validation/hash helpers.

Use explicit catalog assertions such as:

```sql
select has_table('public', 'document_parses', 'public.document_parses exists');
select has_table('public', 'source_spans', 'public.source_spans exists');
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.source_spans')), false),
	'RLS is enabled on source_spans'
);
select is(
	(
		select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type)
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('document_parses', 'source_spans')
	),
	'document_parses:SELECT,source_spans:SELECT',
	'authenticated receives immutable read-only table grants'
);
```

- [x] **Step 2: Run the database suite and confirm RED**

Run: `pnpm test:rls`

Expected: only new M07 schema assertions fail because parse/span objects are absent; all 98 M06 assertions remain green.

- [x] **Step 3: Implement minimum immutable tables and validation helpers**

Add a unique document scope key `(tenant_id, project_id, id, sha256)`. Create `document_parses` with source hash, parser/normalization versions, detected format, warnings array, positive span count, result hash, actor/time, document composite FK, and unique idempotency key. Create `source_spans` with composite parse scope, one-based ordinal, discriminated location JSON, separate original/normalized text, recomputed text hash, and timestamp.

The location helper accepts only the four exact shapes from the spec and rejects extra keys, zero/negative numbers, reversed line ranges, blank optional names, and malformed cell ranges. Enable RLS immediately; grant authenticated SELECT only and service-role explicit administration privileges for test cleanup.

- [x] **Step 4: Reset the database and confirm schema GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Expected: M05/M06 plus the M07 schema contract pass; persistence behavior is not yet exposed.

- [x] **Step 5: Commit the immutable schema**

```powershell
git add -- supabase/tests/database/source_span_schema_test.sql supabase/migrations/20260824093651_parser_source_span.sql
git commit -m "feat: add immutable source span schema"
```

### Task 5: Guarded atomic persistence, RLS isolation, and parse audit

**Files:**
- Create: `supabase/tests/database/source_span_isolation_test.sql`
- Modify: `supabase/migrations/20260824093651_parser_source_span.sql`

**Interfaces:**
- Consumes: Task 4 tables and M05 membership roles.
- Produces: `public.persist_document_parse(...) returns uuid`, project-member SELECT policies, writer-only guarded creation, canonical result-hash verification, idempotency, and one immutable `DOCUMENT_PARSED` audit event.

- [x] **Step 1: Write failing real-role persistence tests**

Insert synthetic Auth users, tenants, projects, memberships, and document metadata as in M06. Call the RPC with this payload shape:

```sql
select public.persist_document_parse(
	'43000000-0000-4000-8000-000000000101'::uuid,
	repeat('a', 64),
	'plain-text',
	'1.0.0',
	'nfc-lines-v1',
	'txt',
	'[]'::jsonb,
	'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
	jsonb_build_array(
		jsonb_build_object(
			'ordinal', 1,
			'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문',
			'normalizedText', 'M07 합성 요구 원문'
		)
	)
);
```

The source-text SHA pinned by the same fixture is `4840fdebc6552efa7c7fa207d71016a696ab3fc0337578e747cf1d84e1272c3f`. The TypeScript and PostgreSQL canonical serializers must both reproduce these literals before persistence is enabled.

Assert editor/project-admin/tenant-admin same-scope success, viewer/reviewer denial, cross-project denial, source-SHA mismatch denial, malformed/empty span denial, database-recomputed original-text SHA, result-hash mismatch denial, identical-call idempotency, new parser-version snapshot creation, assigned read, anonymous zero access, direct insert/update/delete denial, and exactly one audit event per new snapshot.

- [x] **Step 2: Run pgTAP and confirm RED**

Run: `pnpm test:rls`

Expected: RPC-not-found and allowed-read assertions fail while denial and all M06 assertions remain secure.

- [x] **Step 3: Implement SELECT policies and guarded atomic RPC**

Create project-member/tenant-admin SELECT policies on both tables. The `SECURITY DEFINER` RPC uses `set search_path = ''`, `auth.uid()`, explicit writer-role checks, the visible document's tenant/project/source hash, maximum JSON array length 20,000, sequential ordinals, location helper, 256-KiB per field, 16-MiB total, and `extensions.digest` recomputation.

It verifies the fixed canonical result hash, returns an existing identical parse ID, otherwise inserts parse + spans + audit in one transaction. The RPC receives the route-verified initiating actor ID, rechecks that actor's exact writer scope, revokes all default execution, and grants execute only to `service_role`. Authenticated callers retain no direct table mutation or RPC grant.

- [x] **Step 4: Reset and verify isolation/immutability GREEN**

Run: `pnpm supabase db reset --local --no-seed`

Run: `pnpm test:rls`

Run: `pnpm supabase db advisors --local --type security --level warn --fail-on error`

Run: `pnpm supabase db advisors --local --type performance --level warn --fail-on error`

Expected: all 196 M05-M07 assertions pass; authenticated direct RPC and unauthorized cross-project reads/writes are zero; both advisor result sets contain no error.

- [x] **Step 5: Commit persistence authorization**

```powershell
git add -- supabase/tests/database/source_span_isolation_test.sql supabase/migrations/20260824093651_parser_source_span.sql
git commit -m "feat: persist trusted source span snapshots"
```

Completed as `bddfc87` after the ADR-0002 trust-boundary RED, actor mutation RED, 196/196 GREEN, and both advisors reported no issues.

### Task 6: Server-side original integrity and parse route

**Files:**
- Create: `src/lib/parsing/parser-registry.ts`
- Create: `src/lib/parsing/prepare-rfp-parse.ts`
- Create: `src/lib/parsing/prepare-rfp-parse.test.ts`
- Create: `src/app/projects/[projectId]/documents/[documentId]/parse/route.ts`

- Create: `src/lib/supabase/trusted-server.ts`
- Create: `src/lib/supabase/trusted-server.test.ts`
**Interfaces:**
- Consumes: Task 1 parser, optional Task 3 adapter, M06 `StorageProvider`, signed-in Supabase client for user authorization/private Storage, a separate server-only Supabase secret client, and Task 5 RPC.
- Produces: `createParserRegistry()`, `prepareRfpParse(document, storage, registry)`, and authenticated parse POST with fixed redirect codes.

- [x] **Step 1: Write failing orchestration tests**

Use real `PlainTextDocumentParser` plus a fake `StorageProvider` that returns a Blob. Assert exact-byte SHA recheck, parser selection, payload mapping, unsupported extension/MIME denial, source-integrity mismatch before parser invocation, parser error sanitization, and injection-shaped source retained as data. Separately prove the trusted server client fails closed without a backend secret, accepts only server-side secret/service-role variables, and sends no user session.

```ts
await expect(
	prepareRfpParse(
		{
			id: DOCUMENT_ID,
			originalFilename: "synthetic.txt",
			mediaType: "application/octet-stream",
			storageBucket: "rfp-originals",
			storagePath: `${PROJECT_ID}/${DOCUMENT_ID}/original`,
			sha256: "0".repeat(64),
		},
		storage,
		createParserRegistry(),
	),
).rejects.toMatchObject({ code: "SOURCE_INTEGRITY_FAILED" });
```

- [x] **Step 2: Run targeted unit test and confirm RED**

Run: `pnpm test -- src/lib/parsing/prepare-rfp-parse.test.ts`

Expected: FAIL with module-not-found before registry/orchestration exists.

- [x] **Step 3: Implement minimum registry and pure orchestration**

Map `.txt` to canonical `text/plain`; keep stored `media_type` only as untrusted metadata. A parser must still validate bytes. If Task 3 produced a verified adapter, add it statically for only its PASS MIME types. Recompute SHA with Web Crypto before selecting/parsing. Return a typed RPC payload and fixed error codes without logging source/provider details.

- [x] **Step 4: Implement authenticated route**

`POST /projects/<projectId>/documents/<documentId>/parse` verifies claims, selects the exact RFP document through RLS, rejects non-writers with the same fixed unavailable response, downloads through `SupabasePrivateStorageProvider`, and prepares the parse using the user's SSR client. Only the final `persist_document_parse` call uses the separate server-only secret client and passes the verified user ID as `target_actor_user_id`. It redirects relatively with one of `parsed`, `already_parsed`, or a fixed error code and uses no AI gateway.

- [x] **Step 5: Run unit/type/lint checks for GREEN**

Run: `pnpm test -- src/lib/parsing/prepare-rfp-parse.test.ts`

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: targeted orchestration behavior, types, and lint pass without raw errors or privileged imports.

- [x] **Step 6: Commit server parsing**

```powershell
git add -- src/lib/parsing/parser-registry.ts src/lib/parsing/prepare-rfp-parse.ts src/lib/parsing/prepare-rfp-parse.test.ts src/app/projects/[projectId]/documents/[documentId]/parse/route.ts
git commit -m "feat: parse private rfp originals server side"
```

### Task 7: Accessible parse status and SourceSpan review flow

**Files:**
- Create: `tests/e2e/rfp-parse.spec.ts`
- Modify: `tests/e2e/support/local-supabase.ts`
- Modify: `src/app/projects/[projectId]/rfp/page.tsx`
- Create: `src/app/projects/[projectId]/documents/[documentId]/source/page.tsx`

**Interfaces:**
- Consumes: Task 6 parse route and Task 5 RLS-backed parse/span reads.
- Produces: writer parse action, viewer-readable evidence, immutable hash/location display, and cross-project/anonymous denial.

- [x] **Step 1: Extend only runtime synthetic fixture support**

Add a VIEWER in the assigned project to `LocalRfpFixture`, expose its `.test` credentials, and clean `source_spans` then `document_parses` before audit/documents during disposal. Keep the local service credential private inside the test support module.

- [x] **Step 2: Write the failing browser vertical-slice test**

Upload `m07-browser-synthetic-rfp.txt` as the editor, press the accessible parse button with Enter, verify textual success, follow the SourceSpan link, and assert:

```ts
await expect(page.getByRole("heading", { level: 1, name: "RFP SourceSpan" })).toBeVisible();
await expect(page.getByRole("heading", { level: 2, name: "SourceSpan 1" })).toBeVisible();
await expect(page.getByText("1–2행", { exact: true })).toBeVisible();
await expect(page.getByText("원문", { exact: true })).toBeVisible();
await expect(page.getByText("정규화문", { exact: true })).toBeVisible();
```

Verify original and normalized text separately, the known per-span SHA and document SHA, parser/normalization versions, unchanged downloaded bytes, viewer read with no parse control, cross-project 404, anonymous login redirect, and identical retry showing `already_parsed` without a second snapshot.

- [x] **Step 3: Run targeted E2E and confirm RED**

Run: `pnpm exec playwright test tests/e2e/rfp-parse.spec.ts`

Expected: FAIL because the RFP list has no parse control or SourceSpan page.

- [x] **Step 4: Implement semantic RFP status and evidence page**

Update the M06 copy to state that originals are immutable and verified formats can now be parsed without AI. Fetch latest visible parse summaries through RLS. Writers receive a real POST button labelled `<filename> 파싱 시작`; all members receive a real SourceSpan link after success. Unsupported formats show explicit text and no misleading success state.

The source page selects the exact document/parse/spans through RLS, orders spans by ordinal, and renders escaped text in semantic sections. Display original/normalized text under distinct headings, fixed warning text, line/page/sheet/section labels, hashes, and parser versions. Use no Markdown/HTML renderer and no `dangerouslySetInnerHTML`.

- [x] **Step 5: Re-run browser behavior for GREEN**

Run: `pnpm exec playwright test tests/e2e/rfp-parse.spec.ts`

Run: `pnpm exec playwright test tests/e2e/rfp-upload.spec.ts tests/e2e/rfp-storage.spec.ts`

Expected: new parse flow and all M06 upload/storage regressions pass with one Playwright worker.

- [x] **Step 6: Commit the vertical slice**

```powershell
git add -- tests/e2e/rfp-parse.spec.ts tests/e2e/support/local-supabase.ts src/app/projects/[projectId]/rfp/page.tsx src/app/projects/[projectId]/documents/[documentId]/source/page.tsx
git commit -m "feat: add accessible source span review"
```

### Task 8: Accessibility, Workers runtime, security, evidence, and M07 Gate

**Files:**
- Create: `tests/a11y/rfp-source-span.spec.ts`
- Create: `scripts/verify-workers-preview.ps1`
- Modify: `docs/goal/GOAL_STATE.md`
- Modify: `docs/goal/VERIFICATION_LOG.md`
- Modify: `docs/goal/DECISIONS.md`
- Modify: `docs/goal/HUMAN_CHECKPOINTS.md`
- Update task checkboxes in this plan as execution evidence is produced.

**Interfaces:**
- Consumes: every M07 parser, compatibility, persistence, server, and UI behavior.
- Produces: fresh M07 Gate evidence and an explicit stop before M08.

- [x] **Step 1: Write and run targeted accessibility coverage**

Use the same synthetic upload/parse flow, keyboard activation, semantic queries, and Axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`. Scan parseable, parsed, and populated SourceSpan states.

Run: `pnpm exec playwright test tests/a11y/rfp-source-span.spec.ts`

Expected: PASS when the already-tested semantic UI has no detectable A/AA issue; if RED, make only the failing semantic/focus/status correction, rerun E2E and accessibility, and commit `fix: correct source span accessibility`.

- [x] **Step 2: Add a reproducible tracked-source Workers verifier**

The PowerShell script creates a GUID-named directory strictly below the system temp path, archives tracked `HEAD`, starts an official `node:24.19.0-bookworm-slim` container with synthetic public Supabase environment values, installs with the frozen lockfile, runs Next and OpenNext builds, starts Wrangler on loopback, and probes HTTP 200 plus expected product content. A `finally` block removes the exact container and verified temp directory. It never copies `.env.local` or passes actual keys.

Implement this exact safety/control structure; keep container command output suppressed unless a step fails:

```powershell
[CmdletBinding()]
param([int]$Port = 8787)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
$suffix = [guid]::NewGuid().ToString("N")
$stage = Join-Path $tempRoot "gov-project-os-m07-$suffix"
$container = "gov-project-os-m07-$suffix"

try {
	[void](New-Item -ItemType Directory -Path $stage)
	& git -C $repoRoot archive --format=tar HEAD -o (Join-Path $stage "source.tar")
	if ($LASTEXITCODE -ne 0) { throw "Tracked-source archive failed." }

	& docker run --name $container -d -p "127.0.0.1:${Port}:8787" `
		-e "NEXT_PUBLIC_SUPABASE_URL=https://synthetic.invalid" `
		-e "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-public-key" `
		--mount "type=bind,src=$stage,dst=/workspace" `
		node:24.19.0-bookworm-slim sh -lc `
		"mkdir /app && tar -xf /workspace/source.tar -C /app && cd /app && corepack enable && corepack prepare pnpm@11.19.0 --activate && pnpm install --frozen-lockfile && pnpm build && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare preview --ip 0.0.0.0 --port 8787" | Out-Null
	if ($LASTEXITCODE -ne 0) { throw "Workers container did not start." }

	$deadline = (Get-Date).AddMinutes(10)
	$response = $null
	do {
		Start-Sleep -Seconds 2
		try {
			$response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 5
			if ($response.StatusCode -eq 200 -and $response.Content -match "GOV Project OS") { break }
		} catch {
			$response = $null
		}
		$running = & docker inspect --format "{{.State.Running}}" $container 2>$null
		if ($running -eq "false") { throw "Workers container exited before the HTTP probe passed." }
	} while ((Get-Date) -lt $deadline)

	if (-not $response -or $response.StatusCode -ne 200) { throw "Workers HTTP probe timed out." }
} finally {
	& docker rm -f $container 2>$null | Out-Null
	if (Test-Path -LiteralPath $stage) {
		$resolvedStage = (Resolve-Path -LiteralPath $stage).Path
		$requiredPrefix = $tempRoot + [IO.Path]::DirectorySeparatorChar
		if (-not $resolvedStage.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
			throw "Refusing cleanup outside the system temp directory."
		}
		Remove-Item -LiteralPath $resolvedStage -Recurse -Force
	}
}
```

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-workers-preview.ps1`

Expected: frozen install, Next build, OpenNext bundle, Worker start, and HTTP/content probe all exit 0; no container or temp archive remains.

- [x] **Step 3: Run the complete fresh verification set**

Run each command freshly:

```powershell
pnpm install --frozen-lockfile
pnpm audit --audit-level high
pnpm typecheck
pnpm lint
pnpm test
pnpm test:eval
pnpm supabase db reset --local --no-seed
pnpm test:rls
pnpm supabase db advisors --local --type security --level warn --fail-on error
pnpm supabase db advisors --local --type performance --level warn --fail-on error
pnpm test:e2e
pnpm test:a11y
pnpm build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-workers-preview.ps1
```

Expected: zero failures, zero unauthorized cross-project reads/writes, unchanged original bytes, stable span/result hashes, database advisors without error, no high dependency vulnerability, and Workers HTTP 200.

- [x] **Step 4: Run explicit secret, fixture, and banned-infrastructure scans**

Run value-suppressed scans that report counts only. Confirm:

- zero `OPENAI_API_KEY` or Supabase service-role identifier in `src/` or browser bundles;
- zero tracked JWT/private API-key patterns;
- zero non-synthetic email domains or restricted customer fixture markers;
- zero newly introduced banned-infrastructure package/config names;
- only approved parser dependencies from the Task 2 compatibility evidence.

Do not print matched secret values. Any hit is inspected locally and resolved before Gate PASS.

- [x] **Step 5: Self-review M07 against the approved spec**

Inspect the complete M07 diff and behavior for original/interpretation mixing, missing SourceSpan location/hash, mutable snapshots, `SECURITY DEFINER` authorization/search-path defects, cross-project leakage, raw error reflection, unsupported kordoc claims, untrusted HTML rendering, AI calls, browser secrets, accessibility regressions, real customer data, and banned infrastructure. Fix only verified gaps and rerun every affected command.

- [x] **Step 6: Persist Goal evidence and stop at M08 Gate**

Mark `STAGE_GATE_M07` complete, record parser/kordoc decisions, write every RED/GREEN/final command with exit code/counts, set M07 COMPLETE and M08 NOT_STARTED, and set the next action to explicit M08 authorization. Do not implement extraction.

```powershell
git add -- tests/a11y/rfp-source-span.spec.ts scripts/verify-workers-preview.ps1 docs/goal/GOAL_STATE.md docs/goal/VERIFICATION_LOG.md docs/goal/DECISIONS.md docs/goal/HUMAN_CHECKPOINTS.md docs/superpowers/plans/2026-08-24-m07-parser-source-span-plan.md
git commit -m "docs: record m07 verification"
git status --short
git log -1 --oneline
```

Expected: clean worktree and one final M07 evidence commit. Report only current milestone, passed Gate, blocker status, and next Gate.
