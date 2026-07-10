---
title: Installation
---

# Installation

> Deploy FreeAnima on your machine — npm CLI, Docker Compose, or from source.
> After install: [`security.md`](security.md) (credentials, bind address) · [`database.md`](database.md) (PostgreSQL) · [`service.md`](service.md) (runtime commands) · [`remote-access.md`](remote-access.md) (Cloudflare Tunnel).

## Choose a path

| Path               | Best for                                   | PostgreSQL  | Redis                  | Secrets                       |
| ------------------ | ------------------------------------------ | ----------- | ---------------------- | ----------------------------- |
| **npm CLI**        | Day-to-day self-hosting on your OS         | You install | Optional (recommended) | Vault / `env()` (recommended) |
| **Docker Compose** | Quick trial, minimal host setup            | Bundled     | Bundled                | `.env` env vars               |
| **Source**         | Contributors, bleeding-edge, custom builds | You install | Optional (recommended) | Vault / `env()` (recommended) |

All paths run the same `anima service` runtime (Hub REST `/api` + Hub RPC `/hub/rpc/v1` + engine). PostgreSQL with **pgvector** is **required**. Redis powers EventBus and task context; it **degrades silently** when unavailable — Docker and production setups should still run it.

## Shared prerequisites

| Component      | Version / notes                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**        | >= 1.3.14 — required for npm CLI and source installs ([bun.sh](https://bun.sh))                                                       |
| **PostgreSQL** | 17 recommended; extensions: `vector`, FTS helpers — see [`database.md`](database.md)                                                  |
| **Redis**      | 7.x recommended; defaults to `127.0.0.1:6379` when configured                                                                         |
| **Vault**      | Recommended for npm/source — API keys and DB URLs stay out of config files ([`security.md`](security.md#credential-responsibilities)) |

Data directory: `~/.anima/` (override with `FREEANIMA_HOME`). Back it up with your database.

---

## npm CLI

The published package is [`@freeanima/cli`](https://www.npmjs.com/package/@freeanima/cli) on npm. The binary is `anima`; runtime is Bun (not Node).

### 1. Install Bun and the CLI

```bash
# Install Bun (https://bun.sh/docs/installation)
curl -fsSL https://bun.sh/install | bash

# Global CLI from npm registry
bun install -g @freeanima/cli

# Verify
anima --help
```

You can also use `npm install -g @freeanima/cli`, but `anima` still invokes Bun — ensure `bun` is on your `PATH`.

### 2. Configure

```bash
mkdir -p ~/.anima
chmod 700 ~/.anima
cp config.example.yaml ~/.anima/config.yaml   # from repo clone, or write manually
```

Minimum production settings in `~/.anima/config.yaml` (**bootstrap only**):

- **`database.url`** — PostgreSQL connection string (required)

**Runtime settings** (LLM providers, compression, MCP, etc.) are stored in PostgreSQL (`hub_runtime_config`). Edit them in the Shell app under **Settings → Hub 服务 → 服务配置**. Legacy `llm` / `compression` blocks left in `config.yaml` are **ignored** at startup (remove them from YAML after migrating settings in the Shell).

Prefer Vault or `env()` for secrets:

```bash
# Shell /vault (User or Agent library), or env vars for headless Hub
export OPENAI_API_KEY=sk-…
```

Then reference them in config, e.g. `api_key: vault("123", "token")` or `api_key: env("OPENAI_API_KEY")`, and `database.url: env("DATABASE_URL")`. See [`security.md`](security.md#credential-responsibilities).

PostgreSQL setup (Debian helper, extensions, migrations): [`database.md`](database.md).

Optional Redis block in config (defaults shown in `config.example.yaml`):

```yaml
redis:
  host: 127.0.0.1
  port: 6379
```

### 3. Start the service

```bash
anima service start              # background (systemd user unit when available)
anima service start --foreground # debug — logs to stdout
anima service status
```

Default bind: `127.0.0.1:2658`（Hub API：`/api`，Hub RPC：`/hub/rpc/v1`）。

Use **src/app/shell/desktop** or **src/app/shell/mobile** for UI (Chat + Console bundled). Browser local dev: `bun run dev:web` (Vite HMR; Hub must be running).

Schema migrations run automatically on startup when `database.url` is set.

### 4. Upgrade

```bash
anima upgrade
```

Upgrades the global `@freeanima/cli` package from the npm registry, then restart the service if needed (`anima service restart` or `/restart` in chat).

---

## Docker Compose

Recommended for a **quick trial** with PostgreSQL, Redis, and the service in one stack. The image installs `@freeanima/cli` globally and listens on `0.0.0.0:2658` inside the container.

### 1. Prepare environment

From the repository root (or any directory with `docker-compose.yml` and `.env.example`):

```bash
cp .env.example .env
```

Edit `.env`:

| Variable          | Required | Description                                           |
| ----------------- | -------- | ----------------------------------------------------- |
| `PG_PASSWORD`     | yes      | PostgreSQL password for user/db `freeanima`           |
| `OPENAI_API_KEY`  | yes      | LLM API key (injected into config template)           |
| `OPENAI_BASE_URL` | no       | Default `https://api.openai.com/v1`                   |
| `OPENAI_MODEL`    | no       | Default `gpt-4o-mini`                                 |
| `ANIMA_PORT`      | no       | Host port mapped to container `2658` (default `2658`) |

### 2. Start the stack

```bash
docker compose up --build
```

Services:

- **postgres** — `pgvector/pgvector:pg17`, database `freeanima`
- **redis** — `redis:7-alpine`
- **freeanima** — `ghcr.io/freeanima-org/freeanima:latest` (built locally on first `--build`)

On first start, `docker/entrypoint.sh` copies `docker/config.docker.yaml` to `$FREEANIMA_HOME/config.yaml` if missing. Persistent volumes: `pgdata`, `anima_data`.

### 3. Access Hub API

```text
http://127.0.0.1:2658/hub/rpc/v1/health/probe
```

Use `src/app/shell/desktop` or `src/app/shell/mobile` clients for UI (bundled shell with `/chat`, `/tasks`, `/console`, etc.).

- Hub API (health): `http://127.0.0.1:2658/hub/rpc/v1/health/probe` (Hub does **not** host Console UI)
- Local Web shell dev: `bun run dev:web` → Console: `http://127.0.0.1:4173/web/console/dashboard`

(Use `ANIMA_PORT` if you changed the host mapping.)

### 4. Upgrade

On the **host** (not inside the container):

```bash
docker compose pull
docker compose up -d
```

`anima upgrade` and `/upgrade` inside the container only print this guidance.

Images are published to `ghcr.io/freeanima-org/freeanima` on each release tag.

### Docker notes

- Secrets live in `.env` — do not commit `.env` to git. For production, prefer Vault / `env()` on the host instead of plaintext keys in `.env`.
- The container binds `0.0.0.0` — restrict access with firewall or reverse proxy auth before exposing beyond localhost ([`security.md`](security.md)).
- pass is **not** used inside the default Compose stack; LLM and DB secrets come from environment variable expansion in `docker/config.docker.yaml`.

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

Alternatively, use the repo binary directly:

```bash
bun run anima -- --help
# or
bun src/app/cli/cli.ts --help
```

For a publish-shaped local install (closer to npm users):

```bash
bun run install:cli:local
# equivalent: bun run build:cli && bun install -g "$PWD/src/app/cli/publish"
```

`bun install -g ./src/app/cli/publish` from the repo root is not supported; use `bun run install:cli:local` (cleans broken global deps, then pack + install tarball).

### 3. Configure and start

Same as npm CLI — `~/.anima/config.yaml`, PostgreSQL, optional Redis and Vault:

```bash
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml
# configure database + LLM (see database.md, security.md)

anima service start --foreground
```

Frontend hot reload (Vite HMR — Hub must already be running):

```bash
anima service start --foreground   # terminal 1: Hub REST + SAP
bun run dev:web                    # terminal 2: http://127.0.0.1:4173/web/chat · Console /web/console/dashboard
```

### 4. Development checks

```bash
bun run check    # typecheck + lint + format + changed unit tests
bun run test     # full unit + integration (integration uses Docker for temp PG)
```

**link:global** (`bun run link:global`): upgrade manually — `git pull`, `bun install`, then restart the service. `anima upgrade` and `/upgrade` print instructions only.

**Local pack** (`bun run install:cli:local`): `anima upgrade` runs `git pull` and reinstalls the local pack from the repo.

---

## Verify installation

```bash
anima service start
anima token create --subject-id 1 --name bootstrap
# 将输出的 fa_at_... 填入客户端 Hub 设置

anima service status
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/api/status | jq '.version, .memory_kb'
```

If status fails, check PostgreSQL connectivity, that migrations completed ([`database.md`](database.md#troubleshooting)), and that a valid Service API Token is configured.

## Next steps

1. **Security** — Vault / `env()` for secrets, `chmod 700 ~/.anima`, do not expose Console without auth ([`security.md`](security.md))
2. **Remote access** — optional Cloudflare Tunnel + Service API Token for personal mobile/remote Console ([`remote-access.md`](remote-access.md))
3. **Database** — backups, extensions, manual migrations if needed ([`database.md`](database.md))
4. **Operations** — start/stop, memory metrics ([`service.md`](service.md))
5. **Architecture** — memory pipeline, self layer, tools ([`../concepts/architecture.md`](../concepts/architecture.md))
