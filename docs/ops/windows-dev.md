---
title: Windows development
---

# Windows development

> Source development on native Windows (or WSL2). For Linux standalone install and general deploy steps, see [`install.md`](install.md). PostgreSQL: [`database.md`](database.md).

## Support boundaries

| Path                                                  | Windows                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| **Source / contributors** (`bun` + `just`)            | Supported with Git Bash (or WSL2)                                        |
| **Linux standalone** (`curl \| bash` → `anima`)       | **Not available** — Linux x64 only                                       |
| **Desktop NSIS** (end-user Portal shell)              | Install from GitHub Release / canary                                     |
| **`just pack tauri`** / **`just pack tauri-windows`** | **Native on Windows**（MSVC）；Linux/mac 上 `tauri-windows` 才是交叉编译 |
| **`just dev tauri`**                                  | Native Windows OK（Rust + WebView2 + MSVC）                              |

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
bash --version   # 必须是 Git Bash（MINGW），不要是 WSL
Get-Command bash | Select-Object -ExpandProperty Source
# 期望：…\scoop\shims\bash.exe 或 …\Git\bin\bash.exe
# 若是 C:\Windows\System32\bash.exe → WSL 抢先，见下方「WSL bash 抢 PATH」
docker version
```

### WSL bash 抢 PATH（`just` → `bun: command not found`）

`just` 的 `windows-shell` 会调用 PATH 上**第一个** `bash`。若 `C:\Windows\System32\bash.exe`（WSL）排在 Git Bash 前面：

- PowerShell 里 `bun i` 正常（不走 bash）
- `just dev` / `just deps` 报 `/bin/bash: line 1: bun: command not found`（WSL 里裸 `bun` 常不可用）

**临时（当前终端）：**

```powershell
# scoop Git Bash
$env:Path = "$env:USERPROFILE\scoop\shims;$env:Path"
# 或 Git for Windows：
# $env:Path = "C:\Program Files\Git\bin;$env:Path"
Get-Command bash | Select-Object -ExpandProperty Source   # 确认已不是 System32
just deps
```

**持久：** 在「环境变量」里把 `…\scoop\shims` 或 `C:\Program Files\Git\bin` 挪到 **用户 PATH 最前**（至少早于会解析到 System32 的条目）；或在「应用执行别名」里关掉 WSL 的 `bash.exe`。Justfile 在 Windows 上会调用 `bun.exe` 减轻该问题，但仍建议 `bash` 本身是 Git Bash。

### scoop (alternative)

```powershell
scoop install bun just git
# Docker Desktop: install separately from docker.com if not using scoop
```

确认 `bun --version` ≥ **1.3.14**（与根 `package.json` 的 `packageManager` 一致）。旧 scoop bun 会导致 `Bun.YAML` / `vi.useFakeTimers` 缺失、单测大面积失败；过旧时执行 `scoop update bun`。

### Optional (Portal desktop shell only)

- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (often already present on Windows 10/11)
- [rustup](https://rustup.rs/) + MSVC Build Tools — for `just dev tauri` / `just pack tauri`

```powershell
# 检查 / 提示安装 MSVC
just install tauri

# 开发（与 Linux 相同；另开终端先 just dev / just dev web，Vite :5000）
# Coding 窗走 :4186 — capabilities remote.urls 已放行；改 capability 后须重启 tauri
just dev tauri

# 打包 Dev 安装器（与 Linux 的 just pack tauri 对称）
$env:FREEANIMA_BUILD_CHANNEL = "dev"
just pack tauri
# 产物：dist/ 下 NSIS，或 src/portal/app/tauri/src-tauri/target/release/bundle/nsis/
```

打包前若 `link.exe` 不在 PATH，先开 **x64 Native Tools Command Prompt**，或：

```bat
call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

## Clone and run

Use **Git Bash** (or WSL) for `just` recipes — the Justfile sets `shell` / `windows-shell` to bash:

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
just dev
```

`just` 在 Windows 上通过 `_common.just` 的 `bun := bun.exe` 调用 Bun；本地 CLI（`drizzle-kit` / `oxlint` / `oxfmt` / `tsgo` / `wxt`）统一为 `{{ bun }} x …`（即 `bun.exe x`），勿写裸 `bunx`（WSL bash 下常 127）。

`just` recipes call `bun install --frozen-lockfile` via `_deps` (same as CI). First clone uses plain `bun install` above; afterward prefer `just deps` / any `just …` recipe so the lockfile is not rewritten casually.

Configure `%USERPROFILE%\.anima\config.yaml` with a PostgreSQL URL (see [Database](#database) below). Full source steps: [`install.md`](install.md#source-repository).

### npm registry (China / slow `registry.npmjs.org`)

Do **not** put a mirror in the repo `bunfig.toml` or commit mirror URLs into `bun.lock`. Bun stores absolute tarball URLs in the lockfile; a mirror registry will rewrite them and break portability.

For **local-only** acceleration, use a user-level config and keep `bun.lock` registry-agnostic (`""` resolved fields):

```toml
# %USERPROFILE%\.bunfig.toml  (not committed)
[install]
registry = "https://registry.npmmirror.com"
```

- Daily installs (`just`, `bun install --frozen-lockfile`): fetch via the mirror; lockfile stays unchanged.
- When **updating** the lockfile (`bun add` / `bun update` / plain `bun install` that may rewrite `bun.lock`), force the official registry so new entries stay portable:

```bash
bun install --registry=https://registry.npmjs.org
# or: bun add <pkg> --registry=https://registry.npmjs.org
```

Before commit, confirm `bun.lock` has no `registry.npmmirror.com` (or other mirror) hostnames.

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
| `just pack tauri-windows` / `just install tauri-windows`   | On Windows = same as host `tauri`（MSVC）；cross-compile only on Linux/macOS  |
| Android (`just install android`, `just dev tauri-android`) | Expect bash SDK scripts; use WSL or a Linux host                              |
| `just i18n po4a`                                           | Needs system `po4a` (typical apt/brew); optional for most UI work             |
| `just qa test-integration`                                 | Needs Docker Desktop                                                          |
| ACL / `chmod 700 ~/.anima`                                 | Unix docs; on Windows keep the profile directory private via NTFS permissions |

## Security note

Do not put secrets in `config.yaml` or git. Prefer `env()` for bootstrap secrets. See [`security.md`](security.md).
