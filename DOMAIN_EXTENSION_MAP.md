# Domain Extension Map

| Interface | 현재 | 확장 후보 | Trigger |
|---|---|---|---|
| AIProvider | OpenAI | Local/Other | 정책/BCP/Eval |
| StorageProvider | Supabase | R2/S3/Local | 비용/용량/residency |
| JobQueue | Inline | Cloudflare Queues | timeout/retry/batch |
| DocumentParser | JS/kordoc | Parser Service | Workers 비호환 |
| SearchProvider | PostgreSQL | pgvector | retrieval Eval |
| TranscriptProvider | Manual | Cloud/Local STT | 음성 자동화 요구 |
| ArtifactTemplateAdapter | HWPX first | DOCX/XLSX/PPTX | 실제 template 수요 |
| IdentityProvider | Supabase | SAML/OIDC/AD | Enterprise 요구 |

## ADR Gate

새 기술 전:
1. 실제 문제?
2. 현재 구조가 왜 부족?
3. 추가 복잡성?
4. Test/Eval/Metric 개선 증명?

증명 없으면 추가 금지.
