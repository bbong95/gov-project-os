# Start Here — `/goal` 사용

1. Codex에서 `/goal`을 실행한다.
2. `CODEX_GOAL_MASTER_PROMPT_V4.3.md`를 열어 `GOAL BODY` 전체를 입력한다.
3. 이후 정상적인 Human Checkpoint가 아니면 별도 STEP 프롬프트를 입력하지 않는다.
4. 중단 후에는 `CODEX_GOAL_MODE_OPERATING_GUIDE_V4.3.md`의 Resume 문장을 사용한다.
5. 최종 완료는 Verification Log 증거로 판단한다.

기존 `codex-prompts/step-by-step/` 파일은 Goal mode가 실패했거나 특정 Milestone을 수동 복구할 때만 사용한다.
