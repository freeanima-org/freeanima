---
title: 安装
---

# 安装

> 在本机部署逸灵风 —— 从源码，或用 Linux 独立可执行文件。
> 安装后：[`security.md`](security.md)（凭证、绑定地址）· [`database.md`](database.md)（PostgreSQL）· [`service.md`](service.md)（运行时命令）· [`remote-access.md`](remote-access.md)（Service API Token / 局域网）。

## 选择安装方式

| 路径         | 最适合                      | 宿主 OS               | 宿主是否需 Bun | 说明                                                                         |
| ------------ | --------------------------- | --------------------- | -------------- | ---------------------------------------------------------------------------- |
| **源码**     | 贡献者、日常开发            | Linux、macOS、Windows | 必需           | 自行安装 PostgreSQL（pgvector）+ 可选 Redis；bootstrap `env()`，运行时 Vault |
| **独立发行** | 无 checkout 的生产 / 自托管 | **仅 Linux x64**      | 不需要         | 与 `anima service` 同一栖息地运行时；同样的 DB/Redis/密钥预期                |

两条路径跑同一栖息地运行时（REST `/api` + 栖息地 RPC `/rpc/v1` + engine）。独立发行以 `anima service` 暴露；源码用 `just dev` / `just dev habitat`。带 **pgvector** 的 PostgreSQL **必需**。Redis 对缓存/KV 可选，**多栖息地进程共用一个 PostgreSQL 时推荐** —— 后台任务用 `anima:lock:*` 下的分布式锁（sleep-cycle、cron、reminders、FTS rebuild、migrate）；无 Redis 时锁退化为仅进程内。栖息地生命周期通知用进程内 HookRegistry `subscribe`。

**Windows：** 无独立栖息地二进制。用[源码开发](windows-dev.md)（Git Bash + Docker），或在 Linux/WSL/远程跑栖息地并连接桌面 NSIS 壳。

## 共用前置条件

| 组件           | 版本 / 说明                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**        | >= 1.3.14 — **源码**安装必需（[bun.sh](https://bun.sh)；Windows：`winget install Oven-sh.Bun`）；独立二进制不需要                                          |
| **just**       | [casey/just](https://github.com/casey/just) — Justfile 需要 `PATH` 上的 **bash**（原生 Windows 用 Git for Windows；见 [`windows-dev.md`](windows-dev.md)） |
| **PostgreSQL** | 推荐 17；扩展：`vector`、FTS 辅助 — 见 [`database.md`](database.md)（Docker 为跨平台默认）                                                                 |
| **Redis**      | 推荐 7.x；配置后默认 `127.0.0.1:6379`                                                                                                                      |
| **Vault**      | 栖息地起来后推荐用于运行时密钥；bootstrap `config.yaml` 仅用 `env()`（[`security.md`](security.md#credential-responsibilities)）                           |

数据目录：Unix 为 `~/.anima/`，Windows 为 `%USERPROFILE%\.anima`（可用 `FREEANIMA_HOME` 覆盖）。与数据库一并备份。

---

## 独立发行（Linux x64）

Release 发布三端产物（与 canary 对称）：updater 固定名 `anima-linux-x64.tar.gz`、`freeanima-desktop-windows-x64-setup.exe`、`freeanima-mobile-android.apk`（另附同内容的 `{ver}-{channel}` 版本化文件名）。CI 固定 upload 签名；本地 `just dev tauri-android` 仍为默认 debug 签名。Standalone tarball 内含单文件可执行文件 `anima`；版本、service build-meta、migrations 与 Web UI 均嵌入该二进制。

### 1. 安装（推荐）

```bash
curl -fsSL https://freeanima.com/install | bash
anima --version   # e.g. 0.8.5 (standalone) · release
```

Canary（`main` 滚动 Pre-release tag `canary`）或 pin 版本：

```bash
curl -fsSL https://freeanima.com/install | CHANNEL=canary bash
curl -fsSL https://freeanima.com/install | VERSION=v0.8.5 bash
```

国内网络可指定公共 GitHub 反代（`PROXY=none|ghproxy-net|gh-proxy-com|ghfast-top`，默认 `none`）：

```bash
curl -fsSL https://freeanima.com/install | PROXY=ghproxy-net bash
curl -fsSL https://freeanima.com/install | CHANNEL=canary PROXY=ghfast-top bash
```

可选环境变量：`FREEANIMA_INSTALL_PREFIX`（默认 `~/.anima/standalone`）、`FREEANIMA_HOME`（默认 `~/.anima`，数据目录）。

备用（不依赖站点发布）：

```bash
curl -fsSL https://raw.githubusercontent.com/freeanima-org/freeanima/main/scripts/install.sh | bash
```

安装前缀以 `anima_<version>` 保留版本化二进制，外加指向当前版本的 `anima` 符号链接（最多保留 7 个版本）。不要解压进 git checkout。确保 `~/.local/bin` 在 `PATH` 上。

手动解压（与安装器相同布局）：

```bash
mkdir -p ~/.anima/standalone && cd ~/.anima/standalone
tar -xzf /path/to/anima-linux-x64.tar.gz
# assume extracted file is ./anima — rename to versioned file then link
mv anima anima_0.9.2
ln -sfn anima_0.9.2 anima
mkdir -p ~/.local/bin && ln -sfn "$PWD/anima" ~/.local/bin/anima
```

或从 checkout：`just install cli`（构建后安装到同一默认前缀）。

已安装的独立发行可用内置升级换轨与本机版本切换：

```bash
anima upgrade --channel canary   # 跟随 canary tip
anima upgrade --channel release  # 切回稳定轨 tip
anima versions                   # 列出本机 anima_*（* = current）
anima versions use 0.9.2         # 切换 current symlink
```

**移动 Android APK**（`freeanima-mobile-android.apk`）：从 GitHub Release（`canary` 或版本 tag）下载 sideload。CI 使用固定 upload 签名，同 channel 内可覆盖升级。若曾安装旧版未固定签名的包、密钥轮换后、或从旧包名 `org.freeanima.app` 迁移，需先卸载后再安装（正式包名 `com.freeanima.portal`；本机 local 包为 `com.freeanima.portal.dev`）。

### 2. 配置

```bash
mkdir -p ~/.anima
chmod 700 ~/.anima
# copy config.example.yaml from the repo, or write manually
cp /path/to/freeanima-checkout/config.example.yaml ~/.anima/config.yaml
```

`~/.anima/config.yaml` 中最低生产设置（**仅 bootstrap**）：

- **`database.url`** — PostgreSQL 连接字符串（必需）

**运行时设置**（LLM 连接、压缩、MCP 等）存在 PostgreSQL（`habitat_runtime_config`）。在壳应用 **设置 → 栖息地服务 → 服务配置** 中编辑。有 Web dist 时栖息地即托管 `/web/*`（无 bootstrap 开关）。

bootstrap 密钥在 `config.yaml` 中优先用 `env()`（PostgreSQL 起来前 Vault 不可用）。PG 中的运行时密钥用 Vault / `vault()`。见 [`security.md`](security.md#credential-responsibilities)。

### 3. 启动服务

```bash
anima service start              # background (systemd user unit when available)
anima service start --foreground # debug — logs to stdout
anima service status
```

默认绑定：`127.0.0.1:2658`（栖息地 API：`/api`，栖息地 RPC：`/rpc/v1`；有 dist 时 Web UI：`/web/*`）。

### 4. 升级

已安装的独立发行（独立前缀，如 `~/.anima/standalone`）：

```bash
anima upgrade                 # 当前 bake channel 内升级（release：semver；canary：commit）
anima upgrade --check
anima upgrade --channel canary   # 切到 / 检查 canary tip
anima upgrade --proxy ghproxy-net
anima upgrade --check --channel canary --proxy ghfast-top
```

升级时栖息地在**下载与校验阶段保持在线**；若 service 原先在运行，仅在替换二进制瞬间短暂停服并自动拉起。未运行 service 时仅写入新的 `anima_<version>` 并切换 `anima` symlink，不会自动启动。

亦可在 **设置 → 关于 → 服务 → 检查更新**，或经 `toolset_load(["ops"])` 后调用 `ops_update_check` / `ops_update_apply`（后者须 clarify + `confirm: true`）。

```bash
anima service restart   # 手动升级二进制后若未自动拉起时使用
anima versions use <id> # 回退到本机已保留的旧版本（同样会按需停/启 service）
```

重新跑 curl 安装器可重装/覆盖同一前缀，或从 checkout 重建并再安装（永不装进仓库内）：

```bash
just install cli
```

`dist/anima-executable/` 仅构建暂存 —— 不是运行时前缀。

### 从 checkout 构建

编译二进制前总会跑 `just pack web`（嵌入当前 Web dist）：

```bash
just pack cli
# → dist/anima-executable/ (staging)
just install cli
# → ~/.anima/standalone/anima_<version> + anima symlink + ~/.local/bin/anima
anima --version
```

覆盖前缀：`FREEANIMA_INSTALL_PREFIX=/opt/freeanima just install cli` 或 `bun scripts/install-cli.ts --prefix /opt/freeanima --skip-build`。

---

## 源码（仓库）

用于开发、未发布修复或从 git checkout 运行。

### 1. 克隆并安装依赖

**前置：** Bun >= 1.3.14 · PostgreSQL（pgvector）· Redis（推荐）· Vault（推荐）· [just](https://github.com/casey/just)（`PATH` 上有 bash —— Windows 用 Git Bash）。Windows 搭建：[`windows-dev.md`](windows-dev.md)。

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
```

### 2. 从 checkout 跑 CLI

**不要**把源码 `cli.ts` 符号链接到全局 bin。在 checkout 内：

```bash
bun packages/habitat/portal/cli/cli.ts -- --help
just dev
```

要把**独立**二进制装到独立前缀（默认 `~/.anima/standalone`）以便 `PATH` 上有 `anima`：

```bash
just install cli
# ensure ~/.local/bin is on PATH
anima --version
```

### 3. 配置并启动

```bash
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml
# configure database (bootstrap); LLM in Shell Habitat 服务配置 (see database.md, security.md)
```

**开发**（栖息地 + Vite HMR；永不自动构建 Web）。多 worktree 优先 `just dev`：

```bash
just dev            # Habitat random ≥10000 + Web from :5000; FREEANIMA_URL wires Vite proxy only
# or two terminals:
just dev habitat     # random ≥10000 (not production 2658); writes ~/.anima/dev-web.token
FREEANIMA_URL=http://127.0.0.1:<habitat-port> just dev web   # default :5000; browser Habitat = page origin
```

浏览器 Web 默认栖息地 URL 为**页面 origin**（生产栖息地托管的 `/web` 与 Vite 相同）。开发从 `dev-web.token` 自动注入 Service API Token。源码 Vite **默认 HTTP**；仅显式 `DEV_HTTPS=1` 时用 `~/.anima/tls` 提供 HTTPS（栖息地仍为明文 HTTP；不跟 `config.yaml` `http.tls.enabled`）。源码 `just dev habitat` **不**托管 `/web` dist —— 用 Vite（`WEB_DEV_PORT`，默认 5000）。

**源码部署**（有 dist 时栖息地托管 `/web/*`）：先构建 Web 再启动 —— 启动不会跑 `just pack web`。源码树的 `anima` 无 `service` 命令。

```bash
just pack web
just dev habitat
# UI: http://127.0.0.1:2658/web/chat
```

### 4. 开发检查

```bash
just check    # typecheck + lint + format + changed unit tests
just test     # full unit + integration (integration may use Docker for temp PG)
```

手动升级——`git pull`、`bun install`，然后重启服务。`anima upgrade`、设置「关于→服务」与 `ops_update_*` 对源码安装仅提示说明，不会自动升级。

---

## 验证安装

需要**独立发行**的 `anima` 二进制（源码树 CLI 上没有 `anima service`）。

```bash
anima service start
anima token create --subject-id 1 --name bootstrap
# 将输出的 fa_at_... 填入客户端 Habitat 设置

anima service status
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/rpc/v1/status/get | jq '.version, .memory_kb'
```

若 status 失败，检查 PostgreSQL 连通性、迁移是否完成（[`database.md`](database.md#troubleshooting)），以及是否已配置有效的 Service API Token。

## 后续步骤

1. **安全** — bootstrap `env()` + 运行时 Vault，`chmod 700 ~/.anima`（Windows：见 [`windows-dev.md`](windows-dev.md)），无认证勿暴露栖息地（[`security.md`](security.md)）
2. **远程访问** — Service API Token + 局域网 / 本机 HTTPS，供个人移动/远程栖息地（[`remote-access.md`](remote-access.md)）
3. **数据库** — 备份、扩展、必要时手动迁移（[`database.md`](database.md)）
4. **Windows 开发** — winget / Git Bash / Docker（[`windows-dev.md`](windows-dev.md)）
5. **运维** — 启停、内存指标（[`service.md`](service.md)）
6. **架构** — 记忆管线、自我层、工具（[`product/architecture.md`](../product/architecture.md)）
