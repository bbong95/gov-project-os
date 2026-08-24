# Codex Development Guide

## 1. 가장 중요한 실행방법

Codex에 다음처럼 지시하지 않는다.

```text
이 Master Spec을 읽고 전체 시스템을 구현해.
```

대신 매 세션은 하나의 검증 가능한 Capability만 구현한다.

```text
Read Specs
→ Inspect Repo
→ Write Failing Test
→ Confirm RED
→ Minimal Code
→ GREEN
→ Eval/Security/A11y
→ Verify
→ Commit
```

## 2. Bootstrap

Cloudflare 공식 Next.js scaffold를 사용한다.

```bash
pnpm create cloudflare@latest gov-project-os --framework=next
cd gov-project-os
```

Starter Kit 내용을 repository root에 복사한다.

Supabase:

```bash
pnpm add -D supabase
pnpm supabase init
pnpm supabase start
```

## 3. Codex 첫 메시지

`codex-prompts/00_BOOTSTRAP.md`를 그대로 사용한다.

Codex가 바로 대량코드를 생성하려 하면 중지시키고:
- repository inventory
- architecture
- file map
- test plan
을 먼저 작성하게 한다.

## 4. 세션별 진행

### Session A — Foundation
`01_FOUNDATION.md`

### Session B — First Slice
`02_RFP_REQUIREMENT_BASELINE.md`

### Session C — Independent Verify
`03_VERIFY_FIRST_SLICE.md`

### 이후
MILESTONE 순서대로.

## 5. Feature 구현 규칙

새 feature마다:

1. Domain behavior 정의.
2. Unit test.
3. DB/RLS impact.
4. Security/privacy impact.
5. Accessibility impact.
6. Eval impact.
7. Production code.
8. E2E.
9. Verification.

## 6. 회의록 개발

회의록은 M6.

처음 구현:
- text note/transcript input
- AI Draft
- Human Review
- Approved Minutes
- Decision/Action/Issue/CustomerRequest

자동 STT는 `TranscriptProvider` interface만 만든다.

## 7. Template Artifact 개발

M5에서 Template Registry/Profile 기반을 만들고,
M7에서 실제 Deliverable Artifact 생성/검증을 고도화한다.

### 첫 Template Slice

HWPX를 우선.

```text
Template Upload
→ extract fields/anchors
→ suggested mapping
→ human confirm
→ saved TemplateProfile
→ verified project data
→ fill
→ validate
→ render preview
→ human approve
```

kordoc의 form extraction/fill/patch/render를 우선 검토.

### DOCX/XLSX

공통 Adapter interface만 먼저 만든다.
HWPX 첫 Slice가 통과한 후 format별 adapter를 추가한다.

## 8. 완료검증

최소:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
pnpm test:eval
pnpm test:a11y
pnpm build
```

Feature별 targeted E2E와 Cloudflare preview smoke를 추가한다.

## 9. 다음 Milestone 이동

현재 Acceptance가 전부 PASS되어야 한다.
Codex의 “완료했습니다” 문장이 아니라 실제 명령 출력으로 판단한다.
