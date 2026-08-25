# GOAL_STATE

- Goal Version: V4.3
- Status: IN_PROGRESS
- Current Milestone: M08 Requirement Extraction (IMPLEMENTATION)
- Last Completed Milestone: M07 Parser/SourceSpan
- Current Task: Task 9 — write read-only candidate and SourceSpan evidence-view RED assertions
- Blocked By: NONE
- Human Checkpoint: NONE
- Next Verification: extend the requirement extraction E2E, then confirm creation remains green while the missing result page fails at the evidence-view assertion
- Last Code Commit: fe6e427 feat: add requirement extraction vertical flow
- Last Commit: fe6e427 feat: add requirement extraction vertical flow
- Last Updated: 2026-08-25 17:31:13 +09:00

## Milestones

| ID | Milestone | Status | Verification |
|---|---|---|---|
| M00 | Environment | COMPLETE | Fresh exit 0: PowerShell 7.6.4, Git 2.53.0, Node 24.19.0, npm 11.17.0, pnpm 11.19.0, Docker CLI/Server 29.7.2 |
| M01 | Cloudflare Next/OpenNext | COMPLETE | Next dev HTTP 200; OpenNext Cloudflare Workers preview HTTP 200 |
| M02 | Starter Kit/Governance | COMPLETE | 60/60 V4.3 manifest files and 10/10 required supplement files hash-verified; runtime unchanged |
| M03 | Supabase Local | COMPLETE | Supabase CLI 2.115.0; 10/10 containers running; Auth/Studio HTTP 200; PostgreSQL 17+; env/secret checks PASS; Next build and OpenNext Workers preview HTTP 200 |
| M04 | Verification Foundation | COMPLETE | All required scripts execute: typecheck/lint/unit 2/2/RLS 1/1/Eval 1/1/a11y 1/1/E2E 1/1/build/Workers preview HTTP 200; peer/audit clean |
| M05 | Auth/Tenant/Project/RLS | COMPLETE | Schema RED 20/21 then GREEN; RLS RED 14/20 then GREEN 43/43; real Auth E2E 3/3; axe 2/2; advisors clean; Workers preview HTTP 200 |
| M06 | Private RFP Upload | COMPLETE | Schema/RLS 98/98; real Storage isolation and overwrite denial; E2E 6/6; axe 3/3; Workers preview HTTP 200 |
| M07 | Parser/SourceSpan | COMPLETE | Strict UTF-8 TXT parser; immutable SourceSpan snapshots; trusted actor-bound persistence; RLS 196/196; E2E 7/7; axe 4/4; unit 25/25; Eval 1/1; build and Workers preview PASS; sealed security diff scan found 0 findings |
| M08 | Requirement Extraction | IN_PROGRESS — TASK_8_COMPLETE | Deterministic loopback Responses stub and authenticated parse-only route prove one-call AI drafts, fingerprint reuse, viewer/cross/anonymous denial, non-ALLOW zero calls, failure no-snapshot behavior, and M06/M07 regressions; Task 9 evidence view is next |
| M09 | Eval Harness | NOT_STARTED | |
| M10 | Human Workbench | NOT_STARTED | |
| M11 | Requirement Baseline | NOT_STARTED | |
| M12 | First Slice Audit | NOT_STARTED | |
| M13 | Proposal | NOT_STARTED | |
| M14 | Contract Baseline | NOT_STARTED | |
| M15 | WBS/Deliverables | NOT_STARTED | |
| M16 | Template Artifact | NOT_STARTED | |
| M17 | Meeting Minutes | NOT_STARTED | |
| M18 | Risk/Issue/Change | NOT_STARTED | |
| M19 | Inspection/Evidence/Trace | NOT_STARTED | |
| M20 | Closeout/Knowledge | NOT_STARTED | |
| M21 | Hosted Supabase | NOT_STARTED | |
| M22 | Cloudflare Production | NOT_STARTED | |
| M23 | Final Verification | NOT_STARTED | |
