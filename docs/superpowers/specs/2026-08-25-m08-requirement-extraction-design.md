# M08 Requirement Extraction Design

- Status: Draft for written-spec approval
- Date: 2026-08-25
- Milestone: M08 — Requirement Extraction
- Prior milestone: M07 — Trusted Parser Boundary
- Next milestone after the M08 gate: M09 — Requirement Extraction Eval

## 1. Decision summary

M08 adds one Lean vertical slice: an authorized project member can request requirement extraction from an immutable, trusted M07 parse and then read an immutable set of AI-draft requirement candidates linked to exact SourceSpans.

The slice uses a stateless, server-only AI Gateway and an OpenAI provider. A deterministic privacy gate runs before any provider call. The model returns only structured interpretations and SourceSpan ordinals; the server validates those ordinals, resolves the actual SourceSpan identifiers, and derives quoted source text from immutable originals before one atomic trusted persistence operation.

M08 does not create canonical requirements, accept human verification, or create a Requirement Baseline. Those responsibilities remain in M10 and M11. M09 owns quantitative extraction evaluation.

## 2. Lifecycle fit and scope boundary

GOV Project OS keeps its full lifecycle:

`사업기회 → RFP 업로드 → RFP 분석 / SourceSpan → Atomic Requirement → Eval → Human Verified Requirement Baseline → 제안기획 / Compliance Matrix / 제안서 → 평가 / 기술협상 → Contract Baseline → 사업수행계획 → WBS / 산출물 → 회사·고객 Template 기반 산출물 생성 → 회의 / 회의록 → Decision / Action / Issue / 고객요청 → Risk / Issue / Change → 검사 / 감리 / Evidence → Acceptance → Closeout / 인수인계 / 보안종료 → Lessons Learned → Knowledge Reuse / 차기사업`

Requirement extraction is an early lifecycle capability and never the final product scope. M08 preserves that direction while implementing only the smallest trustworthy end-to-end extraction slice.

### In scope

- Start extraction from an immutable successful M07 `document_parse`.
- Enforce document privacy policy before contacting OpenAI.
- Treat all parsed document content as untrusted data.
- Obtain strict structured requirement candidates through the server AI Gateway.
- Validate all provider output at the server trust boundary.
- Persist one immutable, idempotent extraction snapshot atomically.
- Let assigned project members read AI-draft candidates and their source evidence.
- Provide explicit Korean status, error, blocked, and reused-result states.
- Verify tenant/project isolation, no-partial-write behavior, prompt-injection resistance, and accessibility.

### Out of scope

- M09 extraction quality scoring and threshold calibration.
- M10 candidate edit, review, rejection, approval, or HUMAN_VERIFIED promotion.
- M11 Requirement Baseline creation or mutation.
- Automatic changes to any baseline or downstream lifecycle artifact.
- Background infrastructure, retries, or distributed queues.
- Redaction of personal information; no verified redactor exists in M08.
- A second AI provider, agent framework, vector database, or other prohibited infrastructure.

## 3. Governing invariants

1. Original source remains immutable and separate from AI interpretation.
2. Every stored candidate cites one or more SourceSpans from the same immutable parse.
3. All M08 candidates remain `AI_DRAFT`; M08 never creates `HUMAN_VERIFIED` facts.
4. A future `HUMAN_VERIFIED` fact must retain SourceSpan provenance.
5. The extraction snapshot is immutable after successful persistence.
6. Tenant and project reads are isolated with RLS; privileged writes use a narrowly granted trusted RPC that rechecks the initiating actor.
7. OpenAI and Supabase backend secrets remain server-only and never enter browser bundles, responses, logs, or audit metadata.
8. OpenAI is called only through the server AI Gateway.
9. Real or restricted customer material is never used in Git fixtures.
10. Prompt or document instructions cannot change system policy, select tools, disclose secrets, or cause side effects.

## 4. Roles and authorization

| Role | Start extraction | Read project extraction results |
| --- | --- | --- |
| `TENANT_ADMIN` | Yes, within its tenant | Yes, within its tenant |
| `PROJECT_ADMIN` | Yes, within an assigned project | Yes, within an assigned project |
| `EDITOR` | Yes, within an assigned project | Yes, within an assigned project |
| `REVIEWER` | No | Yes, within an assigned project |
| `VIEWER` | No | Yes, within an assigned project |

The route first validates authenticated claims and then rereads the document, parse, and SourceSpans through the request user's RLS-scoped client. A missing resource and an unauthorized resource both return the existing not-found behavior so cross-project existence is not disclosed.

The browser submits only the trusted `documentParseId`. It cannot submit tenant identifiers, project identifiers, source text, prompt text, provider choice, model choice, privacy overrides, actor identifiers, or persistence data as authoritative values.

## 5. Privacy policy

The document's server-read privacy classification is evaluated before fingerprint lookup that could reveal another result and before any provider call.

| Classification | Conceptual policy | M08 behavior | Provider calls |
| --- | --- | --- | --- |
| `PUBLIC` | `ALLOW` | Extract | One, unless an identical snapshot is reused |
| `INTERNAL` | `ALLOW` | Extract | One, unless an identical snapshot is reused |
| `PERSONAL` | `ALLOW_AFTER_REDACTION` | `REVIEW_REQUIRED`; do not extract | Zero |
| `SENSITIVE` | `BLOCK` | Block | Zero |
| `RESTRICTED` | `BLOCK` | Block | Zero |
| Missing, unknown, or ambiguous | Never infer allow | Block or require review | Zero |

M08 does not claim that personal data has been redacted. Introducing a redactor later requires its own verified behavior, tests, policy decision, and, when infrastructure changes, an ADR with measured evidence.

## 6. Trust-boundary architecture

```text
Browser
  | documentParseId only
  v
Authenticated Next.js server route
  | claims + RLS resource reread + role check
  v
Deterministic privacy gate
  | ALLOW only
  v
Extraction orchestrator
  | canonical source envelope + untrusted-input boundary
  v
Server-only AI Gateway
  | OpenAI Responses API, store:false, strict schema, no tools
  v
Provider-output validator
  | schema, limits, ordinals, official-ID evidence, hashes
  v
Trusted server persistence client
  | service-role-only atomic RPC + initiating-actor recheck
  v
Immutable run + candidates + candidate/SourceSpan links + audit metadata
```

### Browser boundary

- No OpenAI API key or Supabase backend secret is exposed through `NEXT_PUBLIC_*`, serialized props, route responses, logs, error messages, source maps, or browser code.
- Browser input cannot alter the prompt, model, provider, system policy, output schema, or trusted persistence payload.
- Client-side checks are usability only; server and database checks are authoritative.

### Server AI Gateway

- `AIProvider` is a small server-only interface owned by GOV Project OS.
- The production factory creates only the OpenAI implementation in M08.
- The request is stateless and uses `store: false`.
- The provider receives no tools and cannot initiate external actions.
- Structured Outputs defines a closed schema and rejects free-form fallback data.
- The prompt and schema carry explicit version identifiers that participate in the extraction fingerprint.
- Source material is enclosed as untrusted data with stable span ordinals. Instructions found inside it have no authority.
- The full accepted input is sent or the request fails before the provider call; M08 never silently truncates source material.

### Test provider boundary

- Unit and integration tests inject an `AIProvider` dependency into the orchestrator or handler.
- Browser input cannot enable a fake provider.
- HTTP contract tests use a local synthetic OpenAI stub configured only by server-side test settings.
- Production configuration accepts the fixed official OpenAI endpoint; non-official or non-HTTPS endpoints are rejected in production.
- A real OpenAI credential is not fabricated or committed. When one exists in a controlled server environment, a synthetic-data live smoke test may be run without logging source content.

## 7. Canonical provider input

The orchestrator constructs a deterministic envelope from the server-read parse:

- document and parse identifiers are internal correlation data and need not be sent to the provider;
- parse hash and parser version establish the immutable source snapshot;
- each source entry has a stable ordinal, location metadata needed for interpretation, and normalized text;
- original source bytes never come from the browser;
- the extraction instructions state that source entries are evidence, not instructions;
- an explicit maximum input size is checked before the call;
- order, newline normalization, and serialization are deterministic so the same trusted inputs produce the same fingerprint.

The model returns referenced source ordinals, not database identifiers and not quoted evidence. The server maps accepted ordinals to actual `source_spans.id` values and derives every stored `source_text` value from `source_spans.original_text`.

## 8. Structured candidate contract

Each provider candidate contains only the fields needed for M08 interpretation:

- optional `officialId`;
- an interpretation;
- a requirement type from the schema-versioned closed vocabulary;
- atomicity: exactly `ATOMIC`, `COMPOSITE`, or `REVIEW_REQUIRED`;
- one or more unique SourceSpan ordinals.

Rules:

- Missing official identifiers remain `null`; the model and server never invent one.
- A returned official identifier is accepted only if the exact identifier occurs in at least one cited immutable original SourceSpan.
- Ambiguous requirement type is stored as the closed vocabulary's `OTHER` value and remains reviewable; no new free-form type is accepted.
- Empty evidence, unknown ordinals, duplicate candidate order, cross-parse evidence, output-size overflow, candidate-count overflow, or schema mismatch rejects the entire extraction.
- Candidate order is deterministic within the run and forms part of snapshot identity.
- Server validation is authoritative even when the provider reports schema conformance.

## 9. Immutable data model

### `requirement_extraction_runs`

One row represents one successfully persisted extraction snapshot. It includes:

- tenant, project, document, and `document_parse` scope;
- policy decision and privacy classification observed by the trusted transaction;
- model, provider, prompt, schema, and policy versions;
- parse, canonical-input, request/fingerprint, and accepted-output hashes;
- provider response identifier when safely available;
- aggregate token usage metadata without raw source;
- initiating actor and creation timestamp;
- immutable success state.

No failed or blocked provider attempt creates a run row. Operational outcomes are represented in safe audit metadata rather than as a misleading extraction snapshot.

### `requirement_candidates`

Each row belongs to exactly one run and includes:

- stable candidate order;
- nullable official identifier;
- server-derived source text;
- AI interpretation;
- closed requirement type;
- closed atomicity value;
- provenance state fixed to `AI_DRAFT`;
- deterministic content hash.

### `requirement_candidate_source_spans`

This ordered join records one or more SourceSpans for each candidate. Database constraints and the trusted transaction ensure that every linked span belongs to the same parse as the run and candidate.

### Immutability and idempotency

- Authenticated and anonymous roles receive no direct insert, update, or delete grants on these tables.
- No application update/delete path is introduced for run, candidate, or evidence-link rows.
- The extraction fingerprint covers tenant/project/document/parse identity, parse hash, privacy-policy version, prompt version, schema version, provider/model configuration, and canonical-input hash.
- An authorized identical request reuses the already committed snapshot and does not call the provider again.
- A uniqueness constraint prevents concurrent identical snapshots.
- A race that discovers a concurrently committed identical snapshot returns that snapshot rather than duplicating it.

## 10. RLS and trusted persistence

All M08 tables in an exposed schema have RLS enabled. Explicit Data API grants and RLS policies are treated as separate controls.

- Assigned project members and authorized tenant administrators can select rows in their scope.
- Anonymous and cross-project reads return zero rows.
- No authenticated direct write policy exists.
- Public, anonymous, and authenticated execution is revoked from the trusted persistence function.
- Only the server backend role can execute the trusted function.
- The function is `SECURITY INVOKER`; the invoking server backend role supplies its privileges, so M08 introduces no `SECURITY DEFINER` bypass.
- The function receives the initiating user identifier from the trusted server but does not trust it blindly: it rechecks user existence, active membership, role, tenant/project/document/parse scope, current privacy classification, and same-parse SourceSpans inside the transaction.
- Privileged function search paths and grants are explicit.
- All rows, links, and the success audit event commit together or all roll back.

The privileged operation follows ADR-0002: a separate server-only Supabase secret client calls a narrowly scoped service-role-only RPC, and the RPC explicitly reauthorizes the initiating actor.

## 11. End-to-end flow

1. An authorized user activates requirement extraction for a successful parse.
2. The route validates claims and rereads the document, parse, and SourceSpans through RLS.
3. The route returns the same not-found behavior for missing resources, cross-project resources, and users without an initiating role so it does not disclose resource existence or role details.
4. The privacy gate determines `ALLOW`, `REVIEW_REQUIRED`, or `BLOCK`.
5. Review-required and blocked requests stop with zero provider calls and safe audit metadata.
6. The orchestrator builds and size-checks the canonical untrusted-source envelope.
7. It calculates the deterministic fingerprint and reuses an authorized identical snapshot when one exists.
8. The server AI Gateway calls OpenAI with stateless strict Structured Outputs and no tools.
9. The server validates completion state, refusal state, schema, counts, lengths, ordinals, official-ID evidence, and hashes.
10. The server maps ordinals to actual SourceSpans and derives quoted source text from originals.
11. One trusted RPC rechecks actor, role, scope, parse, privacy policy, and candidate evidence and persists the full immutable snapshot atomically.
12. A Post/Redirect/Get response leads to a read-only candidate page and explicit visible status.

The synchronous in-process operation is the M08 `InlineJobQueue`. It introduces no new infrastructure. Measurements from this slice can later justify an ADR if duration, failure, or concurrency data proves a queue is necessary.

## 12. Error and audit behavior

| Condition | User-visible outcome | Persistence |
| --- | --- | --- |
| Policy allows and extraction succeeds | `AI 초안 생성 완료` | One immutable snapshot |
| Identical accepted fingerprint exists | `동일 설정의 기존 결과 재사용` | No duplicate; no provider call |
| Personal data needs redaction review | `개인정보 검토 필요 — AI에 전송하지 않음` | No extraction snapshot |
| Sensitive, restricted, or ambiguous block | `정책상 AI 전송 차단` | No extraction snapshot |
| Input exceeds configured limit | Clear review/error state; no silent truncation | No extraction snapshot |
| Provider configuration missing | Safe service-unavailable state | No extraction snapshot |
| Provider refusal, incomplete response, timeout, network/rate error | `AI 서비스 일시 실패 — 저장된 후보 없음` | No extraction snapshot |
| Invalid output or invalid evidence | Safe validation-failure state | No extraction snapshot |
| Trusted transaction rejects data | Safe persistence-failure state | Full rollback |

Audit events distinguish allowed success, reuse, policy review/block, provider failure, validation failure, and persistence rejection. They include identifiers, versions, hashes, policy outcome, timing, aggregate usage, and safe error categories. They exclude raw source, normalized source, prompt bodies, provider response bodies, API keys, tokens, and customer content.

## 13. Read-only UI and accessibility

The project RFP workspace shows one of these visible text states:

- `추출 가능`
- `개인정보 검토 필요 — AI에 전송하지 않음`
- `정책상 AI 전송 차단`
- `AI 초안 생성 완료`
- `동일 설정의 기존 결과 재사용`
- `AI 서비스 일시 실패 — 저장된 후보 없음`

The results page clearly separates:

- source evidence quoted from immutable original SourceSpans;
- AI interpretation;
- requirement type;
- atomicity assessment;
- visible `AI 초안` provenance status.

Each evidence link has an accessible name containing the candidate or official identifier and SourceSpan context. Status is never conveyed by color alone. Critical controls are semantic buttons or links, have visible labels and focus, remain keyboard operable, and meet the project's minimum target size. Success uses an appropriate status announcement; blocking and failure use an appropriate alert. Heading structure and landmarks make original evidence and AI interpretation distinguishable to assistive technology.

The existing SourceSpan explanation is updated during implementation to state accurately that source is sent server-side only when an explicit privacy policy permits extraction.

## 14. Test-first implementation contract

Every listed production behavior begins with a failing test whose expected failure is observed before the minimum implementation.

### 14.1 Domain and privacy RED tests

- `PUBLIC` and `INTERNAL` allow extraction.
- `PERSONAL` returns review-required and the provider call count stays zero.
- `SENSITIVE` and `RESTRICTED` block and the provider call count stays zero.
- Missing or ambiguous classification never becomes allow.

### 14.2 Gateway, injection, and validation RED tests

- A canonical synthetic RFP produces the expected candidate structure and cited span ordinals.
- A synthetic prompt-injection passage remains inert data and cannot change policy, tools, schema, provider, or secret handling.
- Invalid schema, refusal, incomplete output, unknown/empty/cross-parse evidence, invented official identifier, excessive count/length, missing configuration, network failure, and rate failure persist zero candidates.
- Stored source text is server-derived from immutable original spans rather than trusted from the model.
- An identical fingerprint reuses one snapshot and provider call count remains one.
- The OpenAI HTTP adapter sends `store: false`, the approved strict schema, no tools, and the server-selected model to the local contract stub.

### 14.3 Database and RLS RED tests

- New tables have RLS and only the intended explicit read grants.
- Own-project members and tenant administrators read permitted rows.
- Anonymous and cross-project users read zero rows.
- Authenticated direct inserts, updates, deletes, and direct trusted-RPC execution are denied.
- The trusted RPC rejects an inactive actor, insufficient role, wrong tenant/project/document/parse, disallowed privacy state, missing evidence, and cross-parse evidence.
- A malformed candidate or link causes full rollback.
- Every candidate has at least one same-parse SourceSpan.
- Committed snapshots cannot be updated or deleted through application roles.
- Audit records contain no source, prompt body, provider body, or secret.

### 14.4 Browser and accessibility RED tests

- Synthetic upload and parse lead through extraction to the read-only candidate/evidence view using the server-side test provider boundary.
- Personal, sensitive, and restricted fixtures show accurate no-send states with zero provider calls.
- A viewer cannot initiate extraction but can read assigned-project results.
- Cross-project resources remain hidden.
- Keyboard activation, accessible names, focus visibility, text status, and alert/status announcements are verified.
- Automated WCAG A/AA checks report zero violations on the critical M08 flow.
- Original document bytes, parse rows, and SourceSpans are unchanged after extraction.

M08 keeps the existing Eval foundation passing but does not pre-implement M09's completeness, fidelity, unsupported-claim, atomicity, type, and citation-quality scorecard.

## 15. Verification and completion gate

M08 can be called complete only with fresh evidence that proves all of the following:

- Privacy policy executes before the provider and disallowed cases call it zero times.
- The OpenAI adapter is server-only, stateless, strict-schema, tool-free, and covered by an exact HTTP contract test.
- Browser assets and committed files contain no OpenAI or Supabase backend secret.
- Every accepted candidate has server-resolved same-parse SourceSpan evidence and server-derived original source text.
- Prompt injection remains inert.
- Invalid, refused, incomplete, or failed generations create no partial snapshot.
- RLS gives unauthorized and cross-project users zero rows; direct application-role writes are denied.
- Successful results are immutable, atomic, and idempotent.
- The read-only flow is keyboard operable and has no automated WCAG A/AA violations.
- Original documents, parses, and SourceSpans remain unchanged.
- No real customer-restricted fixture or prohibited infrastructure was introduced.

Fresh verification includes the repository's affected and full gates:

- targeted unit and integration tests with recorded RED then GREEN evidence;
- local database reset and complete RLS suite;
- existing Eval suite;
- browser E2E and accessibility suites;
- type checking, linting, full unit tests, production build, and Cloudflare Workers/OpenNext preview;
- dependency audit at the agreed severity threshold;
- secret, fixture, and prohibited-infrastructure scans;
- Supabase security/performance advisors;
- a Codex Security diff scan of M08 changes.

Workers preview may run in the established tracked-source Linux container when the Windows host cannot complete it reliably. The verification record must state exact commands, results, skips, environmental limits, and any conditional live OpenAI smoke status without overstating coverage.

## 16. Source basis

- OpenAI Responses API creation parameters, including stateless storage control: <https://developers.openai.com/api/reference/cli/resources/responses/methods/create>
- OpenAI Structured Outputs guide: <https://developers.openai.com/api/docs/guides/structured-outputs>
- Supabase change notice that table Data API exposure and grants require explicit attention: <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>
- Supabase Data API security and RLS guidance: <https://supabase.com/docs/guides/api/securing-your-api>

## 17. Approval record and next gate

The user approved these design sections in order:

1. M08 architecture.
2. M08 data model.
3. M08 data flow.
4. M08 verification design.

This document consolidates those approvals. No production implementation or implementation plan begins until the user approves this written specification. After written-spec approval, the next action is to create the TDD implementation plan; implementation still starts only within M08 and cannot advance to M09 without the M08 completion gate.
