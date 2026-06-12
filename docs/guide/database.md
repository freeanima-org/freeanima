---
title: Database
---

# Database Design

> PostgreSQL storage layer. **Slice A** (conversation archive), **Slice B** (`semantic_memory` + `limbic_memory`), **Slice C** (self layer + autobiographical) are live; standalone `procedural` table not yet created (procedural memory currently uses `semantic_memory.type=procedural`).
> Related: [`compression.md`](../concepts/compression.md), [`memory.md`](../concepts/memory.md), [`sleep.md`](../concepts/sleep.md).

## Status

| Phase       | Scope                                                                               | Status                                                   |
| ----------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Slice A** | `sessions` + `messages` (conversation primary PG store)                             | **✅ Complete**                                          |
| **Slice B** | `semantic_memory`, `limbic_memory`                                                  | **✅ Complete** (standalone procedural table: Issue #41) |
| **Slice C** | `self_blocks` + `autobiographical_memory` (self layer + autobiographical narrative) | **✅ Complete**                                          |

Code source of truth: [`storage/db/src/schema/`](../../storage/db/src/schema/).

## PG Multi-Domain Architecture (Path C)

| Package                                 | Responsibility                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@freeanima/storage-db`                 | PG table DDL, migrations, JSONB storage Zod and Slice A **domain types** (`schema/` + `domain/`) |
| `@freeanima/storage-repos`              | `SessionStorePort`, `PgRepositories` and other **ports**; `null*` adapters                       |
| `@freeanima/orchestration-conversation` | Session runtime; re-exports `storage-db/domain` convenience types                                |
| `@freeanima/connectors-db-pg`           | `PgSessionStore` implementation, connection pool, mapper, repos                                  |

Wiring: [`service/service/src/serve.ts`](../../service/service/src/serve.ts) calls `createPgRepositories` → `createEngine({ repos })` → `createConversationService(engine.repos)` → `initServiceContext`. Runtime conversation archive reads/writes via `getServiceContext().conversation` or explicit `ConversationService` / `SessionStorePort`, not direct connector dependency.

New PG domain (memory / cron / task): `storage-db/schema/{domain}` → add port in `storage-repos` → implement in `connectors-db-pg` → extend `PgRepositories` fields → wire in `serve.ts`.

---

## Slice A: Session (2 Tables)

### Design Principles

- `sessions` **one row = `session_meta`** (compression, todos, clarify, tools, etc.)
- `messages` **append-only**; `payload` JSONB stores `MessagePayload` (no `pos`); `pos` column is per-session sequence source of truth
- **Storage Zod authoritative in `storage-db/schema`**; domain convenience types in `storage-db/domain` (`orchestration-conversation` re-exports)
- Drizzle manages DDL + migration; `sessions` still columnizes common meta fields
- Read/write: `connectors-db-pg` mapper (`pos` column + payload merged into `ConversationMessage`)

### Table Structure

#### `sessions`

| Column             | Type          | Description                                                                                               |
| ------------------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| `id`               | TEXT PK       | Session name                                                                                              |
| `model`            | TEXT NOT NULL |                                                                                                           |
| `title`            | TEXT          |                                                                                                           |
| `cwd`              | TEXT          |                                                                                                           |
| `system_prompt`    | TEXT          |                                                                                                           |
| `platform_info`    | JSONB         | `discriminatedUnion("platform")`: parlor / discord / weixin / studio-pair-programming / cron              |
| `compression`      | JSONB         | `{ l2, l3, summary?, summary_at? }` — **compression boundaries** (see [`compression.md`](compression.md)) |
| `todos`            | JSONB         | `{ items, next_id }`                                                                                      |
| `awaiting_clarify` | JSONB         | clarify pause state                                                                                       |
| `acp_tasks`        | JSONB         | ACP async task state per session (keyed by ACP session id)                                                |
| `tools`            | JSONB         | OpenAI tools snapshot                                                                                     |
| `functions`        | JSONB         | string[]                                                                                                  |
| `debug`            | BOOLEAN       |                                                                                                           |
| `created_at`       | TIMESTAMPTZ   |                                                                                                           |
| `updated_at`       | TIMESTAMPTZ   |                                                                                                           |

#### `messages`

| Column              | Type                  | Description                                                                                  |
| ------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `id`                | TEXT PK               | Globally unique row id (UUID)                                                                |
| `session_id`        | TEXT FK → sessions.id |                                                                                              |
| `pos`               | BIGINT                | Monotonic per-session sequence (compression l2/l3 point here; domain `Message.pos`)          |
| `payload`           | JSONB                 | `ConversationPayload` (role/content/tool_calls etc., **no pos**)                             |
| `fts_segmented`     | TEXT (nullable)       | jieba segmented string; written when `cjk.enabled`; `content_fts` prefers non-empty value    |
| `content_fts`       | TSVECTOR (generated)  | STORED; indexes segmented string when `fts_segmented` set, else `message_fts_input(content)` |
| `content_embedding` | VECTOR(1024)          | Conversation content embedding; async write when `embedding` configured                      |

Unique index: `(session_id, pos)`.

Full-text indexes: `messages_content_fts_gin` (GIN on `content_fts`), `idx_messages_content_trgm` (GIN trgm on `payload->>'content'`), `idx_messages_embedding_hnsw` (HNSW cosine). For `recall` historical conversation retrieval; filter excludes tool messages and empty content. Retrieval: **FTS + pg_trgm + pgvector three-way RRF** (always on; vector path requires `embedding` config and non-null column).

### Configuration

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # or pass:services/postgres/anima
```

Production must configure `database.url`.

**Driver:** `Bun.sql` + `drizzle-orm/bun-sql/postgres` (`connectors/db-pg`).

**Upstream patch:** rc.3 bun-sql driver default `tagged=true` causes incomplete SQL from RQB `.select()` ([drizzle#5802](https://github.com/drizzle-team/drizzle-orm/issues/5802)); repo uses Bun `patchedDependencies` with [`patches/drizzle-orm@1.0.0-rc.3.patch`](../../patches/drizzle-orm@1.0.0-rc.3.patch) (equivalent to [PR#5824](https://github.com/drizzle-team/drizzle-orm/pull/5824): `tagged=false`). After patch, CRUD read path uses Drizzle RQB; FTS / complex retrieval still uses `execute`. Patch removable when upstream merges and releases. Regression: `tests/integration/db/db-session.test.ts`.

### Migrations

- **✅ Production:** On `anima service` startup with PG as primary store, [`serve.ts`](../../service/service/src/serve.ts) auto-calls `runMigrations()`.
- **Manual:** `bun run --filter @freeanima/storage-db db:migrate` — applies Drizzle migrations (including columnized → payload JSONB backfill).
- **Extensions (one-time, requires superuser):** `pg_trgm` / `vector` cannot be `CREATE EXTENSION` by app user. On local Debian, [`setup-postgres-debian.sh`](../../scripts/setup-postgres-debian.sh) installs automatically; for existing DB:

```bash
sudo apt install postgresql-17-pgvector   # version matches psql --version
sudo -u postgres psql -d anima -f storage/db/scripts/ensure-pg-extensions.sql
```

Then `db:migrate` or restart `anima service`.

### Operations

- Schema changes: `drizzle-kit generate` + `migrate` (do not modify applied migrations)
- **Migrations do not replace backups**; continue daily full backups; `pg_dump` before destructive changes

#### Local PostgreSQL (Debian)

```bash
# Install + create anima db/user + production-oriented conf.d snippet (requires sudo)
sudo ./scripts/setup-postgres-debian.sh

# Write credentials to pass (script prints anima credential add … command)
anima credential add services/postgres/anima url=… host=… password=… database=anima

# Schema
DATABASE_URL="$(anima credential get services/postgres/anima url)" \
  bun run --filter @freeanima/storage-db db:migrate

# database:
#   url: pass:services/postgres/anima
```

Defaults: **PostgreSQL 17**, `localhost` listen only, `scram-sha-256` local TCP, dedicated `anima` db/user.

#### Integration Tests (Local, Not pre-commit)

Requires **Docker** running. `bun run test:integration` or `bun run test` (full parallel) starts temporary PostgreSQL 17 via Docker CLI, runs migrations, executes `tests/integration/`. pre-commit `test:changed` **does not** run integration tests.

```bash
bun run test:integration
bun run test              # unit + integration + E2E parallel
```

Unit tests (mapper, no PG): `bun run test:unit` or `bun test connectors/db-pg/src`

## Slice B: semantic_memory (Live)

### Table Structure

| Column              | Type                 | Description                                                                                                                  |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                | TEXT PK              | Retains `f-{seq}-{hex}` format                                                                                               |
| `type`              | TEXT                 | `world/experience/opinion/observation/preference/procedural/imprint`                                                         |
| `pinned`            | BOOLEAN              | Priority inject into resident memory                                                                                         |
| `content`           | TEXT                 | Memory body                                                                                                                  |
| `fts_segmented`     | TEXT (nullable)      | jieba segmented string; written when `cjk.enabled`                                                                           |
| `content_fts`       | TSVECTOR (generated) | Indexes segmented string when set, else `message_fts_input(content)` STORED                                                  |
| `content_embedding` | VECTOR(1024)         | bge-m3 etc. embedding; async when `config.embedding` set; WebUI rebuild can backfill                                         |
| `source_sessions`   | TEXT[]               | Source session ID list, default `'{}'`                                                                                       |
| `observed_at`       | TIMESTAMPTZ          | First observation time; legacy rows backfilled from `created`                                                                |
| `occurred_at`       | TEXT                 | Fuzzy occurrence time in fact content                                                                                        |
| `status`            | TEXT                 | `active` / `deprecated`, default `active`                                                                                    |
| `reference_count`   | REAL                 | Reference weight sum after per-session dedup + 30-day time decay; `builtin-memory-reference-sync` recalculates from messages |
| `created`           | TIMESTAMPTZ          |                                                                                                                              |
| `updated`           | TIMESTAMPTZ          |                                                                                                                              |

### `memory_references` (Semantic Memory References)

`[记忆 #f-000001-abcd]` markers in message body persisted; invalidated on session / message delete cascade.

| Column               | Type        | Description                                |
| -------------------- | ----------- | ------------------------------------------ |
| `id`                 | UUID PK     |                                            |
| `message_id`         | TEXT FK     | → `messages.id` ON DELETE CASCADE          |
| `semantic_memory_id` | TEXT FK     | → `semantic_memory.id` ON DELETE CASCADE   |
| `session_id`         | TEXT FK     | → `sessions.id` ON DELETE CASCADE          |
| `created_at`         | TIMESTAMPTZ | Reference time (usually message timestamp) |

Unique index: `(message_id, semantic_memory_id)`. Same memory cited multiple times in one session counts once for weight; references within 30 days weight ×2.

Port: `MemoryReferenceStorePort` (`storage-repos`) → `PgMemoryReferenceStore` (`connectors-db-pg`); incremental on `appendMessage`; cron `builtin-memory-reference-sync` full rebuild and calibrates `reference_count`.

Indexes: `idx_semantic_memory_fts` (GIN), `idx_semantic_memory_content_trgm` (GIN trgm), `idx_semantic_memory_embedding_hnsw` (HNSW cosine), `idx_semantic_memory_type`, `idx_semantic_memory_pinned`, `idx_semantic_memory_source_sessions` (GIN), `idx_semantic_memory_status`. Retrieval: **FTS + pg_trgm + pgvector three-way RRF** (always on; vector path requires `embedding` config and non-null column).

Port methods: `create` / `update` (overwrite, omitted fields unchanged; `source_sessions: []` clears) / `deprecate` / `listBySourceSessions` / `search` / `searchFts`; `listResident` = **all pinned** + **reference_count top N** (default N=20, `status=active` only).

Port: `SemanticMemoryStorePort` (`storage-repos`) → `PgSemanticMemoryStore` (`connectors-db-pg`) → `registerSemanticMemoryStore` (`capabilities-memory`).

`limbic_memory` in following §Slice C section of this file; standalone `procedural` table: [Issue #41](https://github.com/freeanima-org/freeanima/issues/41).

## Slice C: Self Layer and Autobiographical (Live)

### `self_blocks` (Self Layer Six Blocks)

| Column       | Type        | Description                                                                                                          |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `block_key`  | TEXT PK     | `existence_anchor` / `self_model` / `personality_baseline` / `direction` / `metacognition` / `autobiography_summary` |
| `content`    | TEXT        | Markdown body                                                                                                        |
| `locked`     | BOOLEAN     | `existence_anchor` default true; update requires `force`                                                             |
| `version`    | INTEGER     | Change counter                                                                                                       |
| `updated_by` | TEXT        | `seed` / `manual` / `tool` / `autobiography_cron` etc.                                                               |
| `created_at` | TIMESTAMPTZ |                                                                                                                      |
| `updated_at` | TIMESTAMPTZ |                                                                                                                      |

Port: `SelfLayerStorePort` (`storage-repos`) → `PgSelfLayerStore` (`connectors-db-pg`) → `registerSelfLayerStore` (`capabilities-identity`).

Methods: `getBlock` / `listBlocks` / `upsertBlock` / `updateBlock` (`locked` blocks need `force`).

Runtime read via `loadSelfLayerPrompt()`; maintenance via `get_self_blocks` / `update_self_block` or direct table writes.

### `autobiographical_memory` (Autobiographical Narrative, Memory Layer)

| Column            | Type        | Description                                                                    |
| ----------------- | ----------- | ------------------------------------------------------------------------------ |
| `id`              | TEXT PK     | UUID                                                                           |
| `title`           | TEXT        | Narrative title                                                                |
| `content`         | TEXT        | Narrative body (append-only, no update)                                        |
| `significance`    | TEXT        | `normal` / `milestone` / `turning_point`                                       |
| `period_start`    | TEXT        | Fuzzy period start                                                             |
| `period_end`      | TEXT        | Fuzzy period end                                                               |
| `source_facts`    | TEXT[]      | Related `semantic_memory.id` (PG column name; domain `source_semantic_memory`) |
| `source_sessions` | TEXT[]      | Related session ids                                                            |
| `status`          | TEXT        | `active` / `deprecated`                                                        |
| `created_at`      | TIMESTAMPTZ |                                                                                |
| `updated_at`      | TIMESTAMPTZ | Updated on deprecate                                                           |

Indexes: `status`, `significance`, `updated_at`, `source_facts` (GIN), `source_sessions` (GIN).

Port: `AutobiographicalMemoryStorePort` → `PgAutobiographicalMemoryStore` → `registerAutobiographicalMemoryStore` (`capabilities-memory`).

Methods: `create` / `get` / `deprecate` / `count` / `listActive` / `listCreatedSince` / `listBySourceSemanticMemory` / `listBySourceSessions` (**no** content `update`).

Maintenance: `builtin-self-autobiography` cron (04:00 CST) processes narrative from `experience`/`imprint` semantic memories; `autobiography_summary` block compressed/refreshed from this table in same job.

Migration: [`storage/db/migrations/20260607150000_self_and_autobiographical/migration.sql`](../../storage/db/migrations/20260607150000_self_and_autobiographical/migration.sql).

### `limbic_memory` (Limbic Emotional Memory)

| Column                | Type        | Description                                |
| --------------------- | ----------- | ------------------------------------------ |
| `id`                  | UUID PK     |                                            |
| `session_id`          | TEXT        | Related session                            |
| `kind`                | TEXT        | `session_mood` / `turning_point` / `spike` |
| `valence`             | REAL        | Valence -1.0 to 1.0                        |
| `arousal`             | REAL        | Arousal 0.0 to 1.0                         |
| `content`             | TEXT        | First-person emotional description         |
| `intensity`           | REAL        | Intensity 0.0 to 1.0, default 0.5          |
| `source_segment`      | TEXT        | early / mid / late or specific position    |
| `semantic_memory_ids` | TEXT[]      | Related `semantic_memory.id`               |
| `created_at`          | TIMESTAMPTZ |                                            |

Indexes: `semantic_memory_ids` (GIN), `session_id`, `created_at`, `kind`, `intensity`, `valence`, `arousal`.

Port: `LimbicMemoryStorePort` → `PgLimbicMemoryStore` → `registerLimbicMemoryStore` (`capabilities-memory`).

Methods: `create` / `get` / `listBySession`. **Not injected** into system prompt; light sleep Phase 2 writes via `create_limbic_memory`.

Migration: [`storage/db/migrations/20260607160000_limbic_memory/migration.sql`](../../storage/db/migrations/20260607160000_limbic_memory/migration.sql).

## cron_jobs (Live)

Scheduled task metadata in PG; output body still in `~/.anima/cron/output/` (`last_output_ref` stores path relative to `FREEANIMA_HOME`).

### Table Structure

| Column            | Type        | Description                                       |
| ----------------- | ----------- | ------------------------------------------------- |
| `id`              | TEXT PK     | 16 hex or `builtin-*`                             |
| `name`            | TEXT        | Task name                                         |
| `schedule`        | TEXT        | CST semantic schedule (cron / interval / oneshot) |
| `prompt`          | TEXT        | LLM prompt                                        |
| `skills`          | TEXT[]      | Skill list                                        |
| `script`          | TEXT        | Script path (relative to `cron/scripts`)          |
| `no_agent`        | BOOLEAN     | Script/builtin only, no LLM                       |
| `model_provider`  | TEXT        | Model provider                                    |
| `model_name`      | TEXT        | Model name                                        |
| `workdir`         | TEXT        | Working directory                                 |
| `context_from`    | TEXT[]      | Upstream task IDs                                 |
| `deliver`         | TEXT        | Delivery target                                   |
| `timeout_sec`     | INTEGER     | Timeout seconds                                   |
| `builtin`         | BOOLEAN     | Built-in task                                     |
| `repeat`          | INTEGER     | Max run count                                     |
| `run_count`       | INTEGER     | Runs completed                                    |
| `paused`          | BOOLEAN     | Paused state                                      |
| `created_at`      | TIMESTAMPTZ |                                                   |
| `updated_at`      | TIMESTAMPTZ |                                                   |
| `last_run_at`     | TIMESTAMPTZ | Last run time                                     |
| `last_output_ref` | TEXT        | Output file path relative to `FREEANIMA_HOME`     |

Index: `idx_cron_jobs_paused`.

Scheduling: `Bun.cron` in-process; 5-field cron validation and `next_run_at` via `Bun.cron.parse` (CST→UTC before register). `next_run_at` not stored; computed at API layer.

Port: `CronJobStorePort` (`storage-repos`) → `PgCronJobStore` (`connectors-db-pg`) → `initCronModule` (`connectors-cron` / `serve.ts`).

Migration: [`storage/db/migrations/20260607140000_cron_jobs/migration.sql`](../../storage/db/migrations/20260607140000_cron_jobs/migration.sql) (hand-written SQL, no Drizzle schema file).

## cron_log (Live)

One row appended per cron run end (success and failure); WebUI `/chamber/sleep` and `GET /api/cron-logs` query this table. `cron/output/*.txt` retained as debug copies.

| Column        | Type        | Description                                                                |
| ------------- | ----------- | -------------------------------------------------------------------------- |
| `id`          | BIGINT PK   | Auto-increment                                                             |
| `job_id`      | TEXT FK     | → `cron_jobs.id` ON DELETE CASCADE                                         |
| `run_count`   | INTEGER     | Matches run's `cron_jobs.run_count`                                        |
| `ok`          | BOOLEAN     | Success                                                                    |
| `finished_at` | TIMESTAMPTZ | End time                                                                   |
| `output`      | JSONB       | Written when success and parseable as JSON (e.g. light/deep sleep results) |
| `output_text` | TEXT        | Truncated raw text for non-JSON success                                    |
| `error`       | TEXT        | Failure error summary (truncated ~2KB)                                     |

Unique constraint: `(job_id, run_count)`. Index: `idx_cron_log_job_finished (job_id, finished_at DESC)`.

Port: `CronLogStorePort` (`storage-repos`) → `PgCronLogStore` (`connectors-db-pg`); write site `connectors/cron/src/runner.ts` (`appendCronRunLog`).

Schema: `storage/db/src/schema/cron-log.ts`. Migration: [`storage/db/migrations/20260612120000_cron_log/migration.sql`](../../storage/db/migrations/20260612120000_cron_log/migration.sql).

## tasks (Live)

Cross-session persistent todos; `status` / `priority` TEXT + Zod enum (`storage-db/schema/tasks.ts`).

| Column              | Type        | Description                                          |
| ------------------- | ----------- | ---------------------------------------------------- |
| `id`                | TEXT PK     | UUID                                                 |
| `title`             | TEXT        | Title                                                |
| `description`       | TEXT        | Details (optional)                                   |
| `status`            | TEXT        | pending / in_progress / completed / cancelled        |
| `priority`          | TEXT        | high / medium / low / none                           |
| `due_at`            | TIMESTAMPTZ | Due time (optional)                                  |
| `created_at`        | TIMESTAMPTZ |                                                      |
| `updated_at`        | TIMESTAMPTZ |                                                      |
| `completed_at`      | TIMESTAMPTZ | Completion/cancel time (optional)                    |
| `source_session_id` | TEXT FK     | Creating session (`sessions.id`, ON DELETE SET NULL) |

Indexes: `idx_tasks_status`, `idx_tasks_list` (status, priority, created_at).

Port: `TaskStorePort` (`storage-repos`) → `PgTaskStore` (`connectors-db-pg`) → `capabilities/tasks` tools.

Migration: [`storage/db/migrations/20260608120000_tasks/migration.sql`](../../storage/db/migrations/20260608120000_tasks/migration.sql).
