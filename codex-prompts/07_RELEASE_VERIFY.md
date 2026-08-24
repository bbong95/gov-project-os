# Codex Task — Release Verification

Do not add features.

Read AGENTS.md and release checklist.

Run fresh:
- typecheck
- lint
- unit
- RLS/tenant isolation
- Eval
- accessibility
- secret/dependency scan
- SBOM generation
- production build
- Cloudflare preview smoke

For Template features also verify:
- template version/hash
- required field coverage
- generated file validation
- preview
- approval gating

For Meeting:
- no active project records before minutes approval
- ambiguity handling

Report command, exit code, failures, and evidence.
Do not claim release readiness if any gate fails.
