# Production Operations — MVP0..MVP8

This file is the operator-facing runbook for the system as deployed
on Cloudflare Pages + Supabase. It pairs with the Eval / golden set
in `evals/golden/`.

## Required GitHub repository secrets

| Secret | Used by | If missing |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `deploy.yml` | build job fails fast |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml` | build job fails fast |
| `SUPABASE_BACKEND_SECRET` | `deploy.yml` + `trusted-server.ts` | deploy fails fast, MVP6/MVP7 disabled |
| `GROQ_API_KEY` | `dispatch.ts` (MVP1-3 LLM) | fixture mode only |
| `GOV_PROJECT_DISPATCH_TOKEN` | `parse/route.ts` (MVP6 background) | large files fall back to streaming path |

## URL probes (all should be HTTP 200)

- `https://gov-project-os.placeguard-bbong95.workers.dev/`
- `https://gov-project-os.placeguard-bbong95.workers.dev/login`
- `https://gov-project-os.placeguard-bbong95.workers.dev/projects`
- `https://gov-project-os.placeguard-bbong95.workers.dev/projects/<id>/genome`

## MVP-by-MVP smoke

### MVP0 Project Genome schema

- [ ] Schema exists: `select * from project_genome limit 1;` on hosted
- [ ] `genome_requirements` / `genome_wbs_tasks` / `genome_inspection_criteria` / `genome_evidence` exist

### MVP1 RFP Analyzer

- [ ] Upload a small HWPX (≤ 1 MB compressed) and see "RFP 원본 파싱을 완료했습니다"
- [ ] Genome page shows requirements listed
- [ ] modelFingerprint contains `groq:qwen/qwen3.8-27b`

### MVP2 Proposal Planner

- [ ] On a Genome with at least one requirement, click "제안 Compliance Matrix + Winning Point 자동 생성"
- [ ] Banner shows "ADDRESSED X%" with PARTIAL / GAP counts
- [ ] genome_proposal_sections + genome_compliance_matrix rows present

### MVP3 WBS + Inspection

- [ ] Click "MVP3 WBS + 검사기준 자동 생성"
- [ ] genome_wbs_tasks has rows with `end_offset_days >= start_offset_days`
- [ ] genome_inspection_criteria has rows with criterion / method / acceptance

### MVP4 Consistency Auditor

- [ ] A fresh unit test (`pnpm test src/lib/ai/consistency-auditor.test.ts`) covers the six findings
- [ ] Running the audit through the eval reports a deterministic INFO / WARN / FAIL count

### MVP5 Requirement → Evidence

- [ ] On the Genome page, open the MVP5 "Evidence 추가" form
- [ ] Submit with a valid SHA-256 and a real storage path → success
- [ ] genome_evidence has the new row with the captured sha256

### MVP6 Background job

- [ ] Configure `GOV_PROJECT_DISPATCH_TOKEN` in the repo's GitHub secrets
- [ ] Upload a > 1 MB HWPX from the UI and see the "parse_dispatched" status banner
- [ ] Within ~30–60 s the genome summary updates with "parsed via background action: N spans" — refresh the page
- [ ] genome_requirements is populated by the GitHub Actions worker

### MVP7 Streaming parser

- [ ] `pnpm test --config vitest.integration.config.ts` passes (3.9 MB fixture, 10K+ paragraphs)
- [ ] Direct unit tests in `src/lib/parsing/hwp-stream-parser.test.ts` cover chunk-boundary behaviour
- [ ] No regression in the existing 7 HWPX parser tests

### MVP8 Smoke + status banner

- [ ] After a parse, the RFP page renders the "parse_dispatched" status with a friendly message
- [ ] The Genome page reads the new summary atomically and renders the audit + WBS + Inspection + Evidence sections in one pass

## Production debug

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| HTTP 1102 on a > 1 MB HWPX | Worker memory or CPU ceiling | Configure `GOV_PROJECT_DISPATCH_TOKEN` and re-upload |
| Compliance Matrix banner shows 0 / 0 / 0 | LLM not configured (fixture mode) | Configure `GROQ_API_KEY` and re-run the MVP2 button |
| Genome page does not show requirements | `genome_requirements` was never populated | Re-run MVP6 background job, or re-upload the RFP to trigger MVP1 streaming |
| Consistency Auditor shows FAIL but the requirement looks fine | The audit rule is strict on purpose | Inspect `consistency-auditor.ts` for the rule definition |

## Adding a new Eval row

1. Append a JSONL line to `evals/golden/requirement-classification.jsonl`
   (or whichever golden set applies).
2. The test file under `src/lib/ai/` re-evaluates the entire set on
   every run, so a new row flows through without code changes.
3. For the integration smoke, append the new fixture to
   `tests/integration/` and re-run the integration test.
