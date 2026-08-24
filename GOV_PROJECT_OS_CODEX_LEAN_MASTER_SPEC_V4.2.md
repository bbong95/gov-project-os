# GOV Project OS — Codex Lean Product Master Spec V4.2

## 1. 제품 정의

GOV Project OS는 대한민국 공공사업의 수주 전부터 사업종료까지
공식 문서·요구사항·의사결정·산출물·검수 증적을 하나의 Project Genome으로 연결하는
AI Project Operating System이다.

### 한 줄 정의

> RFP를 업로드하면 요구사항을 누락 없이 구조화하고,
> 사람이 확정한 Requirement Baseline을 중심으로 제안·계약·WBS·산출물·회의록·검사·증적·종료까지 연결하는
> 쉽고 강력한 공공사업 AI 업무 플랫폼.

## 2. Lean이 의미하는 것

Lean은 기능을 버린다는 뜻이 아니다.

- **전체 Product Scope:** RFP → Closeout
- **현재 Development Scope:** 한 번에 하나의 Vertical Slice
- **확장:** Interface/Domain Boundary는 열어두되 구현은 문제 발생 후

## 3. 핵심 파이프라인

```text
RFP
→ SourceSpan
→ Atomic Requirement
→ Evals
→ Human Verified Baseline
→ Proposal Compliance
→ Contract Baseline
→ Project Plan
→ WBS / Deliverables
→ Meeting Minutes / Decisions / Actions
→ Risk / Issue / Change
→ Inspection / Evidence
→ Acceptance
→ Closeout
→ Knowledge Reuse
```

## 4. 제품의 Backbone

`Requirement Baseline`은 모든 후속 객체가 참조하는 생애주기 Backbone이다.

```text
Requirement
 ├─ ProposalCommitment
 ├─ ContractRequirement
 ├─ Task
 ├─ Deliverable
 ├─ MeetingDecision
 ├─ ActionItem
 ├─ Issue
 ├─ CustomerRequest
 ├─ ChangeRequest
 ├─ InspectionCriterion
 ├─ Evidence
 ├─ Acceptance
 └─ Closure
```

Requirement Baseline은 최종 제품 경계가 아니다.

## 5. 기술 기준선

### 현재 구현

- TypeScript
- Next.js
- Cloudflare Workers + OpenNext
- Supabase Auth
- Supabase PostgreSQL
- PostgreSQL RLS
- Supabase Private Storage
- Server-side AI Gateway
- OpenAI Provider 1개
- Zod
- Vitest
- Playwright
- ParserAdapter
- kordoc 우선 검토

### 지금 구현하지 않음

- Redis
- Neo4j
- Elasticsearch/OpenSearch
- Kubernetes
- LangChain/LlamaIndex
- Microservices
- Multi-Agent Swarm
- Cloudflare R2
- Hyperdrive
- Cloudflare Access
- Multi AI Provider
- Dedicated Vector DB

위 기술은 ADR + Test/Eval/Metric으로 필요성이 증명될 때만 추가한다.

## 6. 핵심 데이터 불변조건

1. Original source는 immutable.
2. AI interpretation과 original source는 별도 필드.
3. HUMAN_VERIFIED factual entity는 SourceSpan을 가져야 함.
4. Baseline은 immutable snapshot.
5. Baseline 변경은 새 Version.
6. 모든 exposed tenant/project table은 RLS.
7. Browser에 OpenAI/service-role secret 없음.
8. AI 호출은 AI Gateway 경유.
9. 개인정보/제한자료는 AI Policy Gate를 통과해야 함.
10. 중요 변경은 Audit Event.
11. Critical Workflow는 keyboard operable.
12. AI 변경은 Eval regression 통과.
13. 실제 제한 고객자료는 Git/Codex fixture 금지.
14. 산출물은 가능하면 승인된 회사/고객 Template을 기반으로 생성.
15. Template 생성 결과도 Human Approval 전에는 Final이 아님.

## 7. MVP 메뉴

- 프로젝트
- 문서
- 요구사항
- 제안
- WBS/산출물
- 회의록
- 추적성

## 8. Communication Management

회의록은 Project Genome의 공식 의사소통 기록이다.

```text
Meeting
→ Notes/Transcript
→ AI Minutes Draft
→ Human Review
→ Approved Minutes
→ Decision / Action / Issue / Customer Request
→ Requirement/WBS/Deliverable Link
```

AI는:
- 참석자 추측 금지
- 담당자 추측 금지
- 기한 추측 금지
- 제안을 결정사항으로 과장 금지
- 고객요청을 자동 Requirement Change로 확정 금지

## 9. Template-driven Artifact Factory

산출물을 생성할 때 회사/고객 템플릿이 있으면 그것을 우선한다.

```text
Deliverable
→ Template Version
→ TemplateProfile
→ Content Source
→ Mapping
→ Render
→ Validation
→ Preview
→ Human Approval
→ Final Artifact
```

### 두 가지 Template Mode

#### Structured Template
필드/누름틀/Named Range/Content Control 등이 있는 문서.
자동 field extraction과 fill을 우선.

#### Mapped Template
필드가 명확하지 않은 기존 회사양식.
최초 1회:
- section/table/cell/anchor를 분석
- AI가 mapping 제안
- 사람이 확인
- TemplateProfile 저장
- 이후 동일 양식 재사용

## 10. Template 원칙

1. Template 원본은 immutable.
2. Version별 SHA-256 저장.
3. 양식/서식을 함부로 재구성하지 않는다.
4. 채우는 내용은 Human-Verified Project Genome을 우선.
5. AI가 근거 없는 내용을 빈칸을 채우기 위해 창작하지 않는다.
6. 못 채운 필드는 `UNRESOLVED`.
7. Template overflow/잘림/표 파손을 검증한다.
8. Final 생성 전 preview/human review.
9. 산출물은 생성에 사용한 baseline/template/model/prompt 버전을 기록.
10. 변경된 회사양식은 새 TemplateVersion으로 등록.

## 11. HWPX Template

kordoc가 제공하는 기능을 우선 활용한다.

- form field extraction
- HWPX format-preserving fill
- patch
- generated HWPX
- validation
- render/preview

HWPX의 원본 서식보존 자동채우기는 핵심 Template Adapter 후보이다.

## 12. DOCX/XLSX Template

공통 `ArtifactTemplateAdapter` interface를 구현한다.

DOCX:
- placeholder/content-control/table mapping
- template zip/XML을 최대한 보존
- preview/export 검증

XLSX:
- sheet/cell/named-range/table mapping
- merged cell, formula, print setting, hidden sheet, external link 검사
- 셀주소 mapping을 TemplateProfile에 저장

구체 library는 구현 시 보안/유지보수 검토 후 ADR로 확정한다.

## 13. Output Traceability

모든 Generated Artifact는 최소 다음을 기록한다.

```text
artifact_id
project_id
deliverable_id
template_id
template_version
baseline_version
source_entity_ids
generator_version
model
prompt_version
created_by
created_at
sha256
approval_status
```

## 14. 보안 최소조건

- Tenant/Project RLS
- Admin MFA
- Private files
- AI Gateway
- privacy classification
- audit
- secret/dependency scan
- SBOM
- document/transcript treated as untrusted data

## 15. 개인정보 최소조건

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

회의록 참석자/전사문도 개인정보 가능성이 있으므로 동일 Policy를 적용.

## 16. 접근성 최소조건

- KWCAG 2.2 / WCAG 2.2 AA target
- semantic HTML
- keyboard
- visible focus
- accessible name
- label/error
- color-only 금지
- Requirement/Meeting/Template review 화면 keyboard usable
- Generated document에 구조/표/대체텍스트 검토 가능

## 17. Eval

초기:

- completeness
- source fidelity
- unsupported inference
- duplicate candidate
- schema
- traceability
- meeting factual fidelity
- template field coverage
- artifact source coverage

## 18. 개발순서

- M0 Foundation
- M1 Document / SourceSpan
- M2 Requirement / Baseline
- M3 Eval Harness
- M4 Proposal / Contract
- M5 WBS / Deliverables / Template Artifact Foundation
- M6 Communication / Meeting Minutes
- M7 Inspection / Evidence / Trace / Artifact Production
- M8 Closeout / Knowledge Reuse

## 19. 최종 성공

최종 제품은 한 Project Genome에서 다음을 수행해야 한다.

```text
RFP
→ Proposal
→ Contract
→ Plan
→ WBS
→ Deliverables
→ Template-based Artifacts
→ Meeting Minutes
→ Decisions/Actions
→ Changes/Risks/Issues
→ Inspection
→ Evidence
→ Acceptance
→ Closeout
→ Reuse
```
