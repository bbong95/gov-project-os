# DECISIONS

Record small Lean technical decisions that do not require a full ADR.

| Date | Milestone | Decision | Reason | Evidence/Test |
|---|---|---|---|---|
| 2026-08-24 | M00 | Use the Codex-bundled Node 24 and pnpm runtime for bootstrap commands instead of installing a duplicate system Node | The required major versions are already present and executable without machine-wide changes | Node 24.19.0 and pnpm 11.19.0 exited 0 |
| 2026-08-24 | M00 | Use Docker Desktop's WSL 2 Linux-container backend | Supabase local requires Docker; this is the official supported Windows path and adds no product infrastructure | WSL probe showed it is not yet installed |
| 2026-08-24 | M00 | Prepare Docker Desktop 4.87.0 x86_64 but do not execute it before H1 authorization | This is the current official Windows release and downloading/checking it is reversible while WSL installation is system-wide | Official checksum matched and Docker Inc. Authenticode signature was valid |
| 2026-08-24 | M00 | Supersede the bundled-Node-only bootstrap with the official portable Node.js 24.19.0 ZIP in the workspace | The portable distribution includes npm and needs no administrator or machine-wide installation | Official SHA-256 matched; Node 24.19.0, npm 11.17.0, and pnpm 11.19.0 exited 0 |
| 2026-08-24 | M00 | Install Docker Desktop in per-user mode without automatic license acceptance | The official mode is reversible and requires no administrator rights; legal acceptance and WSL system activation remain human-controlled | Installer log recorded success and Docker CLI 29.7.2 exited 0 |
| 2026-08-24 | M00 | Retain the WSL 2 backend instead of switching to Docker VMM Beta | WSL 2 is the declared baseline and default stable Windows backend; H1 approval removed the only reason to consider the Beta alternative | WSL 2.7.12.0 and Docker Server 29.7.2 verified |
