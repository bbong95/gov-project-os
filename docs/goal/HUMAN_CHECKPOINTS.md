# HUMAN_CHECKPOINTS

| ID | Status | Exact User Action | Why | Resume Condition | Resume Verification |
|---|---|---|---|---|---|
| H1 | COMPLETE | User authorized `wsl --install --no-distribution` and approved the UAC prompt | Docker Desktop required its WSL 2 backend | WSL 2 installed and Docker daemon responds | WSL 2.7.12.0; `docker info` exit 0 with Server 29.7.2 |
| STAGE_GATE_M05 | COMPLETE | User explicitly said `M05로 진행해` | The user required an explicit instruction before moving beyond M04 | M05 is authorized | M05 design/runbook inspected; schema contract RED is next |
| STAGE_GATE_M06 | PENDING | Tell Codex `M06로 진행해` | The user requires an explicit instruction before moving beyond M05 | M06 is explicitly authorized | Read the M06 current spec/plan and observe the first private-upload behavior RED before implementation |
