# GOV Project OS — Codex `/goal` Master Goal V4.3

> **사용법**
>
> Codex에서 `/goal`을 실행한 뒤 아래 `GOAL BODY` 전체를 한 번에 입력한다.
>
> 이 Goal은 사용자가 STEP별 프롬프트를 반복 입력하지 않아도
> Codex가 환경설정부터 구현·검증·배포까지 순차적으로 계속 진행하도록 설계되었다.
>
> Goal mode의 핵심은 “작업목록 완료”가 아니라 **검증 가능한 최종 상태를 달성하는 것**이다.

---

# GOAL BODY — 아래부터 Codex `/goal`에 그대로 입력

## Goal

대한민국 공공사업 전주기 AI 플랫폼 **GOV Project OS**를
현재 컴퓨터와 repository에서 **환경설정부터 Production-ready 상태까지 끝까지 구축하라.**

최종 제품은 다음 전주기 Workflow를 지원해야 한다.

```text
사업기회
→ RFP 업로드
→ RFP 분석 / SourceSpan
→ Atomic Requirement
→ Eval
→ Human Verified Requirement Baseline
→ 제안기획 / Compliance Matrix / 제안서
→ 평가 / 기술협상
→ Contract Baseline
→ 사업수행계획
→ WBS / 산출물
→ 회사·고객 Template 기반 산출물 생성
→ 회의 / 회의록
→ Decision / Action / Issue / 고객요청
→ Risk / Issue / Change
→ 검사 / 감리 / Evidence
→ Acceptance
→ Closeout / 인수인계 / 보안종료
→ Lessons Learned
→ Knowledge Reuse / 차기사업
```

**현재 구현 Slice가 작더라도 이 Product Scope를 절대 RFP-only, Requirements-only,
Meeting-only, 문서생성-only 제품으로 축소하지 마라.**

Requirement Baseline은 전체 Lifecycle Backbone이며 최종 제품 경계가 아니다.

---

# 1. Context

먼저 현재 작업공간과 컴퓨터를 조사하라.

다음 파일/폴더를 우선 탐색한다.

```text
GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.3_GOAL.zip
GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.2.zip
GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.1.zip
AGENTS.md
PRODUCT_LIFECYCLE.md
GOV_PROJECT_OS_CODEX_LEAN_MASTER_SPEC*.md
CODEX_ZERO_TO_PRODUCT_RUNBOOK*.md
docs/
.agents/
codex-prompts/
fixtures/
```

현재 repo가 아직 없다면 기본경로를 사용한다.

Windows 기본:

```text
C:\dev\gov-project-os
```

이미 repo가 있으면 절대 덮어쓰지 말고 현재 상태를 기준으로 이어서 작업한다.

Starter Kit이 발견되면 가장 높은 Version을 기준선으로 사용한다.

---

# 2. Operating Mode

이 Goal은 **장기 자율 실행 Goal**이다.

다음 원칙으로 스스로 계속 진행한다.

```text
Inspect
→ Determine current milestone
→ Read relevant specs
→ Plan smallest vertical slice
→ RED
→ Confirm RED
→ Minimal implementation
→ GREEN
→ Refactor
→ Security/Privacy/A11y/Eval checks
→ Fresh verification
→ Persist state/evidence
→ Commit
→ Select next incomplete milestone
→ Continue
```

## Routine technical decisions

다음은 사용자에게 묻지 말고 Lean 원칙에 따라 가장 단순하고 검증 가능한 선택을 하라.

- 파일명
- internal type/module boundary
- 테스트 구조
- 작은 refactor
- migration 이름
- 합성 fixture 내용
- 접근성 개선
- test tooling 설정
- lint/typecheck 설정
- 작은 UI layout
- prompt schema 세부구조
- deterministic validation 방식

결정 이유를 ADR이 필요할 정도로 크지 않으면 commit/message 또는 작업로그에 짧게 기록한다.

## 질문을 남발하지 마라

작업을 진행할 수 있는 기술적 선택지가 여러 개라면:
1. 현재 architecture와 official docs를 확인하고,
2. YAGNI/Lean 원칙으로 가장 단순한 것을 선택하며,
3. 자동검증을 추가한 뒤,
4. 계속 진행한다.

---

# 3. Human-only Checkpoints

아래 경우에만 Goal을 일시정지하고 사용자에게 요청한다.

## H1 — Windows 관리자/UAC
Node/Docker/WSL 설치 등 관리자 승인.

## H2 — 재부팅
설치가 재부팅을 실제 요구할 때.

중단 전 반드시:
- 현재 Goal State 저장
- 재개할 exact verification command 저장
- 재부팅 후 무엇을 확인할지 기록

## H3 — Cloudflare OAuth
`wrangler login` browser/device authorization.

## H4 — Supabase authentication / DB password
Access token/password는 로그나 source에 출력하지 않는다.

## H5 — Production Region / Data Residency
기관정책·계약·법적 요구가 필요한 결정.
임의 선택 금지.

## H6 — Requirement Baseline Human Approval
AI가 업무·계약 사실을 대신 최종확정하지 않는다.

## H7 — Contract Baseline Human Approval

## H8 — Template Mapping 최초 승인
회사/고객 양식의 field mapping.

## H9 — Meeting Minutes Human Approval

## H10 — Final Artifact / Acceptance / Closeout 승인

사용자에게 요청할 때:
- 필요한 작업은 정확히 하나만,
- 왜 필요한지 한 문장,
- 완료 후 자동으로 무엇을 재개할지 한 문장
으로 알려라.

Routine progress에 대한 승인 요청은 하지 마라.

---

# 4. Lean Architecture — 반드시 유지

현재 baseline:

```text
Browser
   ↓
Next.js
   ↓
Cloudflare Workers / OpenNext
   ↓
Application API
   ├─ Supabase Auth
   ├─ PostgreSQL + RLS
   ├─ Supabase Private Storage
   ├─ Server-side AI Gateway → OpenAI
   └─ Parser / Eval / Traceability
```

## 현재 구현하지 않을 것

다음 기술은 실제 문제가 측정되고 ADR이 승인되지 않는 한 추가하지 마라.

```text
Redis
Neo4j
Elasticsearch / OpenSearch
Kubernetes
LangChain
LlamaIndex
Microservices
Multi-Agent Swarm
Cloudflare R2
Cloudflare Hyperdrive
Cloudflare Access
Dedicated Vector DB
Second AI Provider
```

---

# 5. Extension Interfaces

구현은 한 Provider만 하되 다음 경계는 유지한다.

```ts
AIProvider
StorageProvider
JobQueue
DocumentParser
SearchProvider
TranscriptProvider
ArtifactTemplateAdapter
```

현재 기본:

```text
AIProvider              → OpenAI
StorageProvider         → Supabase Private Storage
JobQueue                → Inline
SearchProvider           → PostgreSQL
TranscriptProvider      → ManualTranscriptProvider
ArtifactTemplateAdapter → HWPX first
```

확장 Provider는 실제 trigger가 생길 때만 구현.

---

# 6. TDD Hard Rule

새 Production Behavior는 반드시 다음 순서로 구현한다.

```text
RED
→ Verify expected failure
→ GREEN with minimum code
→ Verify affected suite
→ REFACTOR
→ Verify again
```

Production behavior가 먼저 작성됐다면 완료로 간주하지 않는다.

Test는:
- 실제 behavior를 검증
- 가능하면 mock보다 real code
- 한 테스트 한 behavior
- 이름으로 기대행동이 드러나야 한다.

---

# 7. Verification Hard Rule

완료/성공/고침/통과를 주장하기 전에 반드시 fresh command를 실행한다.

최소 후보:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm test:eval
pnpm test:a11y
pnpm test:e2e
pnpm build
pnpm preview
```

현재 Milestone에 존재하는 script만 실행하되,
없는 검증 script가 그 Milestone에 필요하다면 먼저 실제 동작하는 script를 만들어라.

Command output과 exit code가 완료근거다.

---

# 8. Security Invariants

1. 모든 exposed tenant/project table에 RLS.
2. Cross-project unauthorized read/write = 0.
3. Browser에 OpenAI key 없음.
4. Browser에 Supabase service-role secret 없음.
5. Project file/template/generated artifact는 private default.
6. AI 호출은 server-side AI Gateway 경유.
7. 문서/템플릿/회의록/transcript는 untrusted input.
8. 개인정보/민감정보는 AI Policy Gate.
9. 중요 mutation은 Audit.
10. 실제 제한 고객자료는 Git/Codex fixture 금지.
11. dependency/secret scan.
12. production release SBOM.
13. validated Critical/High vulnerability는 승인된 time-bounded exception 없이는 release block.

---

# 9. Privacy Invariants

Classification:

```text
PUBLIC
INTERNAL
PERSONAL
SENSITIVE
RESTRICTED
```

AI Policy:

```text
ALLOW
ALLOW_AFTER_REDACTION
REVIEW_REQUIRED
BLOCK
```

Unknown/ambiguous sensitive policy는 자동 ALLOW하지 않는다.

회의 참석자/전사문/회사 template sample data에도 동일 적용.

---

# 10. Accessibility Invariants

Target:

```text
KWCAG 2.2
WCAG 2.2 AA
```

Critical flows:
- Login
- Project Create
- RFP Upload
- Requirement Review
- Baseline Approval
- WBS Review
- Template Mapping
- Artifact Preview/Approval
- Meeting Minutes Review
- Export

모두 keyboard-operable.

Semantic HTML, visible focus, accessible name, labels, text error,
color-only status 금지를 기본 component contract로 적용한다.

---

# 11. Provenance Invariants

Original source와 AI interpretation을 분리.

Human Verified factual item:

```text
→ SourceSpan required
```

SourceSpan은 가능한 경우:

```text
document
page
sheet
cell range
section
original text
normalized text
hash
```

를 저장한다.

Original은 overwrite하지 않는다.

---

# 12. Milestone State Machine

Milestone을 건너뛰지 마라.

```text
M00 Environment
M01 Cloudflare Next/OpenNext
M02 Starter Kit / Governance
M03 Supabase Local
M04 Verification Foundation
M05 Auth / Tenant / Project / RLS
M06 Private RFP Upload
M07 Parser / SourceSpan
M08 Requirement Extraction
M09 Eval Harness
M10 Human Requirement Workbench
M11 Requirement Baseline V1
M12 Independent First Slice Audit
M13 Proposal Planner
M14 Contract Baseline
M15 WBS / Deliverables
M16 HWPX Template Artifact
M17 Meeting Minutes
M18 Risk / Issue / Change
M19 Inspection / Evidence / Traceability
M20 Closeout / Knowledge Reuse
M21 Hosted Supabase
M22 Production Cloudflare
M23 Final System Verification
```

Milestone Gate가 PASS해야 다음으로 이동한다.

---

# 13. M00 — Environment

실제 조사:

Windows PowerShell 기준:

```powershell
$PSVersionTable.PSVersion
git --version
node --version
npm --version
pnpm --version
docker --version
docker info
```

목표:
- Git works
- Node major 24
- npm works
- pnpm works
- Docker daemon works

누락 시 가능한 설치/전환을 수행.

관리자 승인/재부팅이 필요하면 Human Checkpoint.

**Gate:**
```text
git PASS
node 24.x
pnpm PASS
docker info PASS
```

---

# 14. M01 — Cloudflare Next.js/OpenNext

Repo가 없다면 official Cloudflare C3 방식으로 생성.

Windows 기본:

```powershell
cd C:\dev
pnpm create cloudflare@latest gov-project-os --framework=next --no-deploy --lang=ts --git
cd C:\dev\gov-project-os
```

현재 공식 생성결과를 우선 신뢰하고 확인:

```text
package.json
wrangler config
open-next config
Next App Router
@opennextjs/cloudflare
wrangler
```

실행:

```powershell
pnpm install
pnpm dev
```

실제 HTTP 확인.

그 다음 Workers runtime:

```powershell
pnpm preview
```

또는 현재 generated package script의 공식 equivalent.

**Gate:**
- Next dev HTTP PASS
- Cloudflare preview HTTP PASS

아직 deploy하지 않는다.

---

# 15. M02 — Starter Kit / Governance

가장 높은 Starter Kit을 찾아 repo에 안전하게 통합.

필수 read:

```text
00_READ_ME_FIRST.md
AGENTS.md
PRODUCT_LIFECYCLE.md
GOV_PROJECT_OS_CODEX_LEAN_MASTER_SPEC*.md
CODEX_ZERO_TO_PRODUCT_RUNBOOK*.md
SECURITY.md
PRIVACY.md
ACCESSIBILITY.md
TEMPLATE_ARTIFACT_FACTORY.md
MEETING_MINUTES_SPEC.md
MILESTONE_ROADMAP.md
```

Generated Cloudflare files를 older `.example`로 덮어쓰지 않는다.

Repo state 기록.

---

# 16. M03 — Supabase Local

먼저:

```powershell
docker info
```

그 다음:

```powershell
pnpm add -D supabase
pnpm supabase --version
pnpm supabase init
pnpm supabase start
pnpm supabase status
```

이미 init돼 있으면 재초기화 금지.

Local values로 `.env.local` 구성.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

secret을 출력/commit하지 않는다.

Studio/API 응답 확인.

**Gate:** local Supabase stack PASS.

---

# 17. M04 — Verification Foundation

구성:
- Vitest
- Playwright
- accessibility automation
- typecheck
- lint
- RLS test runner
- Eval runner

실제 script:

```text
typecheck
lint
test
test:rls
test:eval
test:a11y
test:e2e
build
preview
```

placeholder 금지.

Small smoke behavior:
RED → GREEN으로 test runner 자체를 검증.

---

# 18. M05 — Auth / Tenant / Project / RLS

Roles:

```text
VIEWER
EDITOR
REVIEWER
PROJECT_ADMIN
TENANT_ADMIN
```

먼저 실패 테스트:

```text
A user → A project read PASS
A user → B project read FAIL
A user → B project write FAIL
anonymous → private project FAIL
```

그 후 migration/RLS/Auth UI.

Accessible Login/Logout.

**Gate:** unauthorized cross-project read/write 0.

---

# 19. M06 — Private RFP Upload

구현:

```text
Project
→ RFP Upload
→ Supabase Private Storage
→ Document metadata
→ SHA-256
→ authorized retrieval
```

Test:
- cross-project denied
- anonymous denied
- project_id required
- sha256 required
- original overwrite denied

Synthetic fixtures only.

---

# 20. M07 — Parser / SourceSpan

Interface:

```ts
interface DocumentParser {
  supports(mimeType: string): boolean;
  parse(input: ParseInput): Promise<ParsedDocument>;
}
```

SourceSpan:
- document
- location
- original
- normalized
- hash

Synthetic parser contract first.

kordoc를 compatibility spike로 검증.
Workers 비호환이라면 즉시 microservice를 추가하지 말고 evidence + ADR draft.
현재 지원가능 Format부터 진행.

---

# 21. M08 — Requirement Extraction

Structured Candidate:

```text
officialId?
sourceText
interpretation
type
atomicity
sourceSpanIds
```

Atomicity:

```text
ATOMIC
COMPOSITE
REVIEW_REQUIRED
```

`○`는 boundary candidate.

AI Gateway:

```text
Feature
→ Authorization
→ Privacy Policy
→ Prompt Version
→ OpenAI Provider
→ Structured Output
→ Audit metadata
```

모든 Candidate SourceSpan 필수.

Prompt injection fixture를 instruction으로 따르지 않는 test.

---

# 22. M09 — Eval Harness

최소 6개:

1. Completeness
2. Source Fidelity
3. Unsupported Assertion
4. Duplicate Candidate
5. Schema
6. Traceability

Error taxonomy:
E01~E12는 Starter Spec 기준.

`pnpm test:eval`이 실제 exit code로 gate.

---

# 23. M10 — Human Requirement Workbench

3-pane:

```text
Requirement list | AI analysis | Source/Page
```

Actions:
- Approve
- Edit
- Split
- Reject
- Needs Review
- Merge Candidate

Human only:
- merge
- delete/final exclude
- final verify

Confidence % 대신:
- AI Draft
- Source Verified
- Human Verified
- Review Required

Keyboard E2E 먼저.

---

# 24. M11 — Immutable Requirement Baseline V1

Fail tests:
- AI_DRAFT 남으면 block
- HUMAN_VERIFIED without SourceSpan block
- in-place baseline mutation block
- change → new version

Human Checkpoint H6 이후 Baseline V1.

Audit:
- actor
- project
- version
- time
- content hash

---

# 25. M12 — Independent First Slice Audit

**기능 추가 금지.**

Fresh verification:
- RLS
- tenant isolation
- private RFP
- hash
- SourceSpan
- extraction
- prompt injection
- Eval
- review
- immutable baseline
- audit
- accessibility
- build
- preview

Fail이 있으면 해당 fail만 수정.

전부 PASS 전 Proposal 금지.

---

# 26. M13 — Proposal Planner

Requirement Baseline source of truth.

생성:
- Compliance Matrix
- Proposal Outline
- Evaluation mapping
- Response Strategy
- Evidence Needed
- Gap

Verified source 없이:
- company performance
- certifications
- revenue
- personnel career
- product performance
창작 금지.

Unknown → REVIEW_REQUIRED.

---

# 27. M14 — Contract Baseline

Input:
- RFP
- Final Proposal
- Technical Negotiation
- Contract / Task Specification

Candidate:
- added obligation
- modified obligation
- conflict
- deleted candidate

Human Checkpoint H7.

Approved immutable Contract Baseline이 수행 기준.

---

# 28. M15 — WBS / Deliverables

Coverage:

```text
Requirement → Task → Deliverable
```

Deterministic:
- Requirement without Task
- Task without Owner
- Deliverable without Task
- invalid dates
- hierarchy date conflict

초기 UI Table/Tree.
Gantt 금지.

Deliverable은 Artifact Template과 연결가능한 ID.

---

# 29. M16 — HWPX Template Artifact

**회사/고객 양식 사용이 기본이다.**

Flow:

```text
Template Upload
→ immutable version/hash
→ inspect fields/anchors
→ mapping proposal
→ H8 Human Mapping Approval
→ verified Project Genome content
→ fill/patch
→ structural validation
→ render preview
→ H10 Human Artifact Approval
→ Final HWPX
```

Rules:
- 회사양식을 임의 redesign 금지.
- formatting 최대 보존.
- required factual field missing → 절대 창작 금지.
- `UNRESOLVED_REQUIRED_FIELD`.
- Validation FAIL → Final block.
- Template/Baseline/Source/Model/Prompt metadata 기록.

kordoc의 현재 공식/설치된 기능을 확인해
form extraction/fill/patch/validate/render를 우선 활용.

**이번 Milestone은 HWPX만.**
XLSX/DOCX adapter는 HWPX PASS 후 독립 Slice로 추가 가능하나 M17 진행을 불필요하게 막지는 않는다.

---

# 30. M17 — Meeting Minutes

Flow:

```text
Meeting metadata
→ Manual notes/transcript
→ AI Minutes Draft
→ Human Review
→ H9 Approved Minutes
→ Decision / Action / Issue / CustomerRequest
→ optional Requirement/WBS/Deliverable links
```

AI 금지:
- attendee guess
- owner guess
- due-date guess
- discussion promoted to decision
- customer opinion promoted to contract obligation

Ambiguous → REVIEW_REQUIRED.

Approved minutes도 Requirement Baseline 자동 변경 금지.

`TranscriptProvider` interface + `ManualTranscriptProvider`.
자동 STT는 아직 구현 금지.

회의록 출력은 Template Artifact Factory 재사용 가능.

---

# 31. M18 — Risk / Issue / Change

AI는 candidate만.

Change:

```text
Draft
→ Impact Analysis
→ Review
→ Approved / Rejected
→ new Baseline if approved
```

Impact:
- Requirement
- WBS
- Deliverable
- Schedule
- Inspection
- Evidence
- Contract

자동 승인 금지.

---

# 32. M19 — Inspection / Evidence / Traceability

Requirement에:

```text
Criterion
Method
Evidence Type
Result
Evidence
```

검사기준:
짧고 명확하며 고객이 실행/판정 가능.

Trace:

```text
Requirement
→ RFP Source
→ Proposal
→ Contract
→ WBS
→ Deliverable
→ Generated Artifact
→ Inspection
→ Evidence
→ Acceptance
```

Trace completeness deterministic audit.

---

# 33. M20 — Closeout / Knowledge Reuse

구현:
- Requirement Closure
- Acceptance
- Final Deliverable Checklist
- Handover
- Security Closeout
- Unresolved Transfer
- Lessons Learned
- Knowledge Reuse metadata

종료 전:
- open Requirement
- open Action
- open Issue
- unapproved Change
- missing Evidence
자동점검.

강제 자동종료 금지.

H10 Human approval.

---

# 34. M21 — Hosted Supabase

M00~M20 local/release critical gates가 안정된 뒤.

```powershell
pnpm supabase login
pnpm supabase orgs list
pnpm supabase projects list
```

인증은 H4.

Production project가 없으면 생성 가능.

DB password는 secure input.

Region은 **H5**.
임의 선택 금지.

연결 후:

```powershell
pnpm supabase link --project-ref <ref>
pnpm supabase db push
pnpm supabase migration list
```

Local migrations와 hosted schema consistency 확인.

Production secrets source 금지.

---

# 35. M22 — Cloudflare Production

Release gates PASS 후.

```powershell
pnpm wrangler login --use-keyring
```

또는 공식 지원 환경에서 device flow.

OAuth는 H3.

Production secrets는 Cloudflare secret mechanism.

배포 전 fresh:

```text
typecheck
lint
tests
RLS
Eval
a11y
E2E
build
preview
secret scan
dependency scan
SBOM
```

전부 PASS 후 공식 OpenNext/Cloudflare deploy.

Production URL synthetic smoke:
- Login
- Project isolation
- synthetic RFP
- source/requirement/baseline critical flow

실제 고객자료 smoke 금지.

---

# 36. M23 — Final System Verification

기능 추가 금지.

Final Definition of Done을 line-by-line 검증.

## Lifecycle

```text
RFP
→ Baseline
→ Proposal
→ Contract
→ WBS/Deliverables
→ Template Artifact
→ Meeting
→ Change
→ Inspection/Evidence
→ Acceptance
→ Closeout
```

실제로 주요 synthetic E2E가 연결되는지 검증.

## Security
- RLS coverage
- cross-project denied
- private storage
- secrets
- AI Gateway
- scans/SBOM

## AI
- SourceSpan
- Evals
- unsupported inference controls
- Human approval

## Accessibility
- critical keyboard flows
- automated checks
- semantic/status checks

## Artifact
- template version/hash
- required mapping coverage
- no invented required facts
- validation/preview/approval

## Meeting
- draft cannot publish records
- approved only
- no automatic baseline mutation

## Deployment
- Hosted DB migrations
- Cloudflare production
- synthetic production smoke

모든 Gate가 증거와 함께 PASS일 때만 Goal Complete.

---

# 37. Goal Progress Persistence

장기 작업 중 상태를 반드시 repository에 저장한다.

생성/유지:

```text
docs/goal/GOAL_STATE.md
docs/goal/VERIFICATION_LOG.md
docs/goal/HUMAN_CHECKPOINTS.md
docs/goal/DECISIONS.md
```

## GOAL_STATE

최소:

```text
Goal Version
Current Milestone
Last Completed Milestone
Current Task
Blocked By
Next Verification
Last Commit
Last Updated
```

Milestone 완료마다 update.

## VERIFICATION_LOG

성공 주장마다:

```text
date/time
milestone
command
exit code
pass/fail counts
notes
commit
```

## HUMAN_CHECKPOINTS

사용자 개입이 필요한 경우:
- checkpoint ID
- exact action
- why
- resume condition
- resume command/test

## DECISIONS

ADR까지 필요하지 않은 Lean technical decisions.

---

# 38. Resume Behavior

Goal이 중단/재시작되면 처음부터 다시 하지 마라.

재개 시:

1. `AGENTS.md`
2. Master Spec
3. Product Lifecycle
4. `docs/goal/GOAL_STATE.md`
5. `docs/goal/VERIFICATION_LOG.md`
6. `git status`
7. 최근 commits
8. 현재 tests

를 읽는다.

그 다음 **마지막 미완료 Gate부터** 재검증하고 진행.

State 파일의 “완료”를 맹신하지 말고 필요한 최소 fresh verification을 실행.

---

# 39. Failure Recovery

Command 실패 시:

```text
Exact command
→ Exit code
→ Error excerpt
→ Classify: environment/config/code/permission/external-auth
→ smallest fix
→ rerun exact command
```

임시 우회로 Gate를 PASS 처리하지 않는다.

외부 login/권한 때문에 막힌 경우만 Human Checkpoint.

---

# 40. Scope Control

Codex가 “미래 확장성”을 이유로 새로운 infra를 넣으려 하면 스스로 중지.

새 기술 필요 시 `docs/adr/`에 다음을 먼저 작성:

```text
Problem
Why current architecture fails
Evidence/metric
Proposed component
Added complexity
Security/privacy impact
Test plan
Rollback
```

실제 증거 없으면 도입하지 않는다.

---

# 41. Commit Discipline

각 commit은 하나의 검증 가능한 behavior.

권장 예:

```text
chore: bootstrap cloudflare next runtime
chore: add local supabase environment
test: add project isolation red cases
feat: enforce project rls isolation
feat: add private rfp upload
feat: persist source spans
feat: extract sourced requirement candidates
test: add requirement eval harness
feat: add human requirement review
feat: create immutable baseline
...
```

대규모 “build entire platform” commit 금지.

---

# 42. Progress Updates

장기 Goal 중 사용자에게 업데이트할 때:
- 현재 Milestone
- 방금 통과한 Gate
- 다음 Gate
- blocker 여부

만 간결하게 보고.

낮은 수준 로그를 계속 나열하지 않는다.

Human Checkpoint가 아니면 답변을 기다리지 말고 계속 진행.

---

# 43. Final Deliverables

Goal 종료 시 repository에 최소:

```text
Production application
Database migrations
RLS tests
Unit/integration/E2E tests
Eval harness + synthetic golden fixtures
Security/Privacy/Accessibility docs
AGENTS.md
Product lifecycle docs
Template artifact subsystem
Meeting minutes subsystem
Traceability subsystem
Closeout subsystem
Cloudflare deployment config
Supabase configuration/migrations
SBOM
Verification evidence
Goal state/history
README with local + production run instructions
```

를 남긴다.

---

# 44. Definition of Goal Complete

다음 모두 증거로 확인될 때만 Goal을 완료 처리한다.

1. Local environment reproducible.
2. Cloudflare Next/OpenNext dev/preview PASS.
3. Supabase local PASS.
4. Tenant isolation PASS.
5. Private file access PASS.
6. RFP SourceSpan PASS.
7. Requirement extraction + SourceSpan PASS.
8. Eval Harness PASS.
9. Human Review PASS.
10. Immutable Requirement Baseline PASS.
11. Proposal coverage flow PASS.
12. Contract Baseline flow PASS.
13. WBS/Deliverable trace PASS.
14. HWPX Template Artifact validation/approval PASS.
15. Meeting Minutes approval flow PASS.
16. Change approval/baseline rule PASS.
17. Inspection/Evidence/Trace PASS.
18. Closeout checks PASS.
19. Accessibility critical flows PASS.
20. Security scans/SBOM PASS.
21. Hosted Supabase migration consistency PASS.
22. Cloudflare Production deploy PASS.
23. Production synthetic smoke PASS.
24. README/Operations docs PASS.
25. No unresolved Critical/High release blocker.
26. No Human Checkpoint silently bypassed.
27. No real restricted customer data committed.
28. Final verification log contains fresh evidence.

**작업량이 많다는 이유로 성공조건을 축소하지 마라.**
대신 Milestone별로 계속 진행하고 중단 시 상태를 보존하라.

# END GOAL BODY
