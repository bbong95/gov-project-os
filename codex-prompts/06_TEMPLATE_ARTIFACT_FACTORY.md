# Codex Task — Template-driven Artifact Factory

Read:
- TEMPLATE_ARTIFACT_FACTORY.md
- TEMPLATE_FORMAT_MATRIX.md
- template-artifact skill
- HWPX template design/plan

Implement ONLY the HWPX vertical slice first.

Flow:
Template Upload
→ version/hash
→ kordoc-backed field inspection
→ TemplateProfile Draft
→ mapping UI
→ Human Approve
→ verified Project Genome content
→ format-preserving fill
→ validate
→ render preview
→ Human Approve
→ Final HWPX

Rules:
- do not invent missing required factual values
- preserve template formatting
- Final requires validation
- record template/baseline/source/model/prompt metadata
- do not implement DOCX/XLSX/PPTX in same slice
