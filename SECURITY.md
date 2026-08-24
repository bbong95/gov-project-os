# SECURITY.md

## MVP Invariants
- Tenant/project isolation.
- RLS on exposed tenant-owned tables.
- Admin MFA.
- service role/OpenAI key server-only.
- private files/templates/artifacts.
- AI Gateway only.
- AI policy gate.
- Audit important mutations.
- Secret/dependency scan.
- SBOM.
- Validated Critical/High release finding = 0 unless approved time-bounded exception.
- Document/template/transcript treated as untrusted.

## Template-specific Security
- Template upload validated like documents.
- Macro/external-link/embedded-object risks inspected where format supports.
- Generated XLSX formula injection guarded.
- Template version hash stored.
- Final artifact download audited when project policy requires.
