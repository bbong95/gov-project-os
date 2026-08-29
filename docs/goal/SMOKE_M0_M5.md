# Master Spec 5 MVP — Production Smoke Checklist

This file tracks the production worker status of the five Master Spec
Vertical Slices that were just completed in the MVP0–MVP5 commit
series. The expectation is that a Cloudflare Worker deploy with
`SUPABASE_BACKEND_SECRET` and `GROQ_API_KEY` configured returns the
MVP0–MVP5 pages and that the LLM-driven MVP1/MVP2/MVP3 calls succeed
end to end on a real RFP.

## Pre-flight

- [ ] GitHub `SUPABASE_BACKEND_SECRET` is set
- [ ] GitHub `GROQ_API_KEY` is set
- [ ] Latest `main` build (run_id confirmed) has `conclusion: success`

## URL probes (all should be 200)

- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/  (home)
- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/login
- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/projects
- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/projects/<id>/rfp
- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/projects/<id>/genome
- [ ] https://gov-project-os.placeguard-bbong95.workers.dev/projects/<id>/runs/<runId>/workspace

## MVP-by-MVP smoke (each click should not 500)

### MVP0 Project Genome schema

- [ ] Genome page renders without "table not found" errors
- [ ] Seed Genome from a parsed RFP stores a row in `project_genome`
- [ ] Load Genome returns the requirements/deliverables/evaluation/contract/risks list

### MVP1 RFP Analyzer

- [ ] Genome summary mentions parsed span count + requirement count
- [ ] Every saved row has a non-empty `parser_key` and `result_sha256`
- [ ] `parser_version` matches `parserKeyVersion: 1.0.0` (HWPX) or `plain-text: 1.0.0` (TXT)

### MVP2 Proposal Planner

- [ ] "Compliance Matrix + Winning Point 자동 생성" button submits
- [ ] On success the status banner shows coverage% and gap count
- [ ] genome_compliance_matrix has rows with status ADDRESSED/PARTIAL/PLANNED/GAP

### MVP3 Project Baseline Generator

- [ ] "MVP3 WBS + 검사기준 자동 생성" button submits
- [ ] genome_wbs_tasks has rows with end_offset_days >= start_offset_days
- [ ] genome_inspection_criteria has rows with criterion/method/acceptance

### MVP4 Consistency Auditor

- [ ] Auditor function compiles and unit tests pass
- [ ] No regression in M02 test suite

### MVP5 Requirement → Evidence

- [ ] Evidence form rejects malformed SHA-256
- [ ] Evidence form accepts valid external_id + sha256 and stores row
- [ ] genome_evidence rows include the requirement_id

## Final Definition of Done

- pnpm typecheck 0
- pnpm lint 0
- pnpm test 0 regressions
- pnpm test:rls 0 regressions
- pnpm build 16 routes
- Latest GitHub Actions deploy `conclusion: success`
- Production smoke above all green
