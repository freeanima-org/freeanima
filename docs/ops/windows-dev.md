---
title: Windows development
---

# Windows development

> Source development on native Windows (or WSL2). For Linux standalone install and general deploy steps, see [`install.md`](install.md). PostgreSQL: [`database.md`](database.md).

## Support boundaries

| Path                                            | Windows                                                       |
| ----------------------------------------------- | ------------------------------------------------------------- |
| **Source / contributors** (`bun` + `just`)      | Supported with Git Bash (or WSL2)                             |
| **Linux standalone** (`curl \| bash` → `anima`) | **Not available** — Linux x64 only                            |
| **Desktop NSIS** (end-user Portal shell)        | Install from GitHub Release / canary                          |
| **`just pack tauri-windows`**                   | Cross-compile host is **Linux/macOS**, not “build on Windows” |
| **`just dev tauri`**                            | Native Windows OK (Rust + WebView2)                           |

Recommended contributor path: **native Windows + Git for Windows (bash on PATH) + Docker Desktop** for PostgreSQL/Redis. Use **WSL2** if you prefer the full Linux docs (`install.md` / Debian PG script) without adapting paths.

Data directory: `%USERPROFILE%\.anima` (same as `~/.anima`; override with `FREEANIMA_HOME`).

## Install prerequisites

### winget (preferred)

```powershell
winget install Oven-sh.Bun
winget install Casey.Just
winget install Git.Git
# PostgreSQL + Redis for local Habitat — Docker Desktop:
winget install Docker.DockerDesktop
```

After install, **open a new terminal** so `bun`, `just`, and `bash` are on `PATH`. Confirm:

```powershell
bun --version    # >= 1.3.14
just --version
bash --version   # Git Bash; required by the Justfile
docker version
```

### scoop (alternative)

```powershell
scoop install bun just git
# Docker Desktop: install separately from docker.com if not using scoop
```

### Optional (Portal desktop shell only)

- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (often already present on Windows 10/11)
- [rustup](https://rustup.rs/) + MSVC Build Tools — for `just dev tauri`

## Clone and run

Use **Git Bash** (or WSL) for `just` recipes — the Justfile sets `shell` / `windows-shell` to bash:

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
just dev
```

Configure `%USERPROFILE%\.anima\config.yaml` with a PostgreSQL URL (see [Database](#database) below). Full source steps: [`install.md`](install.md#source-repository).

### Bun bypass (no `just`)

If `just` cannot find `bash`, run the same entrypoints with Bun:

```bash
bun src/portal/cli/dev-habitat.ts          # Habitat; random port ≥10000
bun scripts/dev-web.ts                     # Vite Web; set FREEANIMA_URL to Habitat
bun scripts/dev.ts                         # Habitat then Web (same as just dev)
bun scripts/dev-tauri-desktop.ts           # Tauri shell (need Vite :5000)
```

Quality checks without the interactive chooser:

```bash
just check          # or: just qa check
just qa typecheck
just qa test-changed
```

## Database

Prefer **Docker** on Windows (Debian `setup-postgres-debian.sh` does not apply):

```bash
docker run -d --name anima-pg \
  -e POSTGRES_USER=anima \
  -e POSTGRES_PASSWORD=anima \
  -e POSTGRES_DB=anima \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

`config.yaml`:

```yaml
database:
  url: postgresql://anima:anima@127.0.0.1:5432/anima
```

Extensions ship in the image. More detail: [`database.md`](database.md#local-install-docker-cross-platform).

Redis (optional):

```bash
docker run -d --name anima-redis -p 6379:6379 redis:7
```

## Habitat vs service

- **Source tree**: use `just dev` / `just dev habitat`. The checkout CLI has **no** `anima service` command.
- **`anima service` + systemd**: Linux **standalone** only — there is no Windows Habitat binary from `scripts/install.sh`.
- End-user Windows installs run the **Portal Desktop** shell and connect to a Habitat (local WSL/Linux, LAN, or remote).

## Known limitations

| Workflow                                                   | On Windows                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `just install cli` / `just pack cli`                       | Linux standalone tarball — not a Windows Habitat binary                       |
| `just pack tauri-windows` / `just install tauri-windows`   | Cross-compile from Linux/macOS                                                |
| Android (`just install android`, `just dev tauri-android`) | Expect bash SDK scripts; use WSL or a Linux host                              |
| `just i18n po4a`                                           | Needs system `po4a` (typical apt/brew); optional for most UI work             |
| `just qa test-integration`                                 | Needs Docker Desktop                                                          |
| ACL / `chmod 700 ~/.anima`                                 | Unix docs; on Windows keep the profile directory private via NTFS permissions |

## Security note

Do not put secrets in `config.yaml` or git. Prefer `env()` for bootstrap secrets. See [`security.md`](security.md).
