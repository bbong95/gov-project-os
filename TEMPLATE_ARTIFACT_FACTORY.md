# Template-driven Artifact Factory

## 목적

회사 또는 고객의 기존 산출물 양식을 업로드하면,
Project Genome의 검증된 콘텐츠를 해당 양식에 채워
서식·표·머리글·바닥글·인쇄영역 등을 최대한 유지한 최종 산출물을 만든다.

## 핵심 Workflow

```text
Template Upload
→ Format Detection
→ Template Parse
→ TemplateProfile Draft
→ Field/Anchor Mapping
→ Human Confirm
→ Profile Version Save
→ Content Assembly
→ Template Fill/Patch
→ Structural Validation
→ Source/Coverage Validation
→ Render/Preview
→ Human Approval
→ Final Artifact
```

## Template Modes

### Structured
필드가 존재:
- HWPX 누름틀/label
- DOCX content control/bookmark/placeholder
- XLSX named range/cell anchor

자동 추출 우선.

### Mapped
일반 회사양식:
- heading
- table
- label
- cell
- anchor text
를 분석해 mapping을 제안.
최초 1회 사람이 승인.

## TemplateProfile

```ts
type TemplateProfile = {
  id: string;
  templateVersionId: string;
  mappings: TemplateMapping[];
  requiredFields: string[];
  outputFormat: "HWPX" | "DOCX" | "XLSX" | "PDF";
  reviewStatus: "DRAFT" | "APPROVED";
};
```

## Mapping

```ts
type TemplateMapping = {
  target: TemplateTarget;
  source: ContentSource;
  transform?: string;
  required: boolean;
};
```

ContentSource 예:
- project.name
- requirement.list
- deliverable.name
- wbs.table
- meeting.minutes.summary
- risk.open_items
- generated.section.xxx

## Content Priority

1. Human Verified Project Genome
2. Approved baseline data
3. Approved meeting/decision data
4. AI-generated Draft with explicit review state
5. Unknown → `UNRESOLVED`

AI가 빈칸을 메우기 위해 사실을 창작하지 않는다.

## HWPX

kordoc의:
- `parse_form`
- `fill_form`
- `patch_document`
- `render_document`
- `validate`
를 adapter에서 활용할 수 있다.

HWPX는 원본서식 보존 fill을 최우선.

## XLSX

Mapping 대상:
- Sheet
- Cell
- Range
- Named Range
- Table

검증:
- merged cell
- formula
- hidden sheet
- print area
- external link
- width/height
- overflow
- number/date format

## DOCX

Mapping:
- content controls/placeholders
- bookmarks
- table cell
- heading anchors

최대한 원본 OOXML 요소를 보존하는 구현을 선택한다.

## Artifact Validation

### Field Coverage

```text
field_coverage
= resolved_required_fields / required_fields
```

Final:
**[TARGET] = 100% 또는 명시적 승인 exception**

### Source Coverage

AI-generated factual content:
Source/Baseline link가 있어야 함.

### Layout

- overflow
- truncated table
- broken page
- unexpected blank
- misplaced image
를 preview에서 검토.

## Final Artifact Metadata

- template version
- baseline version
- source IDs
- generator version
- model/prompt version
- hash
- approver
- approval date

## Accessibility

가능한 포맷에서:
- heading
- table header
- alt text
- link text
- document language
를 검증.
