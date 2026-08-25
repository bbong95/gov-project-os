# M08 Requirement Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline task-by-task execution. `superpowers:subagent-driven-development` may be used only after the user explicitly requests subagent execution. Keep every checkbox and record RED/GREEN evidence as written.

**Goal:** Convert an authorized immutable RFP parse into project-isolated, immutable `AI_DRAFT` requirement candidates whose every factual source claim is backed by existing SourceSpans, while enforcing privacy policy before any AI call.

**Architecture:** An authenticated Next.js server route accepts only `documentParseId`, rereads document/parse/spans through the caller's RLS session, and checks the initiating role. A pure orchestrator evaluates the privacy policy before constructing a canonical input. A server-only OpenAI Responses adapter sends allowed synthetic/source content with `store:false` and strict Structured Outputs. The model returns SourceSpan ordinals, never database IDs or authoritative source text. Server validation maps ordinals to the immutable spans, validates identifiers against cited originals, and passes an atomic snapshot to a service-role-only, actor-rechecking PostgreSQL function. Results are read-only in M08.

**Tech Stack:** TypeScript, Next.js 16.3.2 App Router, OpenNext Cloudflare 1.20.2, Web Crypto and direct server-side `fetch`, OpenAI Responses API, Supabase SSR 0.12.4/Data API 2.112.3/PostgreSQL 17/RLS, Vitest 4.1.11, pgTAP, Playwright 1.62.1, and axe-core 4.13.0.

**Spec:** `docs/superpowers/specs/2026-08-25-m08-requirement-extraction-design.md`

**Official API references:** [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Global Constraints

- Preserve the complete GOV Project OS lifecycle; implement M08 only and stop at the M09 Gate.
- Write each production behavior test first, run it, and record the expected RED before minimum implementation.
- Keep immutable original source, parser output, provider response, server interpretation, and human verification separate.
- Every M08 candidate is `AI_DRAFT`; M08 adds no approve/edit/reject controls and creates no Requirement Baseline. Any future `HUMAN_VERIFIED` factual entity must retain at least one SourceSpan.
- The browser submits only `documentParseId`. The server rereads all authoritative identity, scope, privacy, and SourceSpan data.
- `PUBLIC` and `INTERNAL` are `ALLOW`; `PERSONAL` is `REVIEW_REQUIRED` with no M08 AI call; `SENSITIVE`, `RESTRICTED`, unknown, and malformed values are `BLOCK` with no AI call.
- The model returns SourceSpan ordinals only. The server maps them to IDs and derives `source_text` from immutable `source_spans.original_text`.
- Use stateless Responses calls with `store:false`, strict JSON Schema, no tools, a required server-side model, and a required server-side API key.
- Production accepts only `https://api.openai.com/v1/responses`; a loopback endpoint is enabled only in non-production E2E through a server environment guard. The browser cannot choose a provider or endpoint.
- Never log or persist raw source, canonical input, system instructions, API key, or provider error body. Safe audit metadata contains fixed outcome/error codes and hashes only.
- Use synthetic fixtures only. Keep the existing injection-shaped synthetic text inert and verify it cannot alter tools, policy, endpoint, or persistence behavior.
- Add no OpenAI SDK, Redis, Neo4j, Elasticsearch, Kubernetes, LangChain, LlamaIndex, microservice, multi-agent runtime, R2, Hyperdrive, Cloudflare Access, second provider, or vector database.
- Keep extraction and evidence review keyboard operable with semantic HTML, accessible names, visible focus, and textual state.
- Run fresh affected tests after every task and the full verification matrix before any M08 completion claim.

## Fixed Domain Contract

```ts
export const REQUIREMENT_POLICY_VERSION = "document-privacy-v1";
export const REQUIREMENT_PROMPT_VERSION = "requirement-extraction-v1";
export const REQUIREMENT_SCHEMA_VERSION = "requirement-candidates-v1";

export const REQUIREMENT_EXTRACTION_LIMITS = {
	maxCanonicalInputUtf8Bytes: 1_048_576,
	maxProviderResponseUtf8Bytes: 4_194_304,
	maxCandidates: 500,
	maxOfficialIdChars: 128,
	maxInterpretationUtf8Bytes: 8_192,
	maxSourceSpansPerCandidate: 64,
	maxOutputTokens: 32_768,
} as const;

export type RequirementType =
	| "FUNCTIONAL"
	| "SYSTEM_CONFIGURATION"
	| "PERFORMANCE"
	| "INTERFACE"
	| "DATA"
	| "TEST"
	| "SECURITY"
	| "QUALITY"
	| "CONSTRAINT"
	| "PROJECT_MANAGEMENT"
	| "PROJECT_SUPPORT"
	| "OTHER";

export type RequirementAtomicity = "ATOMIC" | "COMPOSITE" | "REVIEW_REQUIRED";
export type RequirementProvenanceState = "AI_DRAFT";
export type ExtractionPolicyDecision = "ALLOW" | "REVIEW_REQUIRED" | "BLOCK";

export type AiUsage = { inputTokens: number | null; outputTokens: number | null };

export type RequirementExtractionErrorCode =
	| "AI_INPUT_LIMIT_EXCEEDED"
	| "AI_INPUT_INVALID"
	| "AI_CONFIG_MISSING"
	| "AI_PROVIDER_UNAVAILABLE"
	| "AI_PROVIDER_REFUSED"
	| "AI_PROVIDER_INCOMPLETE"
	| "AI_OUTPUT_INVALID"
	| "AI_OUTPUT_LIMIT_EXCEEDED"
	| "PERSIST_FAILED";
```

These are M08 safety limits, not measured product defaults. Exceeding a limit fails closed with a textual result; input or output is never silently truncated. M09 may measure and propose changes.

## File Map

### Domain and provider boundary

- Create `src/lib/requirements/requirement-extraction.ts`: fixed vocabulary, versions, limits, public DTOs, and fixed error class.
- Create `src/lib/requirements/privacy-policy.ts` and `.test.ts`: total privacy decision function.
- Create `src/lib/requirements/requirement-extraction-input.ts` and `.test.ts`: ordered canonical envelope, UTF-8 limit, hashes, and fingerprint.
- Create `src/lib/requirements/requirement-output.ts` and `.test.ts`: strict runtime validation, ordinal mapping, official-ID evidence check, and server-derived source text.
- Create `src/lib/requirements/extract-requirements.ts` and `.test.ts`: policy-first, idempotent orchestration with injected provider/persistence ports.
- Create `src/lib/requirements/requirement-queries.ts`: identical-run lookup through the request user's RLS-scoped Supabase client.
- Create `src/lib/ai/ai-provider.ts`: provider-neutral M08 port only; no framework.
- Create `src/lib/ai/openai-responses-provider.ts` and `.test.ts`: direct Responses API adapter and sanitized error mapping.

### Database and trusted server boundary

- Create `supabase/migrations/*_requirement_extraction.sql` only with `pnpm supabase migration new requirement_extraction`; bind the CLI-emitted exact path to `$m08Migration` and use that path in every later step. Never hand-invent a timestamp.
- Create `supabase/tests/database/requirement_extraction_schema_test.sql`: columns, constraints, composite foreign keys, RLS, grants, and function security contract.
- Create `supabase/tests/database/requirement_extraction_isolation_test.sql`: own/cross-project reads, direct writes, actor/privacy/evidence checks, rollback, idempotency, and safe audit.
- Modify `src/lib/supabase/trusted-server.ts` and `.test.ts`: expose the existing server-only client factory without weakening M07.
- Create `src/lib/requirements/trusted-requirement-extraction.ts` and `.test.ts`: exact RPC adapters for successful snapshots and safe non-success outcomes.

### Route, UI, deterministic E2E, and evidence

- Create `src/app/projects/[projectId]/requirements/extract/route.ts`: authenticated POST and privacy/role-safe PRG redirects.
- Create `src/app/projects/[projectId]/requirements/[runId]/page.tsx`: read-only candidate and SourceSpan evidence view.
- Modify `src/app/projects/[projectId]/rfp/page.tsx`: extraction controls, policy states, latest result link, and no M10 controls.
- Modify `src/app/projects/[projectId]/documents/[documentId]/source/page.tsx`: accurate policy-conditional AI-send copy.
- Create `tests/e2e/support/openai-responses-stub.mjs`: loopback Responses server, reset/call-count/fixed-mode controls, and deterministic synthetic response.
- Modify `playwright.config.ts`: start the stub and inject server-only test provider configuration into Next.
- Modify `tests/e2e/support/local-supabase.ts`: requirement snapshot cleanup before M07 parse/span cleanup.
- Create `tests/e2e/rfp-requirement-extraction.spec.ts`: authorized vertical slice, idempotency, no-call privacy, safe failure, injection-shaped input, and isolation.
- Create `tests/a11y/rfp-requirement-extraction.spec.ts`: keyboard, names, landmarks, status, evidence semantics, and axe.
- Modify `fixtures/synthetic/rfp-mini.json` only if expected M08 classifications/ordinals must be added; keep all values explicitly synthetic.
- Modify `docs/goal/GOAL_STATE.md`, `VERIFICATION_LOG.md`, `DECISIONS.md`, and `HUMAN_CHECKPOINTS.md`: RED/GREEN/security/a11y/Workers evidence and the M09 Gate.

---

### Task 1: Fixed vocabulary and fail-closed privacy policy

**Files:**
- Create: `src/lib/requirements/requirement-extraction.ts`
- Create: `src/lib/requirements/privacy-policy.ts`
- Create: `src/lib/requirements/privacy-policy.test.ts`

**Interfaces:**
- Produces the exact types, versions, limits, and error codes in **Fixed Domain Contract**.
- Produces `decideRequirementExtractionPolicy(value: unknown): ExtractionPolicyDecision`.

- [x] **Step 1: Write the privacy behavior tests**

```ts
it.each([
	["PUBLIC", "ALLOW"],
	["INTERNAL", "ALLOW"],
	["PERSONAL", "REVIEW_REQUIRED"],
	["SENSITIVE", "BLOCK"],
	["RESTRICTED", "BLOCK"],
	["UNKNOWN", "BLOCK"],
	[null, "BLOCK"],
])("maps %j to %s", (value, expected) => {
	expect(decideRequirementExtractionPolicy(value)).toBe(expected);
});
```

Also assert the exact vocabulary, `AI_DRAFT` as the only M08 provenance state, and the fixed input/provider-response/candidate limits and error codes.

- [x] **Step 2: Run RED**

Run: `pnpm test -- src/lib/requirements/privacy-policy.test.ts`

Expected: FAIL because the requirement modules do not exist.

- [x] **Step 3: Implement the minimum total mapping and domain exports**

Use a `switch` with an explicit default `BLOCK`; do not coerce casing or accept aliases.

- [x] **Step 4: Run GREEN and affected tests**

Run: `pnpm test -- src/lib/requirements/privacy-policy.test.ts src/lib/parsing/prepare-rfp-parse.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

Run: `git add src/lib/requirements && git commit -m "feat: define requirement extraction policy"`

Evidence: RED failed on the absent policy module while 25 existing tests passed; GREEN passed 8/8 files and 41/41 tests plus typecheck/lint; committed as `3380826`.

---

### Task 2: Canonical input and provider-output trust boundary

**Files:**
- Create: `src/lib/requirements/requirement-extraction-input.ts`
- Create: `src/lib/requirements/requirement-extraction-input.test.ts`
- Create: `src/lib/requirements/requirement-output.ts`
- Create: `src/lib/requirements/requirement-output.test.ts`

**Interfaces:**

```ts
export type ExtractionSourceSpan = {
	id: string;
	ordinal: number;
	location: unknown;
	originalText: string;
	normalizedText: string;
};

export function buildRequirementExtractionInput(input: {
	tenantId: string; projectId: string; documentId: string; documentParseId: string;
	parserName: string; parserVersion: string; normalizationVersion: string;
	parseResultSha256: string; provider: "OPENAI"; model: string;
	spans: readonly ExtractionSourceSpan[];
}): Promise<{ canonicalInput: string; canonicalInputSha256: string; fingerprintSha256: string }>;

export type RawRequirementCandidate = {
	officialId: string | null;
	interpretation: string;
	type: RequirementType;
	atomicity: RequirementAtomicity;
	sourceSpanOrdinals: number[];
};

export type PersistableRequirementCandidate = {
	candidateOrder: number;
	officialId: string | null;
	sourceText: string;
	interpretation: string;
	type: RequirementType;
	atomicity: RequirementAtomicity;
	provenanceState: "AI_DRAFT";
	contentSha256: string;
	sources: Array<{ sourceSpanId: string; sourceSpanOrdinal: number; sourceOrder: number }>;
};

export function validateAndMapRequirementOutput(input: {
	value: unknown;
	spans: readonly ExtractionSourceSpan[];
}): { candidates: PersistableRequirementCandidate[]; acceptedOutputSha256: string };
```

- [x] **Step 1: Write canonical-input RED tests**

Assert ordered JSON is stable across object insertion order, contains parser/normalization versions and parse hash plus span ordinal/location/`normalizedText`, contains no span/database IDs or `originalText`, hashes are lowercase SHA-256, fingerprint changes with model/version/scope/parse hash, ordinals must be contiguous positive integers, empty spans fail, and more than 1 MiB UTF-8 fails with `AI_INPUT_LIMIT_EXCEEDED` rather than truncating.

- [x] **Step 2: Run canonical-input RED**

Run: `pnpm test -- src/lib/requirements/requirement-extraction-input.test.ts`

Expected: FAIL with module-not-found.

- [x] **Step 3: Implement deterministic canonical serialization**

Use an explicitly constructed object and ordered `spans.map`; reuse Web Crypto SHA-256 conventions already used by M07. Include scope only in the fingerprint material, not the provider-visible canonical input.

- [x] **Step 4: Run canonical-input GREEN**

Run: `pnpm test -- src/lib/requirements/requirement-extraction-input.test.ts`

Expected: PASS.

- [x] **Step 5: Write provider-output RED tests**

Cover exact root `{ candidates }`, no extra keys, all required fields, closed enums, nullable `officialId`, 500-candidate/8-KiB/64-span limits, unique positive ordinals, unknown ordinal rejection, same-parse mapping, exact official-ID occurrence in at least one cited `originalText`, deterministic candidate order, server-derived `sourceText`, and stable accepted-output hash. Include a malicious `sourceText` property and database ID from the provider and expect `AI_OUTPUT_INVALID`.

- [x] **Step 6: Run provider-output RED**

Run: `pnpm test -- src/lib/requirements/requirement-output.test.ts`

Expected: FAIL with module-not-found.

- [x] **Step 7: Implement strict validation and server mapping**

Reject rather than strip unknown keys. Preserve cited source order by document ordinal. Set every mapped candidate to `provenanceState: "AI_DRAFT"`; derive `sourceText` by joining cited immutable `originalText` values with `"\n\n"`.

- [x] **Step 8: Run Task 2 GREEN and commit**

Run: `pnpm test -- src/lib/requirements/requirement-extraction-input.test.ts src/lib/requirements/requirement-output.test.ts`

Expected: PASS.

Run: `git add src/lib/requirements && git commit -m "feat: validate requirement extraction boundaries"`

Evidence: canonical-input RED failed on the absent module and provider-output RED failed on the absent validator; final GREEN passed 10/10 files and 72/72 tests plus typecheck/lint, including a separate blank-official-ID regression RED/GREEN; committed as `d727296`.

---

### Task 3: Stateless OpenAI Responses adapter

**Files:**
- Create: `src/lib/ai/ai-provider.ts`
- Create: `src/lib/ai/openai-responses-provider.ts`
- Create: `src/lib/ai/openai-responses-provider.test.ts`

**Interfaces:**

```ts
export interface RequirementAiProvider {
	readonly name: "OPENAI";
	readonly model: string;
	extract(canonicalInput: string): Promise<{ providerResponseId: string | null; value: unknown; usage: AiUsage }>;
}

export function createProductionRequirementAiProvider(env?: NodeJS.ProcessEnv): RequirementAiProvider;
```

- [x] **Step 1: Write request-contract and failure RED tests**

With an injected fake `fetch`, assert one POST to `https://api.openai.com/v1/responses`, bearer authorization, and this exact semantic body:

```ts
{
	model,
	store: false,
	instructions: REQUIREMENT_EXTRACTION_INSTRUCTIONS,
	input: [{ role: "user", content: [{ type: "input_text", text: canonicalInput }] }],
	max_output_tokens: 32_768,
	text: { format: { type: "json_schema", name: "requirement_candidates", strict: true, schema } },
}
```

Assert `tools` is absent; schema has `additionalProperties:false` at every object, all properties required, and `officialId` is `string|null`. Test missing key/model, production endpoint override rejection, non-2xx including 429 rate limits, timeout/network failure, a response over 4 MiB rejected before JSON parsing, `status:"incomplete"`, refusal content, missing output text, invalid JSON, and sanitized fixed errors. Spy on console methods and assert no API key, input, response body, or provider message is emitted.

- [x] **Step 2: Run RED**

Run: `pnpm test -- src/lib/ai/openai-responses-provider.test.ts`

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Implement the minimum direct-fetch adapter**

Do not add an SDK. Read the response through a byte-limited path, reject more than 4 MiB with `AI_OUTPUT_LIMIT_EXCEEDED`, then parse `response.output[*].content[*]`; accept exactly one `output_text` JSON document. Map incomplete/refusal/malformed/provider failures to the fixed M08 codes. Permit `GOV_PROJECT_OS_OPENAI_RESPONSES_URL` only when `NODE_ENV !== "production"`, `GOV_PROJECT_OS_ALLOW_TEST_OPENAI_URL === "1"`, and the URL hostname is loopback.

- [x] **Step 4: Run GREEN, dependency diff, and commit**

Run: `pnpm test -- src/lib/ai/openai-responses-provider.test.ts src/lib/requirements/requirement-output.test.ts`

Run: `git diff -- package.json pnpm-lock.yaml`

Expected: tests PASS and dependency diff is empty.

Run: `git add src/lib/ai && git commit -m "feat: add stateless OpenAI requirement adapter"`

Evidence: RED failed on the absent adapter module; final provider/output GREEN passed 2/2 files and 41/41 tests plus typecheck/lint with an empty dependency diff. The exact plan command first full-suite run had one unrelated existing parser test reach its 5-second timeout; that test passed 8/8 in isolation and the unchanged exact full command then passed 11/11 files and 91/91 tests. Committed as `a0272a7`.

---

### Task 4: Requirement snapshot schema, RLS, and grants

**Files:**
- Create with CLI: `supabase/migrations/*_requirement_extraction.sql`
- Create: `supabase/tests/database/requirement_extraction_schema_test.sql`
- Create: `supabase/tests/database/requirement_extraction_isolation_test.sql`

- [ ] **Step 1: Generate and bind the exact migration path**

Run:

```powershell
pnpm supabase migration new requirement_extraction
$m08Migration = (Get-ChildItem supabase/migrations/*_requirement_extraction.sql | Sort-Object Name | Select-Object -Last 1).FullName
Write-Output $m08Migration
```

Expected: exactly one newly created path is printed. Record it in the task evidence and use only that exact file.

- [ ] **Step 2: Write schema and isolation RED tests before SQL behavior**

Specify:

- `requirement_extraction_runs`: scope IDs, immutable status fixed to `SUCCEEDED`, privacy classification/decision, provider/model/policy/prompt/schema versions, parse/canonical/fingerprint/accepted-output hashes, nullable provider response ID and token counts, creator/time, unique `(document_parse_id, fingerprint_sha256)`, and a scope-composite unique key.
- `requirement_candidates`: full scope plus run, order, nullable official ID, server-derived source text, interpretation, type, atomicity, provenance fixed `AI_DRAFT`, content hash, unique run/order, and scope-composite unique key.
- `requirement_candidate_source_spans`: full scope plus run/candidate/span/order, composite FKs, unique candidate/span and candidate/source order.
- A composite unique key on existing `source_spans(tenant_id, project_id, document_id, document_parse_id, id)` to enforce same-scope links.
- RLS enabled/forced; authenticated `SELECT` only through active project membership or active tenant-admin membership; anon sees zero; authenticated direct INSERT/UPDATE/DELETE denied; service role has only the DML needed by invoker functions and test cleanup.
- Existing `documents`, `document_parses`, and `source_spans` remain immutable.

- [ ] **Step 3: Run database RED**

Run: `pnpm supabase db reset`

Run: `pnpm test:rls`

Expected: reset/test FAIL at the new pgTAP assertions because tables, constraints, policies, and functions are absent. Record the assertion names and counts.

- [ ] **Step 4: Implement minimum schema and SELECT policies only**

Use PostgreSQL enums for requirement type and atomicity, fixed CHECK constraints for provenance/policy decision/hash shapes/positive limits, `ON DELETE RESTRICT`, and composite foreign keys. Do not add a vector column, mutable status, baseline ID, reviewer fields, or M09 metrics.

- [ ] **Step 5: Run schema GREEN while persistence assertions remain RED**

Run: `pnpm supabase db reset`

Run: `pnpm test:rls`

Expected: catalog/RLS/grant assertions PASS; persistence function assertions remain the only expected failures.

- [ ] **Step 6: Commit the schema slice**

Run: `git add $m08Migration supabase/tests/database/requirement_extraction_schema_test.sql supabase/tests/database/requirement_extraction_isolation_test.sql && git commit -m "feat: add isolated requirement snapshot schema"`

---

### Task 5: Atomic actor-bound persistence and safe outcome audit

**Files:**
- Modify: the exact `$m08Migration` from Task 4
- Modify: `supabase/tests/database/requirement_extraction_schema_test.sql`
- Modify: `supabase/tests/database/requirement_extraction_isolation_test.sql`

**Database interfaces:**

```sql
public.persist_requirement_extraction(
  p_actor_id uuid,
  p_document_parse_id uuid,
  p_privacy_classification public.privacy_classification,
  p_provider text,
  p_model text,
  p_policy_version text,
  p_prompt_version text,
  p_schema_version text,
  p_parse_result_sha256 text,
  p_canonical_input_sha256 text,
  p_fingerprint_sha256 text,
  p_accepted_output_sha256 text,
  p_provider_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_candidates jsonb
) returns jsonb

public.record_requirement_extraction_outcome(
  p_actor_id uuid,
  p_document_parse_id uuid,
  p_policy_decision text,
  p_outcome_code text,
  p_fingerprint_sha256 text,
  p_provider text,
  p_model text,
  p_policy_version text,
  p_prompt_version text,
  p_schema_version text,
  p_duration_ms integer
) returns void
```

- [ ] **Step 1: Finish behavioral RED assertions**

Test both functions are `SECURITY INVOKER`, have empty fixed `search_path`, and executable only by `service_role`. Test explicit initiating actor existence and active membership, roles `EDITOR|PROJECT_ADMIN|TENANT_ADMIN`, same parse/document/project/tenant scope, `PUBLIC|INTERNAL` only for persistence, exact JSON keys/types/limits, all cited ordinals resolve to the same parse, official ID exists exactly in cited originals, and `source_text` is derived from DB spans. Test malformed second candidate rolls back run/candidates/links/audit; first writer wins and repeat fingerprint returns `{runId, reused:true}` without duplicate rows; viewer/disallowed privacy/cross-project calls fail. Test safe audit events include fixed outcome, versions, hashes, provider/model, duration, and aggregate usage where available, and never source/prompt/provider body.

- [ ] **Step 2: Run RED**

Run: `pnpm supabase db reset`

Run: `pnpm test:rls`

Expected: only new function/atomicity assertions FAIL.

- [ ] **Step 3: Implement service-role-only invoker functions**

The service role supplies table privileges; the functions do not bypass RLS with `SECURITY DEFINER`. Recheck actor and scope explicitly, lock or use the unique fingerprint conflict path for first-writer idempotency, derive candidate source text inside SQL from ordered SourceSpans, insert run/candidates/links/audit in one transaction, and return `{runId,reused}`. Non-success outcomes create audit only, never a failed/blocked run row. `p_fingerprint_sha256` is nullable for policy outcomes that correctly stop before fingerprint construction.

- [ ] **Step 4: Run GREEN and advisors**

Run: `pnpm supabase db reset`

Run: `pnpm test:rls`

Run: `pnpm supabase db advisors --local --type security --level warn --fail-on error`

Run: `pnpm supabase db advisors --local --type performance --level warn --fail-on error`

Expected: all pgTAP tests PASS; both advisor result sets have no error attributable to M08.

- [ ] **Step 5: Commit**

Run: `git add $m08Migration supabase/tests/database/requirement_extraction_schema_test.sql supabase/tests/database/requirement_extraction_isolation_test.sql && git commit -m "feat: persist actor-bound requirement snapshots"`

---

### Task 6: Trusted Supabase adapters without browser secrets

**Files:**
- Modify: `src/lib/supabase/trusted-server.ts`
- Modify: `src/lib/supabase/trusted-server.test.ts`
- Create: `src/lib/requirements/trusted-requirement-extraction.ts`
- Create: `src/lib/requirements/trusted-requirement-extraction.test.ts`

**Interfaces:**

```ts
export function createTrustedSupabaseClient(): SupabaseClient;
export async function persistTrustedRequirementExtraction(input: PersistRequirementExtractionInput): Promise<{ runId: string; reused: boolean }>;
export async function recordTrustedRequirementExtractionOutcome(input: RecordOutcomeInput): Promise<void>;
```

- [ ] **Step 1: Write RED adapter tests**

Assert import is server-only; a missing `SUPABASE_BACKEND_SECRET` fails closed before HTTP; the backend key never comes from request/form values; persistence invokes `persist_requirement_extraction` with exact snake-case arguments; safe outcome invokes `record_requirement_extraction_outcome`; RPC errors become fixed internal errors without exposing response bodies. Keep every existing M07 trusted-server assertion.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/lib/supabase/trusted-server.test.ts src/lib/requirements/trusted-requirement-extraction.test.ts`

Expected: M07 tests PASS; M08 module/export assertions FAIL.

- [ ] **Step 3: Implement minimum adapters**

Export the existing private factory from `trusted-server.ts`; do not change its credentials or M07 parse RPC behavior. Put M08 mapping in its own requirement module.

- [ ] **Step 4: Run GREEN and secret scan**

Run: `pnpm test -- src/lib/supabase/trusted-server.test.ts src/lib/requirements/trusted-requirement-extraction.test.ts`

Run: `rg -n "SUPABASE_BACKEND_SECRET|OPENAI_API_KEY" src/app src/components --glob "*.tsx" --glob "*.ts"`

Expected: tests PASS; no Client Component or browser payload reads either secret.

- [ ] **Step 5: Commit**

Run: `git add src/lib/supabase src/lib/requirements/trusted-requirement-extraction* && git commit -m "feat: add trusted requirement persistence adapters"`

---

### Task 7: Policy-first idempotent extraction orchestrator

**Files:**
- Create: `src/lib/requirements/extract-requirements.ts`
- Create: `src/lib/requirements/extract-requirements.test.ts`

**Interface:**

```ts
export type ExtractRequirementsDependencies = {
	provider: RequirementAiProvider;
	findExisting(input: FindExistingRunInput): Promise<string | null>;
	persist(input: PersistRequirementExtractionInput): Promise<{ runId: string; reused: boolean }>;
	recordOutcome(input: RecordOutcomeInput): Promise<void>;
};

export async function extractRequirements(
	input: AuthorizedRequirementExtractionInput,
	deps: ExtractRequirementsDependencies,
): Promise<
	| { kind: "BLOCKED"; decision: "REVIEW_REQUIRED" | "BLOCK" }
	| { kind: "REUSED"; runId: string }
	| { kind: "CREATED"; runId: string }
	| { kind: "FAILED"; code: RequirementExtractionErrorCode }
>;
```

- [ ] **Step 1: Write deterministic fake-provider RED tests**

Assert policy runs first; `PERSONAL|SENSITIVE|RESTRICTED|unknown` calls neither provider nor persistence; blocked/review outcomes create safe audit only. For allowed input, assert canonical fingerprint prelookup happens before provider; an existing run returns `REUSED` with zero provider calls; new input makes exactly one provider call; validated output is persisted once; provider refusal/incomplete/network/config/invalid/oversized output produces fixed `FAILED`, safe audit, and no snapshot. Assert the injection-shaped fixture remains plain input and cannot add calls or alter dependencies.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/lib/requirements/extract-requirements.test.ts`

Expected: FAIL because the orchestrator does not exist.

- [ ] **Step 3: Implement the minimum orchestration order**

Order must be: policy → canonical input/limit → fingerprint prelookup → provider → strict output validation/mapping → atomic persist. Catch only known boundary errors, record fixed safe outcomes best-effort without replacing the primary code, and never retry in M08.

- [ ] **Step 4: Run GREEN and affected unit suite**

Run: `pnpm test -- src/lib/requirements src/lib/ai src/lib/supabase/trusted-server.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/lib/requirements && git commit -m "feat: orchestrate safe requirement extraction"`

---

### Task 8: Deterministic stub and authenticated vertical route

**Files:**
- Create: `tests/e2e/support/openai-responses-stub.mjs`
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/support/local-supabase.ts`
- Create: `tests/e2e/rfp-requirement-extraction.spec.ts`
- Create: `src/app/projects/[projectId]/requirements/extract/route.ts`
- Create: `src/lib/requirements/requirement-queries.ts`
- Modify: `src/app/projects/[projectId]/rfp/page.tsx`
- Modify: `src/app/projects/[projectId]/documents/[documentId]/source/page.tsx`
- Optionally modify: `fixtures/synthetic/rfp-mini.json`, only with explicit synthetic expected values.

- [ ] **Step 1: Add the local Responses stub and harness only**

The loopback server exposes `/health`, test-only `/__reset`, `/__state`, `/__mode`, and `/v1/responses`. It validates `store:false`, strict schema, no tools, and returns three deterministic candidates tied to synthetic SourceSpan ordinals. Modes are `success`, `refusal`, `incomplete`, and `invalid`. State exposes call count and request metadata hashes, never the full input.

Configure two Playwright web servers: stub on `127.0.0.1:4319`, then Next with server-only `OPENAI_API_KEY=synthetic-openai-key`, `OPENAI_REQUIREMENT_MODEL=synthetic-requirement-model`, `GOV_PROJECT_OS_OPENAI_RESPONSES_URL=http://127.0.0.1:4319/v1/responses`, and `GOV_PROJECT_OS_ALLOW_TEST_OPENAI_URL=1`. Extend cleanup in link → candidate → run → span → parse order.

- [ ] **Step 2: Write the route/UI E2E RED**

Drive real Auth and local Supabase: upload synthetic TXT → parse → see `추출 가능` → submit the one authoritative `documentParseId` → see `AI 초안 생성 완료` and result link. Assert POST form has no source text, provider, endpoint, model, tenant/project/document ID, privacy decision, or backend secret. Repeat extraction and assert same run plus stub call count 1. Assert viewer cannot see the action, forged/cross-project IDs return 404, and anonymous users reach login. Update SourceSpan copy to say allowed content may be sent server-side only after policy and authorization checks.

- [ ] **Step 3: Run RED**

Run: `pnpm test:e2e -- tests/e2e/rfp-requirement-extraction.spec.ts`

Expected: FAIL because the route/control do not exist; the stub itself is healthy.

- [ ] **Step 4: Implement minimum authorized POST and RFP states**

The route parses only `documentParseId`, reads the session claims, rereads parse/document/spans with the caller's RLS client, checks `EDITOR|PROJECT_ADMIN|TENANT_ADMIN`, uses 404 for missing/cross/insufficient scope, creates the production provider server-side, and injects an identical-run lookup implemented with that same caller's RLS client. It then calls the orchestrator and redirects with fixed PRG state. The RFP page renders these exact text states:

- `추출 가능`
- `개인정보 검토 필요 — AI에 전송하지 않음`
- `정책상 AI 전송 차단`
- `AI 초안 생성 완료`
- `동일 설정의 기존 결과 재사용`
- `AI 서비스 일시 실패 — 저장된 후보 없음`

- [ ] **Step 5: Run GREEN and privacy/failure modes**

Run: `pnpm test:e2e -- tests/e2e/rfp-requirement-extraction.spec.ts`

Expected: authorized success/idempotency/isolation PASS. Create separate synthetic documents with `PERSONAL`, `SENSITIVE`, and `RESTRICTED` classifications at upload/fixture-creation time without mutating existing document metadata, then assert stub call count remains zero and no run/candidate/link exists. Exercise refusal/incomplete/invalid modes and assert no snapshot and no raw provider message in UI/audit.

- [ ] **Step 6: Commit**

Run: `git add playwright.config.ts tests/e2e fixtures/synthetic src/app/projects src/lib && git commit -m "feat: add requirement extraction vertical flow"`

---

### Task 9: Read-only candidates and SourceSpan evidence

**Files:**
- Create: `src/app/projects/[projectId]/requirements/[runId]/page.tsx`
- Modify: `src/app/projects/[projectId]/rfp/page.tsx`
- Modify: `src/app/projects/[projectId]/documents/[documentId]/source/page.tsx`
- Modify: `tests/e2e/rfp-requirement-extraction.spec.ts`

- [ ] **Step 1: Write evidence-view RED tests**

Assert the result shows `AI 초안`, official ID or `식별자 없음`, interpretation, fixed type/atomicity text, and every cited immutable source excerpt with its location. Each evidence link has an accessible name containing candidate/official-ID and SourceSpan context and targets a stable `span-{id}` anchor on the immutable source page. Assert source text equals DB-derived original text, not provider text. Assert there are no edit/approve/reject/baseline controls, viewer may read own-project results, cross-project member and anonymous user cannot, and request scope mismatch returns 404.

- [ ] **Step 2: Run RED**

Run: `pnpm test:e2e -- tests/e2e/rfp-requirement-extraction.spec.ts`

Expected: creation flow PASS; result-page assertions FAIL because the page does not exist.

- [ ] **Step 3: Implement the minimum RLS-backed read-only page**

Query run → ordered candidates → ordered link/SourceSpan evidence through the authenticated server client. Use headings, definition lists, ordered lists, and plain text. Add stable SourceSpan anchors without changing source content. Render no `dangerouslySetInnerHTML` and no client hydration for source content.

- [ ] **Step 4: Run GREEN and commit**

Run: `pnpm test:e2e -- tests/e2e/rfp-requirement-extraction.spec.ts tests/e2e/rfp-parse.spec.ts`

Expected: PASS.

Run: `git add src/app/projects tests/e2e/rfp-requirement-extraction.spec.ts && git commit -m "feat: show requirement evidence snapshots"`

---

### Task 10: Accessibility and explicit no-call verification

**Files:**
- Create: `tests/a11y/rfp-requirement-extraction.spec.ts`
- Modify as RED requires: M08 route/page/UI files only.

- [ ] **Step 1: Write accessibility RED**

Test editor keyboard access from RFP page to extraction and result, one clear page heading, named action, minimum target size, textual status not color-only, `role=status` for success, `role=alert` for blocking/failure, candidate article/list structure, SourceSpan evidence link names/locations, visible focus after navigation, and axe with no serious/critical violations. Test viewer read-only navigation. Include blocked privacy state and ensure there is no enabled extraction control.

- [ ] **Step 2: Run RED**

Run: `pnpm test:a11y -- tests/a11y/rfp-requirement-extraction.spec.ts`

Expected: at least one new semantic/focus/status assertion fails before the minimum accessibility fix.

- [ ] **Step 3: Implement only the failing semantic/focus changes**

Prefer server-rendered semantic HTML and existing focus styles. Do not add a UI framework.

- [ ] **Step 4: Run GREEN plus no-call E2E**

Run: `pnpm test:a11y -- tests/a11y/rfp-requirement-extraction.spec.ts tests/a11y/rfp-source-span.spec.ts`

Run: `pnpm test:e2e -- tests/e2e/rfp-requirement-extraction.spec.ts`

Expected: PASS, including stub call count zero for all non-ALLOW decisions.

- [ ] **Step 5: Commit**

Run: `git add tests/a11y src/app/projects && git commit -m "test: verify accessible requirement extraction"`

---

### Task 11: Full verification, security review, evidence, and M09 Gate

**Files:**
- Modify: `docs/goal/GOAL_STATE.md`
- Modify: `docs/goal/VERIFICATION_LOG.md`
- Modify: `docs/goal/DECISIONS.md`
- Modify: `docs/goal/HUMAN_CHECKPOINTS.md`
- Modify: this plan's checkboxes with actual RED/GREEN evidence.

- [ ] **Step 1: Run fresh source and dependency policy scans**

Run:

```powershell
rg -n "OPENAI_API_KEY|SUPABASE_BACKEND_SECRET|service_role" src/app src/components --glob "*.ts" --glob "*.tsx"
rg -n "Redis|Neo4j|Elasticsearch|Kubernetes|LangChain|LlamaIndex|Hyperdrive|Cloudflare Access|vector database" package.json pnpm-lock.yaml src supabase
rg -n "실제 고객|주민등록번호|restricted customer" fixtures tests --glob "!**/node_modules/**"
git diff 185aa06..HEAD -- package.json pnpm-lock.yaml
```

Expected: no browser secret use, no banned infrastructure/dependency, no real customer data, and no unapproved dependency addition.

- [ ] **Step 2: Run the fresh full automated matrix**

Run each command separately and record exit code/counts:

```powershell
pnpm audit --audit-level=high
pnpm typecheck
pnpm lint
pnpm test
pnpm test:eval
pnpm supabase db reset
pnpm test:rls
pnpm supabase db lint --level warning
pnpm supabase db advisors --local --type security --level warn --fail-on error
pnpm supabase db advisors --local --type performance --level warn --fail-on error
pnpm test:e2e
pnpm test:a11y
pnpm build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-workers-preview.ps1
```

The tracked Workers verification script performs the bounded Linux OpenNext build, HTTP 200 probe, and exact cleanup. Expected: every command PASS; no high/critical audit finding; local OpenAI stub is deterministic and no live key is required.

- [ ] **Step 3: Run focused negative/security checks**

Freshly verify: built browser assets contain neither secret; production rejects loopback/custom Responses endpoint; viewer/cross-project/anonymous writes fail; non-ALLOW policy makes zero provider calls; direct authenticated table DML/RPC execution fails; malformed provider output creates no partial rows and the trusted transaction proves full rollback; source injection remains inert; audit contains no raw source/prompt/provider body; original object bytes/hash plus M07 parse/source rows remain unchanged.

Run after the production build: `rg -n "synthetic-openai-key|OPENAI_API_KEY|SUPABASE_BACKEND_SECRET|service_role" .next/static .open-next --glob "*.js" --glob "*.json"`

Expected: no match. If a real OpenAI credential is present in a controlled server environment, an optional synthetic-data live smoke may be run without logging input/output content; otherwise record `SKIPPED — no controlled live credential`. It is not required for the deterministic M08 Gate.

- [ ] **Step 4: Run Codex Security diff scan**

Use the installed `codex-security:security-diff-scan` skill against `185aa06..HEAD`, validate any candidate finding, fix confirmed in-scope issues with new RED tests, and rerun affected plus full verification. Record scope and any coverage limitation. Do not claim a clean scan without sealed output.

- [ ] **Step 5: Record evidence and set the Gate**

Update goal documents with exact commands, timestamps, exit codes, test counts, migration path, commit IDs, known limitations, and security-scan result. Set M08 `COMPLETE` only if all evidence is fresh; set current milestone to `M09 Eval Harness — WAITING FOR USER GATE`; do not start M09.

- [ ] **Step 6: Commit evidence and verify the commit**

Run: `git add docs/goal docs/superpowers/plans/2026-08-25-m08-requirement-extraction-plan.md && git commit -m "docs: record m08 verification"`

Run: `git status --short`

Run: `git log -1 --oneline`

Expected: clean worktree and the evidence commit at `HEAD`.

## Implementation Completion Gate

M08 is complete only when all Task 1–11 checkboxes have observed RED/GREEN evidence, immutable/isolated snapshots pass pgTAP, non-ALLOW privacy decisions prove zero provider calls, deterministic E2E and accessibility pass, production endpoint restrictions pass, no secrets enter browser output, Workers preview responds, the security diff scan is sealed, and fresh evidence is committed. Then stop and wait for the user's explicit M09 instruction.
