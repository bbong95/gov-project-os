# HUMAN_CHECKPOINTS

| ID | Status | Exact User Action | Why | Resume Condition | Resume Verification |
|---|---|---|---|---|---|
| H1 | COMPLETE | User authorized `wsl --install --no-distribution` and approved the UAC prompt | Docker Desktop required its WSL 2 backend | WSL 2 installed and Docker daemon responds | WSL 2.7.12.0; `docker info` exit 0 with Server 29.7.2 |
| STAGE_GATE_M05 | COMPLETE | User explicitly said `M05로 진행해` | The user required an explicit instruction before moving beyond M04 | M05 is authorized | M05 design/runbook inspected; schema contract RED is next |
| STAGE_GATE_M06 | COMPLETE | User explicitly said `M06로 진행해` | The user required an explicit instruction before moving beyond M05 | M06 was explicitly authorized | M06 private upload verification passed and evidence was recorded |
| STAGE_GATE_M07 | COMPLETE | User explicitly said `M07로 진행해`, approved the design, and approved the written M07 specification | The user required explicit authorization before moving beyond M06 | M07 is authorized with the approved Parser/SourceSpan design | Written plan committed; first parser contract RED is next |
