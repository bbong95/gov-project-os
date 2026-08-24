# Template-driven Artifact Factory Design

## Goal
Allow a user to upload a company/customer template, map it once to Project Genome data,
then repeatedly generate reviewed project deliverables while preserving template formatting.

## First Vertical Slice
HWPX only.

```text
Upload HWPX Template
→ hash/version
→ parse_form / field discovery
→ TemplateProfile Draft
→ mapping UI
→ Human Approve Profile
→ load verified project data
→ fill_form
→ validate
→ render preview
→ Artifact Draft
→ Human Approve
→ Final HWPX
```

## Entities
ArtifactTemplate
ArtifactTemplateVersion
TemplateProfile
TemplateMapping
GeneratedArtifact
ArtifactValidationRun

## Template Status
DRAFT → APPROVED → RETIRED

## Artifact Status
DRAFT → VALIDATION_FAILED/READY_FOR_REVIEW → APPROVED → SUPERSEDED

## Required Mapping
Every required field has:
- target
- source
- required
- transform

## HWPX Adapter
Candidate kordoc functions:
- parse_form
- fill_form
- patch_document
- validate
- render_document

## Missing Content
Never invent.
If required field cannot be resolved:
`UNRESOLVED_REQUIRED_FIELD`
and Final is blocked.

## Future
XLSX adapter
DOCX adapter
PPTX adapter

Do not implement all simultaneously.
