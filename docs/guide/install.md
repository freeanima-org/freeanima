---
title: Installation
---

# Installation

> Deploy FreeAnima on your machine — npm CLI, Docker Compose, or from source.
> After install: [`security.md`](security.md) (credentials, bind address) · [`database.md`](database.md) (PostgreSQL) · [`service.md`](service.md) (runtime commands).

## Choose a path

| Path               | Best for                                   | PostgreSQL  | Redis                  | Credentials                                          |
| ------------------ | ------------------------------------------ | ----------- | ---------------------- | ---------------------------------------------------- |
| **npm CLI**        | Day-to-day self-hosting on your OS         | You install | Optional (recommended) | [pass](https://www.passwordstore.org/) (recommended) |
| **Docker Compose** | Quick trial, minimal host setup            | Bundled     | Bundled                | `.env` env vars                                      |
| **Source**         | Contributors, bleeding-edge, custom builds | You install | Optional (recommended) | pass (recommended)                                   |

All paths run the same `anima service` runtime (WebUI + tRPC + Gateway + engine). PostgreSQL with **pgvector** is **required**. Redis powers fridge/tasks cross-session context and **degrades silently** when unavailable — Docker and production setups should still run it.

## Shared prerequisites

| Component      | Version / notes                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**        | >= 1.3.14 — required for npm CLI and source installs ([bun.sh](https://bun.sh))                                                                    |
| **PostgreSQL** | 17 recommended; extensions: `vector`, FTS helpers — see [`database.md`](database.md)                                                               |
| **Redis**      | 7.x recommended; defaults to `127.0.0.1:6379` when configured                                                                                      |
| **pass**       | Optional but recommended for npm/source — API keys and DB URLs stay out of config files ([`security.md`](security.md#credential-responsibilities)) |

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

Minimum production settings in `~/.anima/config.yaml`:

- **`database.url`** — PostgreSQL connection string (required)
- **`llm.providers.*`** — at least one OpenAI-compatible provider and profile chain

Prefer pass for secrets:

```bash
anima credential add api/openai token=sk-…
anima credential add services/postgres/anima url=postgresql://… host=… password=… database=anima
```

Then reference them in config, e.g. `api_key: credential("api/openai", "token")` and `database.url: pass:services/postgres/anima`. See [`security.md`](security.md#credential-responsibilities).

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

Default bind: `127.0.0.1:2658`. Open parlor chat:

**http://127.0.0.1:2658/webui/parlor/chat**

Schema migrations run automatically on startup when `database.url` is set.

### 4. Upgrade

```bash
anima update
```

Updates the global `@freeanima/cli` package from npm. Disabled for local link installs — use git pull or rebuild instead.

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

### 3. Access WebUI

```text
http://127.0.0.1:2658/webui/parlor/chat
```

(Use `ANIMA_PORT` if you changed the host mapping.)

### 4. Pull a release image (no local build)

```bash
docker compose pull
docker compose up -d
```

Images are published to `ghcr.io/freeanima-org/freeanima` on each release tag.

### Docker notes

- Secrets live in `.env` — do not commit `.env` to git. For production, prefer a secret manager or pass on the host and mount config instead of plaintext keys in `.env`.
- The container binds `0.0.0.0` — restrict access with firewall or reverse proxy auth before exposing beyond localhost ([`security.md`](security.md)).
- pass is **not** used inside the default Compose stack; LLM and DB credentials come from environment variable expansion in `docker/config.docker.yaml`.

---

## Source (repository)

For development, unreleased fixes, or running from a git checkout.

### 1. Clone and install dependencies

**Prerequisites:** Bun >= 1.3.14 · PostgreSQL (pgvector) · Redis (recommended) · pass (recommended)

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
./cli/src/cli.ts --help
```

For a publish-shaped local install (closer to npm users):

```bash
bun run build:cli
bun install -g ./cli/publish
```

### 3. Configure and start

Same as npm CLI — `~/.anima/config.yaml`, PostgreSQL, optional Redis and pass:

```bash
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml
# configure database + LLM (see database.md, security.md)

anima service start --foreground
```

WebUI dev mode (source watch rebuild — refresh the page after frontend edits):

```bash
anima service start --dev --foreground
```

### 4. Development checks

```bash
bun run check    # typecheck + lint + dep-check + format + changed unit tests
bun run test     # full unit + integration (integration uses Docker for temp PG)
```

Upgrade a link install: `git pull`, `bun install`, restart the service. Do not use `anima update`.

---

## Verify installation

```bash
anima service status
curl -s http://127.0.0.1:2658/api/status | jq '.version, .memory_kb'
```

If status fails, check PostgreSQL connectivity and that migrations completed ([`database.md`](database.md#troubleshooting)).

## Next steps

1. **Security** — pass-only secrets, `chmod 700 ~/.anima`, do not expose WebUI without auth ([`security.md`](security.md))
2. **Database** — backups, extensions, manual migrations if needed ([`database.md`](database.md))
3. **Operations** — start/stop, memory metrics ([`service.md`](service.md))
4. **Architecture** — memory pipeline, self layer, tools ([`../concepts/architecture.md`](../concepts/architecture.md))
