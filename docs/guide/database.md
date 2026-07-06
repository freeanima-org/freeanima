---
title: Database
---

# PostgreSQL Setup and Operations

> FreeAnima uses PostgreSQL for conversation archives, semantic memory, self layer, and related data.
> Related concepts: [`memory.md`](../concepts/memory.md), [`sleep.md`](../concepts/sleep.md).
> Security and credentials: [`security.md`](security.md).

## Connection Configuration

Set the database URL in `config.yaml`:

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # or use env() / vault():
  # url: env("DATABASE_URL")
```

Production **must** set `database.url`. Prefer Vault or `env()` for passwords instead of plaintext in config. Path conventions: [`security.md`](security.md#credential-responsibilities).

## Local Install (Debian)

```bash
# Install PostgreSQL, create anima db/user (requires sudo)
sudo ./scripts/setup-postgres-debian.sh

# config.yaml (example):
#   url: env("DATABASE_URL")
```

Defaults: PostgreSQL 17, `localhost` only, `scram-sha-256`, dedicated `anima` database and user.

## Extensions (One-Time)

Full-text and vector search require PostgreSQL extensions. The app user usually cannot `CREATE EXTENSION`; run as superuser:

```bash
sudo apt install postgresql-17-pgvector   # match psql --version
sudo -u postgres psql -d anima -f core/scripts/ensure-pg-extensions.sql
```

Fresh Debian installs via `setup-postgres-debian.sh` handle extensions automatically.

## Schema Migrations

- **Production (recommended):** When PostgreSQL is configured, `anima service` **auto-applies** pending schema migrations on startup.
- **Manual:**

```bash
DATABASE_URL="postgresql://anima:…@127.0.0.1:5432/anima" \
  bun run db:migrate
```

Run after extensions are installed, or restart `anima service`.

## `auto_llm_runs` (audit)

Background LLM without user turns (cron agent, sleep pipeline stages) writes to `auto_llm_runs` instead of creating `conversations`. Retention (optional `config.yaml`):

```yaml
auto_llm:
  retention_days: 30
  per_run_kind_keep: 100
```

Purged during sleep-cycle step `conversation-cleanup` (after stale conversation cleanup). Cron script runs (`no_agent`) use `cron_log` only.

## Backups

- **Migrations do not replace backups** — schedule regular full backups (e.g. `pg_dump`).
- Back up before destructive changes.
- Include `~/.anima/` (`FREEANIMA_HOME` overridable) in backup policy — see [`security.md`](security.md#data-persistence).

## Integration Tests (Developers)

Full integration tests require **Docker** for a temporary PostgreSQL instance:

```bash
bun run test:integration
bun run test              # unit + integration（串行）
```

pre-commit `test:changed` does **not** run integration tests.

## Troubleshooting

| Symptom                     | Check                                                          |
| --------------------------- | -------------------------------------------------------------- |
| Service fails on DB connect | `database.url`; PostgreSQL running; pass credentials readable  |
| Migration fails             | Extensions installed; DB user has DDL privileges               |
| FTS / vector recall empty   | `ensure-pg-extensions.sql` applied; `embedding` config enabled |

More deployment security: [`security.md`](security.md).
