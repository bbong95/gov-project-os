# M07 Parser / SourceSpan Design

## Purpose

M07 extends the M06 private-original flow into deterministic parsing and immutable source evidence:

```text
Private RFP original
→ server-side format validation
→ DocumentParser
→ immutable parse snapshot
→ immutable SourceSpan
→ authorized source review
```

This milestone creates the provenance boundary that M08 requirement candidates and every later HUMAN_VERIFIED factual item can cite. It does not extract requirements, call AI, create a Requirement Baseline, or narrow the full GOV Project OS lifecycle.

## Scope

- A stable `DocumentParser` interface and one parser registry.
- A production plain-text parser for strict UTF-8 TXT originals.
- A disposable kordoc compatibility spike against the actual Cloudflare Workers/OpenNext target.
- A kordoc adapter only for formats that pass an exact-version synthetic fixture, Workers bundle, and Workers runtime smoke matrix.
- Immutable `document_parses` and `source_spans` records with tenant/project RLS.
- Server-side parsing through the authenticated user's Supabase session and private Storage access.
- A keyboard-operable parse action, textual status, and source evidence view.
- Synthetic contract, unit, database, RLS, E2E, accessibility, security, build, and Workers runtime verification.

Out of scope for M07: OCR, AI calls, Requirement extraction, prompt schemas, Eval scoring behavior, HUMAN_VERIFIED approval, baselines, background queues, document replacement, parser microservices, and every later lifecycle workflow.

The M06 upload allowlist remains unchanged. An uploaded document can remain safely stored and downloadable even when its format is not yet production-parseable. Unsupported parsing is an explicit state, not a reason to mutate or discard the original.

## Considered Approaches

### 1. Plain-text reference flow plus a kordoc compatibility gate — selected

TXT provides an exact, deterministic location and hashing contract without adding runtime uncertainty. The same M07 milestone probes kordoc against the real Workers target. Each binary format becomes production-supported only after its own synthetic fixture passes the parser contract, OpenNext Workers build, and Workers runtime parse smoke.

This preserves Lean sequencing without redefining the final document scope around TXT. The adapter boundary, persistence model, UI, RLS, and evidence rules are shared by all later parser formats.

### 2. Add every kordoc format immediately — rejected

Kordoc 4.9.1 exposes HWP/HWPX/PDF/XLS(X)/DOCX parsing, but its root module imports Node APIs and its optional PDF/OCR paths include native or large dependencies. Cloudflare's current compatibility date supports many Node APIs, but import compatibility alone does not prove bundling or runtime behavior. Marking every format supported before per-format runtime evidence would create a false production claim.

### 3. Add a dedicated parser service — rejected

No measured failure yet justifies a microservice. If kordoc cannot run in Workers, M07 records the exact build/runtime failure, a compatibility matrix, and an ADR draft. It continues with formats that work in the current architecture and does not add new infrastructure.

## Parser Boundary

The application contract is independent of kordoc and any future parsing library:

```ts
interface DocumentParser {
  supports(mimeType: string): boolean;
  parse(input: ParseInput): Promise<ParsedDocument>;
}
```

`ParseInput` contains the immutable document ID, original filename, canonical media type, original SHA-256, and bytes downloaded from private Storage. `ParsedDocument` contains the parser key and version, detected format, warnings, and an ordered non-empty list of parsed source spans.

`supports(mimeType)` is a routing hint, not evidence that the upload header was truthful. The server resolves a canonical format from the immutable filename plus byte-level validation. Every adapter validates its own input again and fails closed on a mismatch. A client-supplied `media_type` never selects a parser by itself.

The registry initially contains `PlainTextDocumentParser`. A `KordocDocumentParser` is registered only after the compatibility gate passes for at least one binary format. No second implementation is created merely for extensibility.

## Plain-Text Parsing Contract

The TXT adapter:

1. accepts only the canonical `text/plain` route for a `.txt` original;
2. decodes UTF-8 with fatal error handling;
3. treats an initial UTF-8 BOM as an encoding marker rather than source text and records that deterministic rule in the parser version;
4. divides the document into maximal non-blank paragraph spans while retaining each span's exact decoded substring and internal line endings;
5. records one-based `lineStart` and `lineEnd` locations;
6. rejects a document that produces no non-whitespace source span;
7. never rewrites the stored original document.

`originalText` is the exact parser-emitted substring. `normalizedText` is derived separately by Unicode NFC normalization, CRLF/CR-to-LF normalization, trimming each line's surrounding horizontal whitespace, and removing surrounding blank lines. Normalization never replaces `originalText` and is versioned with the parser.

Each span hash is lowercase SHA-256 over the UTF-8 bytes of `originalText`. Stable hashing therefore proves the extracted evidence text, while the document's existing SHA-256 continues to prove the immutable binary original.

## Source Location Contract

Locations are a discriminated JSON object so the model can express real source precision without inventing unavailable coordinates:

```text
TEXT_LINES  → lineStart, lineEnd
PAGE        → pageNumber, optional blockIndex, pageMode
SHEET       → sheetIndex, optional sheetName, optional cellRange
SECTION     → sectionIndex, optional label, optional blockIndex
```

All numeric positions are one-based positive integers. Every span has exactly one location kind. Optional values are omitted when the parser cannot prove them.

For kordoc, SourceSpan text comes from structured parser blocks rather than rendered Markdown, because Markdown markers are interpretation added by the renderer. Page numbers, page-boundary quality, sheet identity, and cell ranges are stored only when the parsed result actually exposes them. A section approximation is labelled as such and is never presented as an exact page.

## Kordoc Compatibility Gate

The spike uses an exact kordoc version and synthetic, non-customer fixtures. It is throwaway investigation until it passes. The report is persisted under `docs/compatibility/` and contains:

- kordoc and Node versions;
- installed optional-dependency mode;
- current Workers compatibility date and flags;
- OpenNext bundle result and relevant bundle-size evidence;
- actual Workers runtime parse result;
- per-format fixture, detected format, location precision, warnings, and outcome;
- dependency audit result;
- the exact failure excerpt for every failed format.

The minimum matrix considers HWP, HWPX, PDF, XLSX, and DOCX separately. No format is marked supported because another format passed. A format enters the production adapter only when all of the following pass:

1. its synthetic contract preserves non-empty text and the best available location;
2. the package bundles through the tracked OpenNext Workers build;
3. the generated Worker starts and parses the fixture at runtime;
4. no unapproved Critical/High production dependency finding remains;
5. parsing needs no subprocess, local persistent filesystem, outbound model download, OCR, or privileged credential.

OCR and formula/image model paths remain disabled. If kordoc or a format fails, M07 does not patch around the failure with Node subprocesses, a remote parser, R2, queues, or a microservice. It records evidence and an unaccepted ADR draft, then keeps the verified formats only.

## Persistence Model

### `document_parses`

One row is an immutable successful parse snapshot containing:

- `id`, `tenant_id`, `project_id`, and `document_id`;
- the document's immutable `source_sha256`;
- `parser_key`, `parser_version`, and `normalization_version`;
- detected format and non-sensitive structured warnings;
- ordered span count and a canonical `result_sha256`;
- `created_by` and `created_at`.

The unique identity is `(document_id, source_sha256, parser_key, parser_version, normalization_version)`. Retrying an identical completed parse returns the existing snapshot. Re-parsing with a newer parser or normalization version creates a new snapshot; it never updates the old result.

`result_sha256` is SHA-256 over the UTF-8 bytes of one fixed-order, whitespace-free JSON array. Each ordered element emits the keys `ordinal`, `location`, `originalTextSha256`, and `normalizedText` in that order; each location kind emits only its schema-defined keys in their documented order. The application owns this small canonical serializer and contract tests pin its output, so runtime object-key order cannot change the hash.

### `source_spans`

Each immutable row contains:

- `id`, `tenant_id`, `project_id`, `document_id`, and `document_parse_id`;
- one-based `ordinal`, unique within the parse snapshot;
- validated discriminated `location` JSON;
- non-empty `original_text` and `normalized_text`;
- required lowercase `original_text_sha256`;
- `created_at`.

Composite foreign keys keep every span in the same tenant, project, document, and parse snapshot. Database constraints reject empty source, invalid ordinals, malformed hashes, and missing or invalid location fields. The persistence path recomputes span hashes from `original_text` instead of trusting submitted hashes.

Authenticated clients receive read access through RLS but no direct update, delete, or persistence-RPC capability. Parse snapshot and span creation occur transactionally through one narrowly scoped database function executable only by the server `service_role`. After the route authenticates the request, the function receives the initiating user ID explicitly, validates that actor's writer membership and exact document scope, verifies the supplied source SHA against the document row, validates and hashes every span, inserts the snapshot and spans, and returns the immutable parse ID. Its `SECURITY DEFINER` surface uses an empty search path, fully qualified objects, fixed grants, and explicit authorization checks rather than relying on RLS bypass.

An immutable `DOCUMENT_PARSED` audit event is created in the same transaction. It records actor, project, document, parse ID, parser/version, detected format, span count, and result hash. It does not copy source text into the audit log.

## Authorization Matrix

| Role | Read parse/source evidence | Start parse | Update/delete snapshot or span |
|---|---:|---:|---:|
| VIEWER | Yes | No | No |
| REVIEWER | Yes | No | No |
| EDITOR | Yes | Yes | No |
| PROJECT_ADMIN | Yes | Yes | No |
| TENANT_ADMIN | Yes, within tenant | Yes, within tenant | No |
| Anonymous / other project user | No | No | No |

RLS remains the final tenant/project isolation boundary for table reads and any direct table access. The narrowly scoped `SECURITY DEFINER` persistence function enforces the equivalent role, tenant, project, document, actor, and source-hash checks explicitly before its transactional writes. Unauthorized lookup returns zero rows or a fixed 404-style response and does not reveal whether another project owns the document or parse.

## Parse and Review Flow

1. A writer submits `POST /projects/<projectId>/documents/<documentId>/parse`.
2. The route authenticates the request and selects the exact RFP document through RLS.
3. It downloads the private original through the same user's Supabase session.
4. It recomputes the bytes' SHA-256 and compares it with immutable document metadata. Any mismatch stops with `source_integrity_failed` before parsing.
5. It resolves a parser from validated bytes and filename, invokes it inline, and validates the returned span limits, locations, text, and hashes.
6. A separate server-only secret client passes the verified initiating user ID to the service-role-only RPC and persists the complete parse and all spans atomically. No partial successful parse becomes visible.
7. It redirects to a fixed project/document URL with a fixed textual status code.
8. The RFP list shows stored, parseable, parsed, or unsupported-for-parsing state. Writers see a parse action; read-only roles do not.
9. An authorized source page shows parser/version, document hash, result hash, warnings, ordered locations, exact original text, and normalized text without rendering untrusted Markdown or HTML.

Parsing remains inline behind the existing `JobQueue → Inline` decision. The current 6 MiB upload limit bounds input. The application also enforces explicit span-count, per-span, and total-extracted-text limits as versioned constants, with fixed `parse_limit_exceeded` behavior. Those limits can change only with tests and evidence; they do not justify infrastructure in M07.

## Error Handling and Untrusted Input

User-facing outcomes use fixed codes such as:

```text
parsed
already_parsed
unsupported_format
invalid_text_encoding
empty_source
source_integrity_failed
parse_limit_exceeded
parse_failed
persist_failed
```

Raw parser, database, Storage, path, account, package, and stack details are never reflected to the browser. Unauthorized and missing documents are indistinguishable. Parser warnings are allowlisted structured codes before persistence.

Documents and extracted content remain untrusted data. React renders source as escaped text; the implementation uses no `dangerouslySetInnerHTML`, executes no embedded script or macro, follows no document instruction, and sends no content to AI. Tests use injection-shaped strings to prove they are displayed as source evidence rather than executed or interpreted.

No OpenAI key or Supabase service-role/secret key is added to browser code. One minimal server-only client holds the Supabase backend secret solely for the trusted persistence RPC; it is separate from the user's SSR client, never logs the key, and disables session persistence, token refresh, and URL session detection.

## Accessibility

The RFP page and source evidence page use semantic headings and lists, explicit parser status text, labelled controls, visible focus, and real links/buttons. The parse button is keyboard operable. Success, warning, unsupported, and error states are conveyed in text rather than color alone. Original and normalized text have distinct headings so assistive-technology users can tell evidence from deterministic normalization.

Large source output remains navigable with a heading per span and a skip link or landmark for the span list. The initial implementation avoids a visual document viewer; precise textual locations make the evidence usable without requiring pointer interaction.

## Test Strategy

Production behavior follows strict RED → confirmed RED → minimum GREEN.

1. A synthetic `DocumentParser` contract fails before the interface and TXT adapter exist, then proves format support, exact line location, separate original/normalized text, empty-source denial, and stable hashes.
2. Plain-text unit tests cover UTF-8 failure, optional BOM handling, CRLF normalization, whitespace-only input, stable ordering, limits, and injection-shaped text as inert data.
3. The disposable kordoc compatibility spike produces the documented per-format bundle/runtime matrix before any kordoc production adapter is committed.
4. pgTAP schema tests fail before the parse/span tables, constraints, immutable grants, atomic persistence function, audit event, and RLS policies exist.
5. pgTAP behavior proves assigned read, writer creation, viewer/reviewer creation denial, cross-project and anonymous zero access, tenant/document mismatch denial, source-SHA mismatch denial, invalid/empty span denial, stable hash recomputation, idempotency, and update/delete denial.
6. E2E uploads a synthetic TXT RFP, starts parsing by keyboard, verifies exact SourceSpan text/location/hash and audit-backed status, downloads unchanged original bytes, and proves anonymous/other-project access fails. A viewer can read the result but cannot see a parse action.
7. Accessibility automation covers empty, parseable, parsed, warning/error, and populated source views at WCAG 2.2 A/AA tags.
8. Fresh typecheck, lint, unit, Eval, database reset/RLS/advisors, E2E, accessibility, dependency/secret/fixture/banned-infrastructure scans, Next build, and Linux Workers preview/runtime smoke provide the M07 Gate evidence.

## M07 Gate

M07 passes only when fresh evidence proves:

- an authorized synthetic RFP can be parsed through `DocumentParser` into immutable SourceSpans;
- original and normalized text remain separate and each span has a stable SHA-256 and real location;
- the stored original bytes and document SHA remain unchanged;
- parse snapshots and spans are immutable and isolated by tenant/project RLS;
- unauthorized cross-project read/write is zero;
- TXT works in the actual Workers runtime;
- kordoc has a persisted exact-version compatibility matrix, with only passing formats enabled and failures recorded without new infrastructure;
- the parse/source workflow is keyboard operable and has no detected WCAG A/AA violations in the tested states;
- no AI or privileged browser credential was introduced;
- all affected verification commands, build, and Workers runtime smoke pass freshly;
- a coherent small M07 history and verification evidence are committed.

Passing M07 authorizes only the later M08 Requirement Extraction milestone. It does not itself create AI interpretation or any HUMAN_VERIFIED fact.

## Compatibility References

- [kordoc 4.9.1 package metadata and dependency declarations](https://www.npmjs.com/package/kordoc)
- [kordoc official repository](https://github.com/chrisryugj/kordoc)
- [kordoc security policy and parser limitations](https://github.com/chrisryugj/kordoc/security)
- [Cloudflare Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
