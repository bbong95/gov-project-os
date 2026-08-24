# VERIFICATION_LOG

| Timestamp | Milestone | Command | Exit | Passed | Failed | Notes | Commit |
|---|---|---|---:|---:|---:|---|---|
| 2026-08-24 10:14:00 +09:00 | M00 | `$PSVersionTable.PSVersion`; `git --version`; `node --version`; `npm --version`; `pnpm --version`; `docker --version`; `docker info` | 1 | 2 | 4 | PowerShell 7.6.4, Git 2.53.0, pnpm 11.19.0; system Node/npm and Docker unavailable | NONE |
| 2026-08-24 10:17:00 +09:00 | M00 | bundled `node --version`; bundled `pnpm --version` | 0 | 2 | 0 | Node 24.19.0 and pnpm 11.19.0 available from Codex workspace runtime | NONE |
| 2026-08-24 10:19:00 +09:00 | M00 | `wsl --version`; `wsl --status` | 1 | 0 | 2 | WSL is not installed; H1 administrator/UAC checkpoint required | NONE |
| 2026-08-24 10:24:08 +09:00 | M00 | `Get-FileHash -Algorithm SHA256`; `Get-AuthenticodeSignature` for Docker Desktop 4.87.0 installer | 0 | 2 | 0 | SHA-256 `9ac03d4e900c0fdee981d4bde083a55fdfb28ffba2cae77726eff2a437254822` matches Docker release metadata; signature valid from Docker Inc. | NONE |
| 2026-08-24 10:26:44 +09:00 | M00 | verify Node 24.19.0 ZIP SHA-256; portable `node --version`; `npm --version`; `pnpm --version` | 0 | 4 | 0 | SHA-256 `57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73` matches Node.js release metadata; Node 24.19.0, npm 11.17.0, pnpm 11.19.0 | NONE |
| 2026-08-24 10:30:29 +09:00 | M00 | Docker Desktop per-user installer; inspect `install-log.txt`; `docker.exe --version` | 0 | 3 | 0 | Installer log says `Installation succeeded`; Docker Desktop 4.87.0 files present; Docker CLI 29.7.2 executes | NONE |
| 2026-08-24 10:31:25 +09:00 | M00 | installed `docker.exe info` | 1 | 1 | 1 | Client 29.7.2 works; server pipe is absent because the Docker daemon is not running and WSL is not installed | NONE |
| 2026-08-24 10:34:00 +09:00 | M00 | elevated `wsl.exe --install --no-distribution`; `wsl.exe --version`; `wsl.exe --status` | 0 | 3 | 0 | UAC-approved install exited 0; WSL 2.7.12.0, kernel 6.18.33.2-2, default version 2 | NONE |
| 2026-08-24 10:36:00 +09:00 | M00 | installed `docker.exe info` | 0 | 2 | 0 | Docker client and server 29.7.2; Docker Desktop on WSL 2 kernel 6.18.33.2 | NONE |
| 2026-08-24 10:38:41 +09:00 | M00 | PowerShell version; `git --version`; portable `node --version`; `npm --version`; `pnpm --version`; `docker --version`; `docker info --format` | 0 | 7 | 0 | Fresh M00 Gate: PowerShell 7.6.4, Git 2.53.0, Node 24.19.0, npm 11.17.0, pnpm 11.19.0, Docker CLI/Server 29.7.2 | NONE |
