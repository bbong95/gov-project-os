# GOV Project OS

대한민국 공공사업 전주기 AI 운영체제.
요구사항 원천부터 인수인계/지식재사용까지, AI가 사실·계약·승인을 대신 결정하지 않으면서
사람(H6-H10) 결정을 provenance와 함께 보존합니다.

- RFP → Atomic Requirement → Human-Verified Requirement Baseline
- 제안/계약 → Contract Baseline
- WBS / 산출물 → 회사/고객 HWPX 템플릿 기반 산출물 (H8 매핑, H10 승인)
- 회의록 / Risk / Issue / Change / 검사 / Closeout 까지 같은 run 단위로 추적

## 빠른 시작

### 로컬 개발 (Cloudflare Workers + OpenNext + Supabase)

```bash
pnpm install
pnpm supabase start            # 로컬 Supabase 스택 시작
pnpm supabase db reset         # migration 적용
pnpm dev                       # Next.js 개발 서버
```

### 검증

```bash
pnpm typecheck                 # tsc --noEmit
pnpm lint                      # eslint . --max-warnings=0
pnpm test                      # vitest run (147 unit)
pnpm test:rls                  # pgTAP RLS suite (18 files / 477 tests)
pnpm test:eval                 # Eval harness (12 eval checks)
pnpm test:a11y                 # axe A/AA via Playwright (8 tests)
pnpm test:e2e                  # Playwright E2E (workbench, RFP, HWPX, source-span, a11y)
pnpm build                     # next build
pnpm preview                   # opennextjs-cloudflare build && preview
```

### Production 배포

GitHub Actions `deploy.yml` 가 `main` push 시 자동 빌드 + wrangler deploy.
Worker URL: `https://gov-project-os.placeguard-bbong95.workers.dev`
호스팅된 Supabase: `gov-project-os-prod` (ap-northeast-2, ref `epudzahxpgmvnfdzahff`).

## Lifecycle (백본은 Requirement Baseline)

```text
RFP 업로드 → RFP 분석 / SourceSpan → Atomic Requirement → Eval → Human Verified Baseline
→ 제안기획 (M13) → Contract Baseline (M14, H7)
→ WBS / Deliverables (M15) → 회사/고객 HWPX Template 산출물 (M16, H8 매핑 + H10 승인)
→ 회의 / 회의록 (M17, H9) → Risk / Issue / Change (M18) → 검사 / Evidence (M19) → Closeout (M20)
→ Lessons Learned / Knowledge Reuse
```

## 아키텍처

- Next.js 16 (App Router) + React 19
- Cloudflare Workers / OpenNext (`@opennextjs/cloudflare`)
- Supabase Auth + PostgreSQL + RLS + Private Storage
- 서버측 AI Gateway (OpenAI) — `src/lib/ai/openai-responses-provider.ts`
- HWPX worker-native parser (`src/lib/parsing/hwpx-document-parser.ts`) + TXT parser
- SECURITY INVOKER PostgreSQL 함수로 모든 신뢰 mutation: AI·사람 결정은 audit에 기록
- KRDS 디자인 시스템 + WCAG 2.2 AA / KWCAG 2.2 자동/수동 점검

## Human Checkpoints (H6-H10)

- H6 Requirement Baseline 인간 승인
- H7 Contract Baseline 인간 승인
- H8 Template Mapping 최초 인간 승인
- H9 Meeting Minutes 인간 승인
- H10 Final Artifact / Acceptance / Closeout 인간 승인

각 결정은 `audit_events` 에 actor / project / timestamp / content hash 와 함께 기록됩니다.

## 디렉터리

- `src/app/` — App Router pages + server actions
- `src/lib/` — domain lib (parsing, requirements, artifacts, supabase)
- `supabase/migrations/` — schema migrations
- `supabase/tests/database/` — pgTAP RLS + validator suite
- `tests/e2e/`, `tests/a11y/` — Playwright
- `tests/eval/` — Eval harness (golden fixtures)
- `docs/goal/` — GOAL_STATE, VERIFICATION_LOG, HUMAN_CHECKPOINTS, DECISIONS
- `docs/adr/` — Architecture Decision Records
