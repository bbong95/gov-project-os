# Codex `/goal` 운영 가이드 — GOV Project OS V4.3

## 1. 한 번만 입력하는 방법

Codex 앱/IDE/CLI에서 Goal mode를 열거나 `/goal`을 실행한다.

그 다음:
`CODEX_GOAL_MASTER_PROMPT_V4.3.md`의 **GOAL BODY** 전체를 입력한다.

이후 사용자는 STEP별 prompt를 반복해서 붙이지 않는다.

## 2. 왜 이렇게 쓰는가

OpenAI의 Goal mode는 사용자가 **원하는 결과와 성공 기준을 정의하고**
Codex가 장기 목표를 향해 계속 작업하도록 설계되어 있다.

따라서 좋은 `/goal`은:
- 해야 할 일을 길게 나열하는 것만으로 끝나면 안 되고
- 최종 Outcome
- Context
- Constraints
- Done When
- Human Checkpoint
- Verification
을 함께 정의해야 한다.

## 3. 처음 실행 전에 준비

필수는 Starter Kit ZIP 하나뿐이다.

Windows 예:
`C:\Users\user\Downloads\GOV_PROJECT_OS_CODEX_STARTER_KIT_V4.3_GOAL.zip`

프로젝트 폴더가 없어도 된다.
Goal이 환경을 조사하고 생성한다.

## 4. 사용자가 만나게 될 정상적인 중단

Goal이 다음에서 멈추는 것은 실패가 아니다.

- Windows UAC
- reboot
- Cloudflare OAuth
- Supabase login
- database password
- production region/data residency
- Requirement Baseline approval
- Contract Baseline approval
- Template Mapping approval
- Meeting Minutes approval
- Final Artifact/Closeout approval

요청된 한 작업을 수행하고 같은 Goal을 Resume한다.

## 5. Resume할 때 사용자 문장

대부분은 간단히:

`방금 요청한 Human Checkpoint를 완료했다. 저장된 Goal State와 Verification Log를 읽고 중단된 Gate부터 계속 진행해.`

라고 하면 된다.

## 6. 절대로 하지 말 것

- Goal을 중단하고 별도 thread에서 동일 repo를 동시에 대규모 수정.
- 실제 고객의 비공개/대외비 문서를 synthetic test 대신 넣기.
- Codex가 “완료”라고 했다는 이유만으로 배포 승인.
- Region이나 민감정보 AI 처리정책을 자동 승인.
- Goal 중간에 Redis/Neo4j/Kubernetes 등을 “일단 추가”.

## 7. 중간 진행상황 확인

질문:
`현재 Goal State, 통과한 Milestone, 현재 blocker, 다음 Gate만 간단히 보여줘. 작업은 계속해.`

이렇게 물으면 Goal을 불필요하게 재설계하지 않고 상태만 확인할 수 있다.

## 8. 품질이 이상할 때

`현재 milestone을 중단하지 말고, 관련 Spec과 Acceptance Criteria를 다시 읽고 현재 결과와 diff를 만들어. 누락된 항목만 TDD로 수정하고 fresh verification 후 계속 진행해.`

## 9. 범위가 커졌을 때

`Architecture complexity audit를 수행해. 현재 Milestone에 필요하지 않은 dependency/service/abstraction을 식별하고, 테스트가 허용하는 범위에서 제거한 뒤 다시 검증해.`

## 10. Goal 종료 보고에서 받아야 하는 것

- completed lifecycle capabilities
- production URL
- migration state
- test summary
- Eval summary
- RLS/tenant isolation evidence
- accessibility evidence
- security scan/SBOM
- unresolved exceptions
- human approvals
- final verification log
- operations README
