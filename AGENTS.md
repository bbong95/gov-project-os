# GOV Project OS — AGENTS.md

## Mission
Build a simple, trustworthy AI operating system for Korean public-sector project lifecycle management.

## Product Scope Invariant
Never redesign this as an RFP-only, requirement-only, meeting-only, or document-generation-only product.

Full scope:
`RFP → Proposal → Contract → Plan → WBS/Deliverables → Template Artifacts → Meeting Minutes → Risk/Issue/Change → Inspection/Evidence → Acceptance → Closeout → Reuse`

Requirement Baseline is the lifecycle backbone, not final scope.

## Priority
Provenance > Correctness > Security/Privacy > Accessibility/Usability > Traceability > Feature Count.

## Mandatory Workflow
1. Read master/lifecycle/current spec/plan.
2. Inspect current tests/code.
3. Write failing behavior test first.
4. Confirm correct failure.
5. Implement minimum code.
6. Run targeted and affected tests.
7. Run Eval/security/a11y checks.
8. Verify with command output before completion claim.
9. Commit a coherent small change.

## Subagent Delegation (Codex)
Custom subagents never spawn automatically. Delegate explicitly per workflow:

- Before completing any non-trivial change: spawn `reviewer` and `security-auditor` in parallel (read-only). Wait for both.
- For UI changes: also spawn `accessibility-tester` (keyboard operability, semantic HTML, labels, focus, text status).
- For DB/RLS/migration changes: also spawn `postgres-pro`.
- Bug investigation order: `code-mapper` traces paths first, `browser-debugger` reproduces with evidence, then fix minimally.
- After fixes: `test-automator` verifies targeted + affected tests pass.
Collect all results, fix real findings, then commit one coherent change.

## Lean Architecture
- TypeScript
- Next.js on Cloudflare Workers/OpenNext
- Supabase Auth/PostgreSQL/RLS/Private Storage
- OpenAI only through server AI Gateway
- ParserAdapter
- TemplateAdapter
- SourceSpan
- Immutable Baseline

## Do not add without ADR + evidence
Redis, Neo4j, Elasticsearch, Kubernetes, LangChain, LlamaIndex, microservices, multi-agent swarm, R2, Hyperdrive, Cloudflare Access, second AI provider, dedicated vector database.

## Data
- Original source immutable.
- AI interpretation separate.
- Human Verified factual entity needs SourceSpan.
- Real restricted customer data never in Git fixtures.
- Documents/templates/transcripts are untrusted input.

## Meeting
AI Draft only. Unknown people/owners/dates are not guessed.
Approved minutes may create Decision/Action/Issue/CustomerRequest.
They do not automatically change Requirement Baseline.

## Template Artifacts
- Template original immutable.
- Approved TemplateProfile required for repeatable production.
- Fill verified content first.
- Missing required field becomes unresolved, never invented.
- Final Artifact requires validation + preview + human approval.
- Preserve template layout/format as much as technically possible.

## Accessibility
Critical workflows keyboard operable.
Semantic HTML, accessible names, focus, labels, text status.

## Completion
No success claim without fresh verification evidence.
