# User Intervention Checkpoints

Codex가 대부분을 수행하고 사용자는 아래 경우만 직접 개입한다.

1. Windows UAC/관리자 승인
2. Docker/WSL 설치 후 재부팅
3. Cloudflare `wrangler login` OAuth 승인
4. Supabase login/token/DB password의 secure input
5. Production region / 데이터 레지던시 정책 판단
6. Requirement/Baseline/Meeting Minutes 최종 Human Approval
7. 회사/고객 Template Mapping 최초 승인
8. Final Artifact 승인

API key, token, password는 Codex 대화에 평문으로 복사하지 않는다.
