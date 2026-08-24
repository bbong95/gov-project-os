# Meeting Minutes — Product Feature Specification

## 1. 위치

회의록 기능은 GOV Project OS의 **사업수행 → Communication Management** 단계에 속한다.

전체 생애주기에서의 위치:

```text
Contract Baseline
→ Project Plan
→ WBS / Deliverables
→ Communication Management
    └─ Meeting Minutes
→ Risk / Issue / Change
→ Inspection / Evidence
→ Acceptance / Closeout
```

## 2. 목적

사용자가 회의 메모 또는 전사문을 입력하면 AI가 회의록 Draft를 만들고,
사람이 원문과 대조·수정·승인한 뒤 Project Genome의 관리항목으로 연결한다.

## 3. 입력

```text
Project
Meeting title
Date/time
Location / online method
Participants
Agenda
Meeting notes or transcript
Optional linked Requirement/WBS/Deliverable
```

## 4. 생성 내용

- 주요 논의내용
- 결정사항
- 조치사항
- 담당자
- 기한
- 이슈
- 고객요청사항
- 후속확인사항

## 5. 상태

```text
AI_DRAFT
→ REVIEWED
→ APPROVED
→ SUPERSEDED
```

## 6. Project Genome 반영 규칙

`APPROVED` 이후에만 아래 정식 record를 만든다.

- Decision
- ActionItem
- Issue
- CustomerRequest

다만:
- Decision은 Change Approval이 아니다.
- CustomerRequest는 Requirement Change 확정이 아니다.
- Action Item은 Requirement 완료를 의미하지 않는다.

## 7. AI 금지행위

- 참석자 창작
- 발언자 창작
- 담당자 추측
- 기한 추측
- 논의사항을 결정사항으로 과장
- 고객 의견을 계약의무로 확정
- 회의록 승인 전 WBS/Requirement 자동변경

불명확한 경우:

```text
REVIEW_REQUIRED
```

## 8. 음성

첫 구현은 음성 자동전사를 필수로 하지 않는다.

```ts
interface TranscriptProvider {
  transcribe(input: TranscriptInput): Promise<TranscriptResult>;
}
```

MVP:

```text
ManualTranscriptProvider
```

향후 승인된 Cloud STT 또는 Local STT adapter를 추가한다.

## 9. 추적성

Approved Minutes:

```text
Meeting Minutes
 ├─ Decision → Requirement?
 ├─ ActionItem → Requirement / WBS?
 ├─ Issue → Requirement / WBS / Deliverable?
 └─ CustomerRequest → Requirement?
```

## 10. 보안/개인정보

- 회의록/전사문은 Project classification 상속.
- 참석자 이름은 개인정보 가능.
- AI Gateway data policy 적용.
- Private storage.
- 승인된 회의록 export는 필요 시 audit.
- 실제 민감 회의 녹음은 Git/Codex fixture 금지.

## 11. 접근성

- 회의등록/검토/승인 keyboard operable.
- 모든 control accessible name.
- Decision/Action/Issue 상태는 색상만으로 구분하지 않음.
- 오류와 검토필요 항목은 text 제공.

## 12. Eval

Synthetic meeting corpus에서:
- invented attendee = fail
- invented owner = fail
- invented due date = fail
- discussion promoted to decision = fail
- source unsupported action = fail

최종 승인 내용은 사람이 검토한다.
