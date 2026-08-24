# GOV Project OS — Codex Zero-to-Product Runbook V4.2

> **목적:** 사용자가 개발환경을 직접 구성하거나 코드를 작성하지 않고, Codex에게 단계별로 일을 시켜
> `RFP 업로드 → 요구사항 기준선 → 제안 → 계약 → WBS/산출물 → 회사양식 기반 문서생성 → 회의록 → 검수/증적 → 사업종료`
> 전체 제품을 개발하는 실행 지침서.
>
> **원칙:** 한 번에 전체 플랫폼을 만들지 않는다. 각 단계는 `탐지 → RED → 구현 → GREEN → 검증 → 다음 Gate` 순서로 진행한다.

---

# 0. 최종 제품범위 — 절대 축소 금지

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

Requirement Baseline은 전체 생애주기의 Backbone이지 제품의 최종 경계가 아니다.

---

# 1. 사용자가 하는 일과 Codex가 하는 일

## Codex가 한다

- 개발환경 조사
- Node/pnpm/Docker 상태 확인
- 가능한 설치/설정
- Cloudflare Next.js/OpenNext 프로젝트 생성
- Wrangler 설정
- Supabase CLI 설치
- Supabase local `init/start`
- Migration/RLS/Storage/Auth 구현
- 코드/테스트/Eval
- Cloudflare preview/deploy
- Supabase hosted project link/deploy 준비
- Release verification

## 사용자만 해야 하는 경우

1. Windows 관리자/UAC 승인
2. 설치 후 재부팅
3. Cloudflare OAuth 승인
4. Supabase 로그인/DB password 입력
5. Region/Data Residency 같은 기관정책 판단
6. Requirement/Baseline/회의록/Template Mapping/최종 산출물 승인

비밀번호·API key·Access Token은 채팅에 평문으로 붙이지 않는다.

---

# 2. 권장 경로

Windows 권장:

```text
C:\dev\gov-project-os
```

Starter Kit ZIP은 Downloads에 있어도 된다.

```text
GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.2.zip
```

Codex에게 탐색·압축해제·통합까지 시킨다.

---

# 3. STEP 00 — Codex 첫 지시

새 Codex 작업을 열고 아래를 그대로 붙여넣는다.

```markdown
나는 대한민국 공공사업 전주기 AI 플랫폼 GOV Project OS를 개발한다.

최종 제품범위는 절대 축소하지 마라:

사업기회
→ RFP 업로드
→ RFP 분석
→ Requirement Baseline
→ 제안기획/제안서
→ 평가/기술협상
→ Contract Baseline
→ 사업수행계획
→ WBS/산출물
→ 회사/고객 Template 기반 산출물 생성
→ 회의록
→ Decision/Action/Issue/고객요청
→ Risk/Issue/Change
→ 검사/감리/Evidence
→ Acceptance
→ Closeout
→ Lessons Learned/Knowledge Reuse.

하지만 구현은 Lean Vertical Slice 방식으로 한 단계씩 한다.

개발 불변조건:
1. Production behavior 전에 failing test를 먼저 작성하고 실제 실패를 확인한다.
2. Original source와 AI interpretation을 분리한다.
3. HUMAN_VERIFIED 사실은 SourceSpan을 가져야 한다.
4. Baseline은 immutable snapshot이다.
5. Tenant/Project 데이터는 RLS로 격리한다.
6. Browser에 OpenAI key 또는 Supabase service-role key를 노출하지 않는다.
7. AI 호출은 server-side AI Gateway만 통한다.
8. 실제 고객 제한자료를 Git fixture에 넣지 않는다.
9. KWCAG 2.2/WCAG 2.2 AA 방향으로 구현한다.
10. Redis, Neo4j, Elasticsearch, Kubernetes, LangChain, LlamaIndex, Microservice,
    Multi-Agent, R2, Hyperdrive, Cloudflare Access, 별도 Vector DB는 현재 추가하지 않는다.
11. 새 인프라는 ADR + 실제 문제 + 측정근거가 있을 때만 추가한다.
12. 완료라고 말하기 전에 fresh verification command를 실행한다.

내가 다음 단계로 진행하라고 하기 전에는 현재 단계만 수행한다.
```

**Gate:** Codex가 전체 Lifecycle과 Lean 개발방식을 재확인하고 임의 구현을 시작하지 않는다.

---

# 4. STEP 01 — 개발환경을 Codex가 점검·설정

붙여넣기:

```markdown
# STEP 01 — Development Environment

현재 컴퓨터를 네가 직접 조사하고 GOV Project OS 개발환경을 구성해라.
애플리케이션 코드는 아직 만들지 마라.

필수 상태:
- Git 사용 가능
- Node.js major 24
- npm 사용 가능
- pnpm 사용 가능
- Docker-compatible runtime 설치 및 daemon 실행

Windows라면 PowerShell 기준으로 먼저 실제 실행:

$PSVersionTable.PSVersion
git --version
node --version
npm --version
pnpm --version
docker --version
docker info

명령이 없으면 표로 결손항목을 정리하고 가능한 범위에서 설치/설정해라.

Node:
- major 24가 아니면 설치 또는 version manager로 24 LTS로 전환.
- 설치 후 `node --version`, `npm --version` 재검증.

pnpm:
- 없으면 Corepack이 정상 사용 가능한 경우 우선 사용하고,
  아니면 npm을 통해 안정버전을 설치.
- `pnpm --version` 검증.

Docker:
- `docker info`가 반드시 성공해야 한다.
- 없으면 Windows에서는 Docker Desktop 또는 Docker-compatible runtime 설치 가능 여부를 확인하고 설치를 시도.
- 관리자 권한/재부팅이 필요한 경우 그 순간만 사용자에게 정확한 작업 1개를 요청.
- 설치됐지만 daemon이 꺼져 있으면 실행을 시도.
- `docker info` 실패 상태에서 Supabase로 넘어가지 마라.

Git:
- 없으면 설치 후 `git --version` 검증.

최종 보고:
| 항목 | 요구상태 | 발견상태 | 조치 | 검증결과 |
형식으로 작성.

성공하지 않은 항목이 있으면 다음 단계로 가지 마라.
```

**Gate:**
```text
git --version      PASS
node --version     24.x
pnpm --version     PASS
docker info        PASS
```

Supabase CLI는 Docker-compatible runtime이 필요하다.

---

# 5. STEP 02 — Cloudflare Next.js/OpenNext 프로젝트를 Codex가 생성

붙여넣기:

```markdown
# STEP 02 — Cloudflare Next.js/OpenNext Bootstrap

STEP 01 Gate가 모두 PASS된 경우에만 수행한다.

기본 경로:
C:\dev\gov-project-os

이미 해당 폴더가 있으면 먼저 조사하고 덮어쓰지 마라.

Cloudflare 공식 C3 방식으로 새 Next.js Workers 프로젝트를 생성해라.

PowerShell 예:
cd C:\dev
pnpm create cloudflare@latest gov-project-os --framework=next --no-deploy --lang=ts --git

C3/Next 설정 질문이 나오면 안정적인 기본값을 사용:
- TypeScript
- App Router
- ESLint
- 현재는 deploy하지 않음

생성 후:
cd C:\dev\gov-project-os

확인:
- package.json
- wrangler.jsonc
- open-next.config.ts
- @opennextjs/cloudflare
- wrangler
- app/ 또는 src/app/

Cloudflare 자동구성이 누락된 경우 공식 Next.js Workers 구성을 기준으로 최소 보완해라.

package.json에는 최소:
- dev
- build
- preview
- deploy
- cf-typegen
기능이 있어야 한다.

실제 검증:
pnpm install
pnpm dev

HTTP 응답을 Invoke-WebRequest/curl로 확인한다.

그 다음 실제 Cloudflare runtime:
pnpm preview

또는 현재 package.json의 OpenNext Cloudflare preview script를 실행한다.

하지 말 것:
- Supabase 설정
- OpenAI 연동
- RFP 기능
- R2/Hyperdrive/Access
- UI 꾸미기

명령, exit code, 주요 생성파일, HTTP 검증결과를 보고해라.
```

Cloudflare 공식 C3는 `--framework=next`로 Next.js Workers 프로젝트를 생성하고 OpenNext adapter를 사용한다.

**Gate:** `pnpm dev`, `pnpm preview` 모두 성공.

---

# 6. STEP 03 — Starter Kit을 Codex가 프로젝트에 통합

```markdown
# STEP 03 — Integrate Starter Kit

현재 repo, parent directory, 사용자 Downloads에서
`GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.2.zip`을 찾아라.

찾으면 임시폴더에 압축해제하고 최소 다음을 읽어라:
- 00_READ_ME_FIRST.md
- GOV_PROJECT_OS_CODEX_LEAN_MASTER_SPEC_V4.2.md
- PRODUCT_LIFECYCLE.md
- AGENTS.md
- CODEX_ZERO_TO_PRODUCT_RUNBOOK_V4.2.md
- MILESTONE_ROADMAP.md
- SECURITY.md
- PRIVACY.md
- ACCESSIBILITY.md
- TEMPLATE_ARTIFACT_FACTORY.md
- MEETING_MINUTES_SPEC.md

Starter Kit의 docs/.agents/codex-prompts/fixtures와 기준문서를 현재 repo root에 통합해라.

주의:
- Cloudflare C3가 생성한 더 최신 package.json/wrangler/open-next/app 파일을 example 파일로 덮어쓰지 않는다.
- `.example`은 참고자료다.
- AGENTS.md는 repo root에 둔다.

git status와 통합 파일목록을 보여라.
Feature 구현은 아직 금지.
```

**Gate:** Master Spec/Lifecycle/AGENTS/docs/.agents/fixtures가 repo에 존재.

---

# 7. STEP 04 — Supabase Local을 Codex가 전부 구성

```markdown
# STEP 04 — Supabase Local Setup

Cloudflare dev/preview PASS 후 실행.

1. Docker 검증:
docker info

2. Supabase CLI를 project devDependency로 설치:
pnpm add -D supabase
pnpm supabase --version

Global CLI에 의존하지 않는다.

3. repo root에서:
pnpm supabase init

이미 supabase/config.toml이 있으면 읽고 재초기화하지 않는다.

4. 로컬 전체 스택:
pnpm supabase start

5. 상태:
pnpm supabase status

API URL, DB URL, Studio URL, local key가 생성됐는지 확인.
보고서에 secret 전체값은 출력하지 마라.

6. `.env.local`에 local 값을 설정:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

`.env.local`은 gitignore 상태를 확인한다.

7. Next.js에서 Supabase server/browser client를 만들기 위한 현재 공식 package를 설치한다.
아직 업무 table이나 Auth UI는 만들지 않는다.

8. Studio URL이 실제 응답하는지 확인.

최종적으로:
docker info
pnpm supabase --version
pnpm supabase status
를 다시 실행해라.
```

Supabase 공식 local workflow의 기본은 `supabase init → supabase start`이며 Docker-compatible runtime을 사용한다.

**Gate:** Supabase local services가 실제 실행 중.

---

# 8. STEP 05 — 테스트와 검증 기반부터 만들기

```markdown
# STEP 05 — Verification Foundation

업무기능보다 테스트기반을 먼저 만든다.

구성:
- Vitest
- Playwright
- accessibility automation
- TypeScript typecheck
- lint
- RLS test runner
- Eval test runner

package scripts:
typecheck
lint
test
test:rls
test:eval
test:a11y
test:e2e
build
preview

테스트 runner가 실제로 동작하는 것을 증명하기 위해
아주 작은 behavior test를 먼저 작성하고 RED를 확인한 뒤 최소 구현으로 GREEN을 만들어라.

placeholder command를 만들지 마라.
실제로 실행되는 script만 등록해라.

최종적으로 각 script를 실행하고 결과를 표로 보고.
```

---

# 9. STEP 06 — Auth / Tenant / Project / RLS

```markdown
# STEP 06 — Auth, Tenant, Project, RLS

이번 단계만 구현:
- Login/Logout
- Tenant
- Project
- Membership
- RLS

최소 역할:
VIEWER
EDITOR
REVIEWER
PROJECT_ADMIN
TENANT_ADMIN

먼저 실패테스트:
1. Project A 사용자 → Project A read PASS
2. Project A 사용자 → Project B read FAIL
3. Project A 사용자 → Project B write FAIL
4. anonymous → private project FAIL

RED를 실제 확인한 다음 migration과 RLS를 작성.

고위험 Admin role의 MFA를 확장할 수 있게 설계.
복잡한 ABAC/ReBAC는 금지.

Auth UI는 최소 Login/Logout.
접근성: keyboard/focus/label.

검증:
DB reset
RLS tests
Login E2E
typecheck
lint
build

RFP 기능은 아직 만들지 마라.
```

**Gate:** Cross-project unauthorized read/write 0.

---

# 10. STEP 07 — Private RFP Upload

```markdown
# STEP 07 — Private RFP Upload

Project → RFP Upload → Private Storage → Document metadata → SHA-256 → authorized read만 구현.

테스트 먼저:
- 다른 project user가 file 접근 불가
- anonymous 접근 불가
- document는 project_id 필수
- sha256 필수
- original overwrite 금지

Supabase private bucket과 Storage RLS를 migration/policy로 관리.

UI:
- 파일 선택
- 상태/오류를 text로 표시
- keyboard usable

실제 고객 RFP를 fixture로 쓰지 말고 synthetic 문서만 사용.

Parse는 다음 단계.
```

---

# 11. STEP 08 — ParserAdapter / SourceSpan

```markdown
# STEP 08 — ParserAdapter and SourceSpan

목표:
RFP Upload → Parse → SourceSpan

먼저 interface:

interface DocumentParser {
  supports(mimeType: string): boolean;
  parse(input: ParseInput): Promise<ParsedDocument>;
}

Domain이 특정 parser library에 직접 결합되지 않게 한다.

SourceSpan:
- document_id
- page / sheet / cell / section
- original_text
- normalized_text
- hash

Original text overwrite 금지.

Synthetic fixture로 먼저 contract test.

kordoc compatibility를 작은 test로 확인.
Cloudflare runtime 비호환 문제가 있으면 즉시 microservice를 만들지 말고:
- 정확한 실패
- compatibility report
- ADR draft
를 남기고 현재 가능한 format부터 진행.

테스트:
- 위치보존
- empty source 금지
- hash 안정성
```

---

# 12. STEP 09 — AI Requirement Extraction

```markdown
# STEP 09 — Requirement Extraction

AI가 Requirement Candidate를 만드는 것만 구현.

모든 Candidate에 SourceSpan ID 필수.

Schema:
officialId?
sourceText
interpretation
type
atomicity
sourceSpanIds

Atomicity:
ATOMIC
COMPOSITE
REVIEW_REQUIRED

`○`는 중요한 boundary candidate지만 절대 1:1 규칙이 아니다.

AI Gateway:
Feature → server AI Gateway → policy → prompt version → OpenAI → Zod parse → audit metadata

Browser가 OpenAI를 직접 호출하면 안 된다.

Privacy:
PUBLIC / INTERNAL / PERSONAL / SENSITIVE / RESTRICTED

Decision:
ALLOW / ALLOW_AFTER_REDACTION / REVIEW_REQUIRED / BLOCK

첫 구현은 단순 deterministic rule table.

Synthetic RFP에서:
- expected candidate
- SourceSpan
- prompt injection 문자열을 instruction으로 따르지 않음
을 테스트.
```

---

# 13. STEP 10 — Eval Harness

```markdown
# STEP 10 — Eval Harness

다음 6개를 실제 자동검사로 구현:
1. Completeness
2. Source Fidelity
3. Unsupported Assertion
4. Duplicate Candidate
5. Schema
6. Traceability

Synthetic Golden Dataset부터 시작.

Error Taxonomy:
E01 Missing Requirement
E02 Source Mutation
E03 Unsupported Inference
E04 False Duplicate
E05 Missed Duplicate
E06 Wrong Classification
E07 Over-Split
E08 Over-Merge
E09 Wrong Mapping
E10 Traceability Break
E11 Security/Privacy Policy Violation
E12 Accessibility Blocker

`pnpm test:eval`이 실제 non-zero/zero exit로 failure/success를 표현해야 한다.
```

---

# 14. STEP 11 — Human Requirement Workbench

```markdown
# STEP 11 — Requirement Workbench

3-pane UI:
왼쪽 Requirement list
가운데 AI 분석/상태
오른쪽 RFP 원문 SourceSpan/Page

Actions:
Approve
Edit
Split
Reject
Needs Review
Merge Candidate

Merge/Delete는 사람만 확정.

접근성:
- keyboard-only
- focus visible
- accessible names
- color-only 상태 금지
- Source panel 이동

Calibration 안 된 confidence % 표시 금지.

상태:
AI Draft
Source Verified
Human Verified
Review Required

Playwright keyboard E2E를 먼저 RED로 만든 뒤 구현.
```

---

# 15. STEP 12 — Immutable Baseline V1

```markdown
# STEP 12 — Requirement Baseline V1

먼저 failing tests:
- AI_DRAFT가 남아있으면 finalize 실패
- SourceSpan 없는 HUMAN_VERIFIED finalize 실패
- Baseline in-place mutation 실패
- 변경은 새 Baseline version 필요

검증된 requirements를 snapshot해 Baseline V1 생성.

Audit:
actor
project
version
timestamp
content hash

완료 후 First Slice 전체검증.
```

---

# 16. STEP 13 — 별도 Codex 작업으로 First Slice 독립 감사

```markdown
# STEP 13 — Independent Verification

기능 추가 금지.

RFP → Requirement Baseline V1 전체를 독립감사.

검증:
Tenant isolation
RLS
Private file
Document hash
SourceSpan
Requirement source
Prompt injection
Eval
Human review
Immutable baseline
Audit
Keyboard
Build
Cloudflare preview

각 command:
- command
- exit code
- pass
- fail
- warning
표로 보고.

실패는 해당 실패만 TDD로 수정.
모두 PASS 전 Proposal 금지.
```

---

# 17. STEP 14 — Proposal Planner

```markdown
# STEP 14 — Proposal

Requirement Baseline을 유일한 요구사항 기준으로 사용.

생성:
Compliance Matrix
Proposal Outline
평가항목 대응
Response Strategy
Evidence Needed
Gap

회사 실적/인증/인력경력/매출/제품성능은 source 없이 창작 금지.
근거 없으면 REVIEW_REQUIRED.

Proposal Coverage = covered baseline requirements / baseline requirements.
Gap가 화면에 명확히 보여야 한다.
```

---

# 18. STEP 15 — Contract Baseline

```markdown
# STEP 15 — Contract Baseline

입력:
RFP
Final Proposal
Technical Negotiation
Contract/Task Specification

AI는:
added obligation
modified obligation
conflict
deleted candidate
를 제안.

우선순위/최종의무는 사람이 검토.

Human approval 후 immutable Contract Baseline 생성.
이것이 수주 후 수행기준.
```

---

# 19. STEP 16 — WBS / Deliverables

```markdown
# STEP 16 — WBS and Deliverables

Contract Baseline requirement마다:
Requirement → Task → Deliverable coverage.

Deterministic:
Requirement without Task
Task without Owner
Deliverable without Task
invalid date
child-parent date conflict

UI는 Table/Tree.
Gantt는 지금 금지.

Deliverable은 Template Artifact와 연결 가능한 ID를 가진다.
```

---

# 20. STEP 17 — 회사/고객 양식 기반 산출물

HWPX부터 하나만.

```markdown
# STEP 17 — HWPX Template Artifact

읽기:
TEMPLATE_ARTIFACT_FACTORY.md
template design/plan
template-artifact skill

Flow:
Template Upload
→ immutable version/hash
→ field/anchor inspect
→ mapping suggestion
→ human mapping approval
→ verified Project Genome content
→ fill
→ validate
→ render preview
→ human approval
→ Final HWPX

규칙:
- 회사양식을 다른 디자인으로 재작성하지 않는다.
- 원본 formatting을 최대한 유지.
- required factual field가 없으면 AI가 창작하지 않는다.
- UNRESOLVED_REQUIRED_FIELD로 Final block.
- Final은 validation + human approval 후.

kordoc 공식 기능을 실제 확인해:
parse_form
fill_form
patch_document
validate
render_document
활용 가능성을 adapter에서 검증.

이번 Slice에 XLSX/DOCX/PPTX는 구현하지 않는다.
```

HWPX PASS 후 XLSX, DOCX adapter를 각각 별도 Slice로 개발.

---

# 21. STEP 18 — Meeting Minutes

```markdown
# STEP 18 — Meeting Minutes

Flow:
Meeting metadata
→ note/manual transcript
→ AI Minutes Draft
→ Human Review
→ Approved Minutes
→ Decision / Action / Issue / CustomerRequest
→ optional Requirement/WBS/Deliverable link

AI 금지:
attendee 추측
owner 추측
due date 추측
discussion → decision 과장
customer opinion → contract obligation 확정

불명확하면 REVIEW_REQUIRED.

APPROVED 후에만 정식 Decision/Action/Issue/CustomerRequest record 생성.

회의록 승인만으로 Requirement Baseline 변경 금지.

음성자동전사는 아직 구현하지 말고:
TranscriptProvider interface + ManualTranscriptProvider
만.

회의록 최종파일은 Template Artifact Factory를 재사용 가능하게 설계.
```

---

# 22. STEP 19 — Risk / Issue / Change

```markdown
# STEP 19 — Risk Issue Change

회의/고객요청/요구사항에서 Candidate 생성 가능.

Change:
Draft
→ Impact Analysis
→ Review
→ Approved/Rejected
→ New Baseline if approved

Impact:
Requirement
WBS
Deliverable
Schedule
Inspection
Evidence
Contract

AI는 자동 승인 금지.
```

---

# 23. STEP 20 — Inspection / Evidence / Trace

```markdown
# STEP 20 — Inspection Evidence Trace

Requirement에:
Criterion
Method
Evidence Type
Result
Evidence
를 연결.

검사기준은 고객이 쉽게 실행/판정 가능한 짧고 명확한 수준.

대표 Trace:
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

Trace completeness는 deterministic audit.
```

---

# 24. STEP 21 — Closeout

```markdown
# STEP 21 — Closeout

구현:
Requirement Closure
Acceptance
Final Deliverable Checklist
Handover
Security Closeout
Unresolved Transfer
Lessons Learned
Knowledge Reuse

종료 전 자동점검:
open Requirement
open Action
open Issue
unapproved Change
missing Evidence

자동 강제종료 금지.
```

---

# 25. STEP 22 — Hosted Supabase도 Codex가 구성

로컬 First Slice가 안정된 뒤에만.

```markdown
# STEP 22 — Hosted Supabase

Local first slice/release gate PASS 후 실행.

Supabase login:
pnpm supabase login

인증/토큰 입력이 필요한 정확한 순간만 나에게 요청.
Secret을 출력하지 마라.

그 후:
pnpm supabase orgs list
pnpm supabase projects list

Production project가 없으면 Supabase CLI 또는 연결된 Supabase tool로
gov-project-os-prod 생성.

DB password는 secure input.
Region은 임의선택 금지.
기관정책/data residency가 불명확하면 후보와 영향을 보여주고 HUMAN_REVIEW_REQUIRED.

생성 후:
pnpm supabase link --project-ref <ref>
pnpm supabase db push
pnpm supabase migration list

Local migration과 hosted schema가 일치하는지 검증.

Production secret을 source code에 기록하지 마라.
```

Supabase CLI는 hosted project 생성, link, `db push`를 지원한다.

---

# 26. STEP 23 — Cloudflare 로그인/배포도 Codex가 수행

```markdown
# STEP 23 — Cloudflare Production Deploy

Release Gate가 전부 PASS된 경우만.

Cloudflare login:
pnpm wrangler login --use-keyring

Browser OAuth 승인이 필요한 순간만 나에게 알려라.
제한환경이면:
pnpm wrangler login --device
사용 가능.

OpenAI/Supabase server secret은 Git에 저장하지 말고 Cloudflare secret mechanism 사용.

배포 전:
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm test:eval
pnpm test:a11y
pnpm build
pnpm preview

전부 성공 후 공식 OpenNext deploy script 실행.

배포 URL에서 synthetic smoke:
Login
Project isolation
Synthetic RFP upload/analyze
를 검증.

실제 고객자료로 smoke 금지.
```

Wrangler는 OAuth `login`, Workers `deploy`를 지원한다.

---

# 27. Codex가 실패했을 때 공통 복구 프롬프트

```markdown
현재 실패를 임의 우회하지 마라.

1. 실패한 정확한 command를 보여라.
2. exit code와 핵심 error를 정리해라.
3. 환경/설정/코드/권한 문제로 분류해라.
4. 현재 repo 설정과 공식문서를 확인해라.
5. 가장 작은 수정 하나만 적용해라.
6. 동일 command를 다시 실행해라.
7. 실패 중이면 성공했다고 말하지 마라.
8. 관리자 승인, OAuth, 재부팅, 비밀값 입력처럼 나만 할 수 있는 경우에만 정확한 action 하나를 요청해라.
```

---

# 28. Codex가 너무 많은 기능을 추가하려 할 때

```markdown
중지.

현재 milestone의 acceptance criteria를 다시 읽어라.

현재 Slice에 필요하지 않은:
Redis
Neo4j
Elasticsearch
R2
Hyperdrive
Cloudflare Access
Vector DB
Multi-Agent
Microservice
등을 추가하지 마라.

현재 failing test를 통과시키는 최소 구현만 수행해라.
```

---

# 29. 테스트 없이 구현했을 때

```markdown
현재 변경은 TDD 원칙을 위반했다.

새 behavior를 증명하는 failing test가 없었다면 완료처리하지 마라.

1. 기대 behavior를 test로 작성.
2. feature 부재 때문에 RED인지 확인.
3. 최소 code로 GREEN.
4. regression 실행.

처음부터 test가 PASS하면 그 test가 실제 새 behavior를 증명하는지 조사.
```

---

# 30. Codex가 “완료”라고 말했을 때

```markdown
완료주장을 중단하고 fresh verification을 실행해라.

pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm test:eval
pnpm test:a11y
pnpm build

해당 milestone의 E2E도 실행.
Cloudflare runtime 변경이면 preview smoke.

각 command:
command / exit code / passed / failed / warnings
를 표로 작성.

하나라도 fail이면 완료라고 말하지 마라.
```

---

# 31. 매일 작업 시작 프롬프트

```markdown
오늘은 GOV Project OS 현재 미완료 milestone에서 가장 앞선 하나의 Vertical Slice만 진행한다.

먼저:
AGENTS.md
PRODUCT_LIFECYCLE.md
MILESTONE_ROADMAP.md
현재 feature spec
현재 implementation plan
을 읽어라.

git status와 현재 test 상태를 확인하고
다음 가장 작은 검증가능 task 하나를 선택.

RED → GREEN → REFACTOR → VERIFY.

scope 밖 기능 추가 금지.
```

---

# 32. 작업 종료 프롬프트

```markdown
오늘 작업을 종료정리해라.

1. 실제 완료 behavior
2. 변경파일
3. 실행한 검증 command와 결과
4. 남은 failure
5. milestone acceptance 충족상태
6. 다음에 할 단 하나의 task
7. 신규 ADR 필요 여부
8. security/privacy/accessibility/Eval regression

완료되지 않은 것을 완료라고 표현하지 마라.
```

---

# 33. 전체 순서

```text
00 제품원칙
01 PC 개발환경
02 Cloudflare Next/OpenNext
03 Starter Kit 통합
04 Supabase Local
05 Test/Verification Foundation
06 Auth/Tenant/Project/RLS
07 Private RFP Upload
08 Parser/SourceSpan
09 Requirement Extraction
10 Eval Harness
11 Human Workbench
12 Baseline V1
13 Independent Audit
14 Proposal
15 Contract Baseline
16 WBS/Deliverables
17 Template Artifact
18 Meeting Minutes
19 Risk/Issue/Change
20 Inspection/Evidence/Trace
21 Closeout
22 Hosted Supabase
23 Cloudflare Production Deploy
```

**총 24 Step(00~23). 한 번에 여러 Step을 실행하지 않는다.**

---

# 34. 첫날 목표

첫날 목표를 크게 잡지 않는다.

```text
Node/pnpm/Docker PASS
+
Cloudflare Next dev PASS
+
Cloudflare preview PASS
+
Supabase local PASS
+
Test runner PASS
```

여기까지면 성공.

첫 업무기능 목표:

```text
RFP Upload
→ SourceSpan
→ Requirement
→ Eval
→ Human Review
→ Baseline V1
```

여기가 검증된 다음 Proposal/WBS/Template/Meeting으로 넘어간다.

---

# 35. 최종 원칙

사용자는:
- 업무기준
- 정책
- Human Review
- 최종 승인
을 담당한다.

Codex는:
- 환경설정
- 코드
- migration
- test
- Eval
- 배포설정
- 검증
을 수행한다.

**Codex를 개발자로 사용하되, Spec/Test/Eval/RLS/Human Approval이 Codex를 통제한다.**
