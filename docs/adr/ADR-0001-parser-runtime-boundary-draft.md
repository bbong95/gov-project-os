# ADR-0001: Parser Runtime Boundary After Kordoc Workers Build Failure

Status: **DRAFT-NOT-ACCEPTED**
Date: 2026-08-24
Milestone: M07 Parser / SourceSpan

## Problem

GOV Project OS ultimately needs trustworthy source extraction from Korean public-project documents, including HWP/HWPX and common office formats. M07 must not claim a format without a deployable Cloudflare Workers parser, precise provenance behavior, dependency safety, and synthetic verification.

## Why the current architecture fails for this package

The exact public `kordoc@4.9.1` entry point parses synthetic HWPX, PDF, XLSX, and DOCX successfully under Node 24.19.0. The same entry point cannot be bundled by Wrangler 4.125.0 for the production Workers compatibility date because native `onnxruntime-node` bindings enter the graph even when OCR and formula OCR are disabled.

Node compatibility does not make native `.node` binaries or subprocesses available in Workers. The published bundle also imports filesystem, OS, and `child_process` paths; `child_process` is only a non-functional Workers stub.

## Evidence and measurements

- Wrangler dry-run exit: 1.
- Bundle: none; five native-binding loader errors.
- Scratch dependency footprint: 766.11 MiB.
- Dependency audit: 2 High vulnerabilities, exit 1.
- Node-only synthetic parse: HWPX/PDF/XLSX/DOCX pass.
- Workers runtime: not runnable because no Worker bundle exists.
- Detailed immutable evidence: `docs/compatibility/2026-08-24-kordoc-workers.md`.

## Current decision

Do not add Kordoc to production and do not add a new runtime boundary. Keep the M07 production registry limited to the strict UTF-8 `text/plain` parser. Return a fixed unsupported-format result for every binary MIME type.

This draft authorizes no parser microservice, container, queue, storage system, or deployment. It is not an accepted exception to the project's architecture or vulnerability gates.

## Preferred future option

The lowest-complexity future option is an upstream, documented parser-core/Workers export that:

- accepts bytes only;
- excludes filesystem-path, COM, subprocess, MCP/CLI, OCR/model, and native dependency code from the import graph;
- exposes the structured original blocks and honest page/sheet/section locations;
- preserves bounded decompression and fixed error contracts;
- passes High-level dependency audit and the exact Workers bundle/runtime matrix.

If such an export becomes available, repeat the M07 spike before changing production dependencies.

## Contingent option requiring a separate accepted ADR

Only if measured product demand shows required binary formats cannot be served within Workers may a bounded Node parser boundary be evaluated. That would be a material architecture addition and cannot be inferred from this draft.

Any later proposal must quantify throughput, document sizes, latency, failure rate, operational ownership, region/data-residency constraints, and why an upstream Workers-safe export or in-process adapter is insufficient.

## Added complexity of a separate parser boundary

A separate runtime would add deployment, authentication, private networking, capacity/timeout policy, retries/idempotency, observability, patching, dependency scanning, incident response, and data-deletion responsibilities. It would also risk becoming a microservice before a measured problem justifies one.

## Security and privacy impact

Project documents are untrusted and may be `RESTRICTED`. Moving bytes across another boundary increases exposure and creates new authorization, residency, logging, retention, malware/zip-bomb, and supply-chain risks. Raw document bytes or extracted text must never appear in logs or error responses. OCR/model download and outbound network access must remain disabled unless separately approved by policy.

The two High dependency findings observed in this spike block release without a patched dependency graph or a separately approved, time-bounded exception.

## Test plan for any future proposal

1. Start with a failing production behavior test for each proposed MIME type.
2. Use generated synthetic fixtures only and pin their hashes for the verification run.
3. Verify byte signature, bounded size/decompression, exact type, non-empty original blocks, and honest locations.
4. Run exact Workers/OpenNext or proposed-runtime bundle and runtime probes.
5. Prove no subprocess, filesystem-path input, model download, or unexpected network call.
6. Run dependency audit, secret/fixture scan, RLS isolation, audit-event, accessibility, and end-to-end tests.
7. Record rollback and run fresh verification before enabling the format allowlist.

## Rollback

The current rollback is already in effect: no production dependency or infrastructure was added. If a future adapter fails any gate, remove its MIME types from the allowlist, remove its dependency, preserve immutable parse/source evidence already created, and return the fixed unsupported-format result for new requests.

## Acceptance condition

This ADR remains unaccepted until a concrete runtime proposal has measured need, exact security/privacy review, a passing test plan, rollback evidence, and explicit architecture approval. The current M07 implementation must proceed without it.
