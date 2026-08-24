# HUMAN_CHECKPOINTS

| ID | Status | Exact User Action | Why | Resume Condition | Resume Verification |
|---|---|---|---|---|---|
| H1 | COMPLETE | User authorized `wsl --install --no-distribution` and approved the UAC prompt | Docker Desktop required its WSL 2 backend | WSL 2 installed and Docker daemon responds | WSL 2.7.12.0; `docker info` exit 0 with Server 29.7.2 |
| STAGE_GATE_M05 | PENDING | Tell Codex to proceed to the next stage | The user required an explicit instruction before moving beyond the current stage | User explicitly authorizes M05 | Read the M05 runbook/schema and run the first anonymous/cross-project pgTAP cases RED |
