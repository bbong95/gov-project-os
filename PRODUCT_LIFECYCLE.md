# Product Lifecycle — Immutable Product Scope

이 문서는 현재 Codex 개발 Slice가 작더라도 전체 Product Scope를 유지시키는 역할을 한다.

## A. 사업기회 / RFP

1. Opportunity 등록
2. 사전규격/RFP 수집
3. RFP 업로드
4. Parsing
5. SourceSpan
6. 사업개요 추출
7. Requirement 후보
8. Atomic Requirement
9. Eval
10. Human Review
11. Requirement Baseline

## B. 제안

12. Go/No-Go 지원
13. 평가항목/배점
14. Compliance Matrix
15. 제안전략
16. 제안서 목차
17. 제안 Draft
18. RFP Coverage 검사
19. 발표/질의응답 지원
20. 기술협상

## C. 계약 / 착수

21. RFP + Proposal + Negotiation + Contract 비교
22. Contract Baseline
23. 사업수행계획
24. WBS
25. 산출물목록
26. 일정
27. RACI
28. 검사기준/추적체계

## D. 수행 / 의사소통

29. Requirement 상태
30. WBS/일정
31. 산출물
32. **Template-driven 산출물 생성**
33. 회의 등록
34. **회의록 제작**
35. Decision/Action/Issue/Customer Request
36. Risk/Issue
37. Change/Impact
38. 주간/월간/임원보고
39. Requirement ↔ WBS ↔ Deliverable ↔ Inspection ↔ Evidence

## E. 검수 / 감리

40. Consistency Audit
41. 감리 사전점검
42. 검사
43. Evidence
44. 고객검토/보완
45. Acceptance

## F. 종료

46. Requirement Closure
47. 최종 산출물 검증
48. 인수인계
49. 보안 종료
50. 미결/후속사업 이관
51. 완료보고
52. Lessons Learned
53. Knowledge Reuse
54. 차기 RFP/후속사업 활용

## Product Backbone

```text
Requirement Baseline
 ├─ ProposalCommitment
 ├─ ContractRequirement
 ├─ Task
 ├─ Deliverable
 │    └─ GeneratedArtifact
 │         └─ TemplateVersion
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
