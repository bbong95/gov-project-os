# Template Format Matrix

| Format | MVP 우선도 | Template Strategy | Validation | 비고 |
|---|---:|---|---|---|
| HWPX | 1 | kordoc field/fill/patch | validate + render preview | 공공사업 핵심 |
| XLSX | 2 | cell/range/named-range mapping | formula/print/hidden/link | 관리대장/추적표 |
| DOCX | 3 | placeholder/content-control/table mapping | structure/preview | 보고서/회의록 |
| PDF | output | template fill보다는 final export | visual/accessibility | 편집원본 아님 |
| PPTX | extension | slide placeholder mapping | visual overflow | 제안/보고 확장 |

## 원칙

다섯 포맷을 동시에 구현하지 않는다.
HWPX vertical slice → XLSX → DOCX 순으로 실제 수요에 맞춰 추가.
