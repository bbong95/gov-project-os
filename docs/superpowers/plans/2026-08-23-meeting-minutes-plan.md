# Meeting Minutes Implementation Plan

> Implement only after M0~M5 prerequisites are stable.

**Goal:** Create approved meeting minutes and controlled project records.

**Spec:** `docs/superpowers/specs/2026-08-23-meeting-minutes-design.md`

### Task 1 — Meeting Domain
- [ ] failing schema tests
- [ ] Meeting/Participant/Source/Minutes schemas
- [ ] RED→GREEN

### Task 2 — DB/RLS
- [ ] project isolation test
- [ ] meeting/minutes tables
- [ ] RLS
- [ ] audit approval

### Task 3 — Manual Transcript Provider
- [ ] define TranscriptProvider
- [ ] Manual provider accepts note/transcript text
- [ ] no audio dependency

### Task 4 — Minutes AI Draft
- [ ] golden transcript fixture
- [ ] tests: no invented owner/due/decision
- [ ] structured output
- [ ] REVIEW_REQUIRED ambiguity

### Task 5 — Review UI
- [ ] keyboard E2E
- [ ] edit/remove/confirm extracted items
- [ ] requirement/WBS optional links

### Task 6 — Approval
- [ ] failing test: draft cannot create active Action
- [ ] APPROVED creates Decision/Action/Issue/CustomerRequest
- [ ] no automatic Requirement change

### Task 7 — Verify
typecheck/lint/unit/RLS/Eval/a11y/E2E/build.
