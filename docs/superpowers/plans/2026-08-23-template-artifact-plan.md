# HWPX Template Artifact Implementation Plan

> Implement Template Foundation in M5 and production artifact flow in M7.

**Goal:** Upload an HWPX company template, approve its field mapping, fill it with verified project data, validate/render it, and approve the final HWPX artifact.

**Spec:** `docs/superpowers/specs/2026-08-23-template-artifact-design.md`

### Task 1 — Template Domain
Create schemas:
- ArtifactTemplate
- ArtifactTemplateVersion
- TemplateProfile
- TemplateMapping
- GeneratedArtifact
- ArtifactValidationRun

Test:
- Approved Profile requires mappings.
- TemplateVersion requires SHA-256.
- Final Artifact requires approved template/profile + validation PASS.

### Task 2 — Template Upload/RLS
- private template storage
- project/tenant authorization
- versioning/hash
- cannot overwrite old version

### Task 3 — ArtifactTemplateAdapter
Define:
```ts
interface ArtifactTemplateAdapter {
  inspect(input: TemplateInput): Promise<TemplateInspection>;
  fill(input: FillTemplateInput): Promise<GeneratedBytes>;
  validate(input: GeneratedBytes): Promise<ArtifactValidation>;
  preview(input: GeneratedBytes): Promise<ArtifactPreview>;
}
```

### Task 4 — HWPX kordoc Adapter
Use pinned/version-reviewed kordoc.
- inspect fields
- fill format-preserving
- validate
- render preview

Test with synthetic HWPX company template.

### Task 5 — Mapping UI
- show discovered fields
- AI suggested source mappings
- human confirm
- unresolved required fields visible
- keyboard accessible

### Task 6 — Content Assembly
Priority:
Human Verified/Approved data only.
AI draft can fill narrative only with `REVIEW_REQUIRED`.

Test:
missing required factual field does not trigger hallucinated value.

### Task 7 — Generation
- use approved profile
- fill
- save Draft Artifact
- metadata/source/baseline/template versions

### Task 8 — Validation/Preview
- required field coverage
- unmatched fields
- kordoc validate
- visual render preview
- block Final on validation failure

### Task 9 — Approval
- human approve
- final hash
- audit
- downloadable artifact

### Task 10 — Verify
unit/RLS/template Eval/a11y/E2E/build.
Do not add XLSX/DOCX in this plan.
