---
title: Windows 开发
---

# Windows 开发

> 在原生 Windows（或 WSL2）上做源码开发。Linux 独立安装与通用部署步骤见 [`install.md`](install.md)。PostgreSQL：[`database.md`](database.md)。

## 支持边界

| 路径                                                  | Windows                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| **源码 / 贡献者**（`bun` + `just`）                   | 配合 Git Bash（或 WSL2）支持                                        |
| **Linux 独立安装**（`curl \| bash` → `anima`）        | **不可用** — 仅 Linux x64                                           |
| **桌面 NSIS**（终端用户入口壳）                       | 从 GitHub Release / canary 安装                                     |
| **`just pack tauri`** / **`just pack tauri-windows`** | **Windows 本机**（MSVC）；Linux/mac 上 `tauri-windows` 才是交叉编译 |
| **`just dev tauri`**                                  | Windows 本机 OK（Rust + WebView2 + MSVC）                           |

推荐贡献者路径：**原生 Windows + Git for Windows（PATH 上有 bash）+ Docker Desktop**（PostgreSQL/Redis）。若更想直接跟完整 Linux 文档（`install.md` / Debian PG 脚本）而不改路径，用 **WSL2**。

数据目录：`%USERPROFILE%\.anima`（等同 `~/.anima`；可用 `FREEANIMA_HOME` 覆盖）。

## 安装前置

### winget（推荐）

```powershell
winget install Oven-sh.Bun
winget install Casey.Just
winget install Git.Git
# 本地栖息地用的 PostgreSQL + Redis — Docker Desktop：
winget install Docker.DockerDesktop
```

安装后 **新开终端**，确保 `bun`、`just`、`bash` 在 `PATH` 上。确认：

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

`just` 的 `windows-shell` 会调用 PATH 上**第一个** `bash`。若
`C:\Windows\System32\bash.exe`（WSL）排在 Git Bash 前面：

- PowerShell 里 `bun i` 正常（不走 bash）
- `just dev` / `just deps` 报 `/bin/bash: line 1: bun: command not found`（WSL
  里裸 `bun` 常不可用）

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

### scoop（备选）

```powershell
scoop install bun just git
# Docker Desktop: install separately from docker.com if not using scoop
```

确认 `bun --version` ≥ **1.3.14**（与根 `package.json` 的 `packageManager` 一致）。旧
scoop bun 会导致 `Bun.YAML` / `vi.useFakeTimers` 缺失、单测大面积失败；过旧时执行 `scoop update
bun`。

### 可选（仅入口桌面壳）

- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 10/11 上往往已有）
- [rustup](https://rustup.rs/) + MSVC Build Tools — 用于 `just dev tauri` / `just pack tauri`

```powershell
# 检查 / 提示安装 MSVC
just install tauri

# 开发（与 Linux 相同；另开终端先 just dev / just dev web，Vite :5000）
# Coding 窗走 :4186 — capabilities remote.urls 已放行；改 capability 后须重启 tauri
just dev tauri

# 打包 Dev 安装器（与 Linux 的 just pack tauri 对称）
$env:FREEANIMA_BUILD_CHANNEL = "local"
just pack tauri
# 产物：dist/ 下 NSIS，或 src/portal/app/tauri/src-tauri/target/release/bundle/nsis/
```

打包前若 `link.exe` 不在 PATH，先开 **x64 Native Tools Command Prompt**，或：

```bat
call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

## 克隆与运行

`just` 配方请用 **Git Bash**（或 WSL）——Justfile 把 `shell` / `windows-shell` 设为 bash：

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
just dev
```

`just` 在 Windows 上通过 `_common.just` 的 `bun := bun.exe` 调用 Bun；本地
CLI（`drizzle-kit` / `oxlint` / `oxfmt` / `tsgo` / `wxt`）统一为 `{{ bun }} x
…`（即 `bun.exe x`），勿写裸 `bunx`（WSL bash 下常 127）。

`just` 配方经 `_deps` 调用 `bun install --frozen-lockfile`（与 CI 相同）。首次克隆用上面的普通
`bun install`；之后优先 `just deps` / 任意 `just …` 配方，避免随意改写 lockfile。

在 `%USERPROFILE%\.anima\config.yaml` 配置 PostgreSQL URL（见下方
[数据库](#数据库)）。完整源码步骤：[`install.md`](install.md#source-repository)。

### npm 镜像（中国 / `registry.npmjs.org` 较慢）

**不要**把镜像写进仓库 `bunfig.toml`，也**不要**把镜像 URL 提交进 `bun.lock`。Bun 会把绝对
tarball URL 写进 lockfile；镜像 registry 会改写它们并破坏可移植性。

**仅本机**加速时，用用户级配置，并保持 `bun.lock` 与 registry 无关（`""` resolved 字段）：

```toml
# %USERPROFILE%\.bunfig.toml  (not committed)
[install]
registry = "https://registry.npmmirror.com"
```

- 日常安装（`just`、`bun install --frozen-lockfile`）：经镜像拉取；lockfile 不变。
- **更新** lockfile（`bun add` / `bun update` / 可能改写 `bun.lock` 的普通 `bun install`）时，强制官方 registry，使新条目可移植：

```bash
bun install --registry=https://registry.npmjs.org
# or: bun add <pkg> --registry=https://registry.npmjs.org
```

提交前确认 `bun.lock` 中没有 `registry.npmmirror.com`（或其他镜像）主机名。

### Bun 直跑（不用 `just`）

若 `just` 找不到 `bash`，用 Bun 跑同一套入口：

```bash
bun src/portal/cli/dev-habitat.ts          # Habitat; random port ≥10000
bun scripts/dev-web.ts                     # Vite Web; set FREEANIMA_URL to Habitat
bun scripts/dev.ts                         # Habitat then Web (same as just dev)
bun scripts/dev-tauri-desktop.ts           # Tauri shell (need Vite :5000)
```

不做交互选择器的质量检查：

```bash
just check          # or: just qa check
just qa typecheck
just qa test-changed
```

## 数据库

Windows 上优先 **Docker**（Debian 的 `setup-postgres-debian.sh` 不适用）：

```bash
docker run -d --name anima-pg \
  -e POSTGRES_USER=anima \
  -e POSTGRES_PASSWORD=anima \
  -e POSTGRES_DB=anima \
  -p 5432:5432 \
  pgvector/pgvector:pg18
```

`config.yaml`：

```yaml
database:
  url: postgresql://anima:anima@127.0.0.1:5432/anima
```

扩展已打进镜像。更多细节：
[`database.md`](database.md#local-install-docker-cross-platform)。

Redis（可选）：

```bash
docker run -d --name anima-redis -p 6379:6379 redis:7
```

## 栖息地 vs service

- **源码树**：用 `just dev` / `just dev habitat`。checkout 的 CLI **没有** `anima service` 命令。
- **`anima service` + systemd**：仅 Linux **独立安装** — `scripts/install.sh` 不会产出 Windows 栖息地二进制。
- 终端用户 Windows 安装跑的是 **入口桌面** 壳，并连接到栖息地（本机 WSL/Linux、局域网或远程）。

## 已知限制

| 工作流                                                      | 在 Windows 上                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `just install cli` / `just pack cli`                        | Linux 独立安装 tarball — 不是 Windows 栖息地二进制                         |
| `just pack tauri-windows` / `just install tauri-windows`    | 在 Windows 上 = 与宿主 `tauri` 相同（MSVC）；仅 Linux/macOS 上才是交叉编译 |
| Android（`just install android`、`just dev tauri-android`） | 期望 bash SDK 脚本；用 WSL 或 Linux 主机                                   |
| `just qa test-integration`                                  | 需要 Docker Desktop                                                        |
| ACL / `chmod 700 ~/.anima`                                  | Unix 文档写法；Windows 上用 NTFS 权限保持配置目录私有                      |

## 安全说明

不要把密钥写进 `config.yaml` 或 git。引导密钥优先 `env()`。见 [`security.md`](security.md)。
