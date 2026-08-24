# Template Artifact Skill

Use whenever generating a project deliverable from a company/customer template.

Flow:
Template → parse/profile → mapping → human confirm → verified content → fill/patch → validate → preview → human approve.

Rules:
- Preserve original template.
- Version/hash templates.
- Never invent missing factual content.
- Required unmapped/missing fields block Final unless explicit exception.
- HWPX: prefer kordoc format-preserving fill/patch/render.
- Record baseline/template/source/model/prompt metadata.
