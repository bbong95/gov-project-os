# GOV Project OS Starter Kit V4.2 — READ ME FIRST

**가장 먼저:** `CODEX_ZERO_TO_PRODUCT_RUNBOOK_V4.2.md`를 읽고 STEP 00부터 순서대로 Codex에 지시한다.

이 패키지는 Codex가 **RFP 업로드부터 사업종료까지의 전체 제품범위를 잃지 않으면서도**
한 번에 너무 많은 것을 구현하지 않도록 만든 실행용 개발 기준선이다.

## 제품의 전체 범위

```text
사업기회
→ RFP 업로드/분석
→ Requirement Baseline
→ 제안기획/Compliance
→ 평가/협상
→ Contract Baseline
→ 착수/사업수행계획
→ WBS/산출물
→ 회의/회의록/Decision/Action/Issue/고객요청
→ Risk/Issue/Change
→ 검사/감리/Evidence
→ Acceptance
→ Closeout
→ Lessons Learned
→ Knowledge Reuse
```

### 이번 버전에서 추가된 핵심

1. **회의록 제작**을 Communication Management의 정식 Lifecycle 기능으로 포함한다.
2. **회사/고객 템플릿 기반 산출물 제작**을 `Template-driven Artifact Factory`로 정식 포함한다.

템플릿 기반 산출물 흐름:

```text
회사/고객 템플릿 업로드
→ Template 분석
→ TemplateProfile 생성/검토
→ Project Genome의 Human-Verified 콘텐츠 매핑
→ HWPX/DOCX/XLSX/PDF 산출
→ 구조/필드/근거/레이아웃 검증
→ Preview
→ Human Approval
→ Final Artifact
```

## 가장 중요한 개발원칙

제품범위는 전주기지만 개발은 작은 Vertical Slice로 진행한다.

### 첫 번째 개발 Slice

```text
Login
→ Project
→ RFP Upload
→ Parse
→ SourceSpan
→ Requirement Candidate
→ Eval
→ Human Review
→ Immutable Baseline V1
```

이 Slice가 검증되기 전에는 Proposal/WBS/회의록/템플릿 산출물 자동화를 구현하지 않는다.

## Codex 실행 순서

1. `codex-prompts/00_BOOTSTRAP.md`
2. `codex-prompts/01_FOUNDATION.md`
3. `codex-prompts/02_RFP_REQUIREMENT_BASELINE.md`
4. `codex-prompts/03_VERIFY_FIRST_SLICE.md`
5. 다음 Milestone은 `MILESTONE_ROADMAP.md` 순서대로 진행
6. M6에서 `codex-prompts/05_MEETING_MINUTES.md`
7. M5~M7에서 `codex-prompts/06_TEMPLATE_ARTIFACT_FACTORY.md`

## 읽는 순서

1. `GOV_PROJECT_OS_CODEX_LEAN_MASTER_SPEC_V4.2.md`
2. `PRODUCT_LIFECYCLE.md`
3. `AGENTS.md`
4. `CODEX_DEVELOPMENT_GUIDE.md`
5. `MILESTONE_ROADMAP.md`
6. 현재 Feature Spec
7. 현재 Implementation Plan

## 민감자료

실제 고객의 비공개 RFP, 계약서, 개인정보, 대외비, 내부 보안자료는
공개 Git 저장소나 Codex 개발 fixture에 넣지 않는다.
테스트는 `fixtures/synthetic/`의 합성자료로 수행한다.
