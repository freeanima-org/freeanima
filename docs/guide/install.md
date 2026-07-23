---
title: Installation
---

# Installation

> Deploy FreeAnima on your machine — from source, or with a Linux standalone executable.
> After install: [`security.md`](security.md) (credentials, bind address) · [`database.md`](database.md) (PostgreSQL) · [`service.md`](service.md) (runtime commands) · [`remote-access.md`](remote-access.md) (Service API Token / LAN).

## Choose a path

| Path           | Best for                                  | Bun on host | PostgreSQL  | Redis                  | Secrets                       |
| -------------- | ----------------------------------------- | ----------- | ----------- | ---------------------- | ----------------------------- |
| **Source**     | Contributors, day-to-day development      | Required    | You install | Optional (recommended) | Vault / `env()` (recommended) |
| **Standalone** | Production / self-host without a checkout | Not needed  | You install | Optional (recommended) | Vault / `env()` (recommended) |

Both paths run the same `anima service` runtime (Habitat REST `/api` + Habitat RPC `/rpc/v1` + engine). PostgreSQL with **pgvector** is **required**. Redis powers EventBus and task context; it **degrades silently** when unavailable — production setups should still run it.

## Shared prerequisites

| Component      | Version / notes                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Bun**        | >= 1.3.14 — required for **source** installs ([bun.sh](https://bun.sh)); not required for standalone binaries          |
| **PostgreSQL** | 17 recommended; extensions: `vector`, FTS helpers — see [`database.md`](database.md)                                   |
| **Redis**      | 7.x recommended; defaults to `127.0.0.1:6379` when configured                                                          |
| **Vault**      | Recommended — API keys and DB URLs stay out of config files ([`security.md`](security.md#credential-responsibilities)) |

Data directory: `~/.anima/` (override with `FREEANIMA_HOME`). Back it up with your database.

---

## Standalone (Linux x64)

Release publishes 三端产物（与 canary 对称）：`anima-linux-x64.tar.gz`、`freeanima-desktop-windows-x64-setup.exe`、`freeanima-mobile-android.apk`（CI 固定 upload 签名；本地 `debug:android` 仍为默认 debug 签名）。Standalone tarball 内含单文件可执行文件 `anima`；版本、service build-meta、migrations 与 Web UI 均嵌入该二进制。

### 1. Install (recommended)

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

Install prefix keeps versioned binaries as `anima_<version>` plus an `anima` symlink to the current version (up to 7 versions retained). Do not unpack into a git checkout. Ensure `~/.local/bin` is on `PATH`.

Manual unpack (same layout as the installer):

```bash
mkdir -p ~/.anima/standalone && cd ~/.anima/standalone
tar -xzf /path/to/anima-linux-x64.tar.gz
# assume extracted file is ./anima — rename to versioned file then link
mv anima anima_0.9.2
ln -sfn anima_0.9.2 anima
mkdir -p ~/.local/bin && ln -sfn "$PWD/anima" ~/.local/bin/anima
```

Or from a checkout: `just install-cli` (builds then installs to the same default prefix).

Installed standalone 可用内置升级换轨与本机版本切换：

```bash
anima upgrade --channel canary   # 跟随 canary tip
anima upgrade --channel release  # 切回稳定轨 tip
anima versions                   # 列出本机 anima_*（* = current）
anima versions use 0.9.2         # 切换 current symlink
```

**Mobile Android APK**（`freeanima-mobile-android.apk`）：从 GitHub Release（`canary` 或版本 tag）下载 sideload。CI 使用固定 upload 签名，同 channel 内可覆盖升级。若曾安装旧版未固定签名的包，或密钥轮换后，需先卸载 `FreeAnima`（`org.freeanima.app`）再安装。

### 2. Configure

```bash
mkdir -p ~/.anima
chmod 700 ~/.anima
# copy config.example.yaml from the repo, or write manually
cp /path/to/freeanima-checkout/config.example.yaml ~/.anima/config.yaml
```

Minimum production settings in `~/.anima/config.yaml` (**bootstrap only**):

- **`database.url`** — PostgreSQL connection string (required)
- **`web.enabled`** — Habitat hosts `/web/*` when dist exists (optional; defaults to on if omitted)

**Runtime settings** (LLM providers, compression, MCP, etc.) are stored in PostgreSQL (`habitat_runtime_config`). Edit them in the Shell app under **Settings → Habitat 服务 → 服务配置**.

Prefer Vault or `env()` for secrets. See [`security.md`](security.md#credential-responsibilities).

### 3. Start the service

```bash
anima service start              # background (systemd user unit when available)
anima service start --foreground # debug — logs to stdout
anima service status
```

Default bind: `127.0.0.1:2658`（Habitat API：`/api`，Habitat RPC：`/rpc/v1`；Web UI：`/web/*` when `config.yaml` `web.enabled`).

### 4. Upgrade

Installed standalone (independent prefix, e.g. `~/.anima/standalone`):

```bash
anima upgrade                 # 当前 bake channel 内升级（release：semver；canary：commit）
anima upgrade --check
anima upgrade --channel canary   # 切到 / 检查 canary tip
anima upgrade --proxy ghproxy-net
anima upgrade --check --channel canary --proxy ghfast-top
```

升级时 Habitat 在**下载与校验阶段保持在线**；若 service 原先在运行，仅在替换二进制瞬间短暂停服并自动拉起。未运行 service 时仅写入新的 `anima_<version>` 并切换 `anima` symlink，不会自动启动。

```bash
anima service restart   # 手动升级二进制后若未自动拉起时使用
anima versions use <id> # 回退到本机已保留的旧版本（同样会按需停/启 service）
```

Re-run the curl installer to reinstall/overwrite the same prefix, or from a checkout rebuild and reinstall (never into the repo):

```bash
just install-cli
```

`dist/anima-executable/` is build staging only — not a runtime prefix.

### Build from a checkout

Always runs `build:web` before compiling the binary (embeds current Web dist):

```bash
bun run build:cli:executable
# → dist/anima-executable/ (staging)
just install-cli
# → ~/.anima/standalone/anima_<version> + anima symlink + ~/.local/bin/anima
anima --version
```

Override prefix: `FREEANIMA_INSTALL_PREFIX=/opt/freeanima just install-cli` or `bun scripts/install-cli.ts --prefix /opt/freeanima --skip-build`.

---

## Source (repository)

For development, unreleased fixes, or running from a git checkout.

### 1. Clone and install dependencies

**Prerequisites:** Bun >= 1.3.14 · PostgreSQL (pgvector) · Redis (recommended) · Vault (recommended) · [just](https://github.com/casey/just) (for `just install-cli`)

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
```

### 2. Run the CLI from the checkout

Do **not** symlink source `cli.ts` into a global bin. Use package scripts:

```bash
bun run anima -- --help
bun run service start --foreground
```

To install a **standalone** binary into an independent prefix (default `~/.anima/standalone`) for a PATH `anima` command:

```bash
just install-cli
# ensure ~/.local/bin is on PATH
anima --version
```

### 3. Configure and start

```bash
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml
# configure database + LLM (see database.md, security.md)
```

**Dev** (Habitat + Vite HMR; never auto-builds Web). Prefer `just dev` for multi-worktree:

```bash
just dev            # Habitat random ≥10000 + Web from :5000; FREEANIMA_URL wires Vite proxy only
# or two terminals:
bun run dev:habitat     # random ≥10000 (not production 2658); writes ~/.anima/dev-web.token
FREEANIMA_URL=http://127.0.0.1:<habitat-port> bun run dev:web   # default :5000; browser Habitat = page origin
```

Browser Web defaults Habitat URL to the **page origin** (same in production Habitat-hosted `/web` and Vite). Dev injects Service API Token from `dev-web.token` automatically. If `http.tls.enabled` / `DEV_HTTPS=1`, Vite serves HTTPS using `~/.anima/tls` (Habitat stays plain HTTP). Source `dev:habitat` also **ignores** `config.yaml` `web.enabled` / `web.host` / `web.port` — Habitat does not host `/web` dist; use Vite (`WEB_DEV_PORT`, default 5000).

**Source deploy** (Habitat hosts `/web/*` when `config.yaml` `web.enabled`): build Web first, then start — startup does not run `build:web`. Source-tree `anima` has no `service` command.

```bash
bun run build:web
bun run dev:habitat
# UI: http://127.0.0.1:2658/web/chat
```

### 4. Development checks

```bash
bun run check    # typecheck + lint + format + changed unit tests
bun run test     # full unit + integration (integration may use Docker for temp PG)
```

Upgrade manually: `git pull`, `bun install`, then restart the service. `anima upgrade` / `/upgrade` print instructions only.

---

## Verify installation

Requires the **standalone** `anima` binary (`anima service` is not on the source-tree CLI).

```bash
anima service start
anima token create --subject-id 1 --name bootstrap
# 将输出的 fa_at_... 填入客户端 Habitat 设置

anima service status
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/rpc/v1/status/get | jq '.version, .memory_kb'
```

If status fails, check PostgreSQL connectivity, that migrations completed ([`database.md`](database.md#troubleshooting)), and that a valid Service API Token is configured.

## Next steps

1. **Security** — Vault / `env()` for secrets, `chmod 700 ~/.anima`, do not expose Habitat without auth ([`security.md`](security.md))
2. **Remote access** — Service API Token + LAN / local HTTPS for personal mobile/remote Habitat ([`remote-access.md`](remote-access.md))
3. **Database** — backups, extensions, manual migrations if needed ([`database.md`](database.md))
4. **Operations** — start/stop, memory metrics ([`service.md`](service.md))
5. **Architecture** — memory pipeline, self layer, tools ([`../concepts/architecture.md`](../concepts/architecture.md))
