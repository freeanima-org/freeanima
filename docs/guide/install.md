---
title: Installation
---

# Installation

> Deploy FreeAnima on your machine — from source, or with a Linux standalone executable.
> After install: [`security.md`](security.md) (credentials, bind address) · [`database.md`](database.md) (PostgreSQL) · [`service.md`](service.md) (runtime commands) · [`remote-access.md`](remote-access.md) (Cloudflare Tunnel).

## Choose a path

| Path           | Best for                                  | Bun on host | PostgreSQL  | Redis                  | Secrets                       |
| -------------- | ----------------------------------------- | ----------- | ----------- | ---------------------- | ----------------------------- |
| **Source**     | Contributors, day-to-day development      | Required    | You install | Optional (recommended) | Vault / `env()` (recommended) |
| **Standalone** | Production / self-host without a checkout | Not needed  | You install | Optional (recommended) | Vault / `env()` (recommended) |

Both paths run the same `anima service` runtime (Hub REST `/api` + Hub RPC `/hub/rpc/v1` + engine). PostgreSQL with **pgvector** is **required**. Redis powers EventBus and task context; it **degrades silently** when unavailable — production setups should still run it.

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

Release publishes a single tarball: `anima-linux-x64.tar.gz` (executable + `package.json` + `dist/build-meta.json`). Migrations and Web UI are embedded in the binary.

### 1. Download and unpack

```bash
# From a GitHub Release asset (example)
mkdir -p ~/freeanima && cd ~/freeanima
tar -xzf anima-linux-x64.tar.gz
./anima --version   # e.g. 0.8.5 (standalone) · prod
```

Keep the directory layout: `anima`, `package.json`, and `dist/` stay siblings. Optionally put the directory on your `PATH` or symlink `anima`.

### 2. Configure

```bash
mkdir -p ~/.anima
chmod 700 ~/.anima
# copy config.example.yaml from the repo, or write manually
cp /path/to/freeanima-checkout/config.example.yaml ~/.anima/config.yaml
```

Minimum production settings in `~/.anima/config.yaml` (**bootstrap only**):

- **`database.url`** — PostgreSQL connection string (required)
- **`web.enabled`** — Hub hosts `/web/*` when dist exists (optional; defaults to on if omitted)

**Runtime settings** (LLM providers, compression, MCP, etc.) are stored in PostgreSQL (`hub_runtime_config`). Edit them in the Shell app under **Settings → Hub 服务 → 服务配置**.

Prefer Vault or `env()` for secrets. See [`security.md`](security.md#credential-responsibilities).

### 3. Start the service

```bash
./anima service start              # background (systemd user unit when available)
./anima service start --foreground # debug — logs to stdout
./anima service status
```

Default bind: `127.0.0.1:2658`（Hub API：`/api`，Hub RPC：`/hub/rpc/v1`；Web UI：`/web/*` when `config.yaml` `web.enabled`).

### 4. Upgrade

Replace the install directory with a new release tarball (or rebuild with `bun run build:cli:executable`), then `anima service restart`. `anima upgrade` / `/upgrade` only print guidance.

### Build from a checkout

Always runs `build:web` before compiling the binary (embeds current Web dist):

```bash
bun run build:cli:executable
# → dist/anima-executable/
./dist/anima-executable/anima --version
```

---

## Source (repository)

For development, unreleased fixes, or running from a git checkout.

### 1. Clone and install dependencies

**Prerequisites:** Bun >= 1.3.14 · PostgreSQL (pgvector) · Redis (recommended) · Vault (recommended)

```bash
git clone https://github.com/freeanima-org/freeanima.git
cd freeanima
bun install
```

### 2. Expose the `anima` command

Link the workspace CLI into your Bun global bin (editable without rebuild):

```bash
bun run link:global
anima --help
```

Alternatively, use the repo entry directly:

```bash
bun run anima -- --help
# or
bun src/app/cli/cli.ts --help
```

### 3. Configure and start

```bash
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml
# configure database + LLM (see database.md, security.md)
```

**Dev** (Hub + Vite HMR; service never auto-builds Web):

```bash
bun run dev:service   # terminal 1: Hub REST + SAP
bun run dev:web       # terminal 2: http://127.0.0.1:4173/web/chat · Console /web/console/dashboard
```

**Source deploy** (Hub hosts `/web/*` when `config.yaml` `web.enabled`): build Web first, then start — startup does not run `build:web`.

```bash
bun run build:web
anima service start --foreground
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

```bash
anima service start
anima token create --subject-id 1 --name bootstrap
# 将输出的 fa_at_... 填入客户端 Hub 设置

anima service status
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/hub/rpc/v1/status/get | jq '.version, .memory_kb'
```

If status fails, check PostgreSQL connectivity, that migrations completed ([`database.md`](database.md#troubleshooting)), and that a valid Service API Token is configured.

## Next steps

1. **Security** — Vault / `env()` for secrets, `chmod 700 ~/.anima`, do not expose Console without auth ([`security.md`](security.md))
2. **Remote access** — optional Cloudflare Tunnel + Service API Token for personal mobile/remote Console ([`remote-access.md`](remote-access.md))
3. **Database** — backups, extensions, manual migrations if needed ([`database.md`](database.md))
4. **Operations** — start/stop, memory metrics ([`service.md`](service.md))
5. **Architecture** — memory pipeline, self layer, tools ([`../concepts/architecture.md`](../concepts/architecture.md))
