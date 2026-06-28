# Coding standards

## TypeScript

- Full type annotations on new and touched code
- **Relative imports must include `.ts` / `.tsx` suffix** (oxlint `import/extensions`)

## Tool returns

- **Failures**: always `toolError(msg)` → JSON `{"error":"..."}`
- **Successes**: structured tools use `toolResult(obj)`; LLM-readable tools (`file_read`, `terminal_run`, `code_execute`, etc.) may return plain-text stdout
- Safe paths per existing code (write protection, device blocking, binary filtering)

## ToolSet / tool naming

**Pluralization (layered — do not mix):**

| Layer                              | Singular              | Plural              | Example                                            |
| ---------------------------------- | --------------------- | ------------------- | -------------------------------------------------- |
| ToolSet registry id                | yes                   | no                  | `file`, `memory`, `toolset`, `session`             |
| Tool `function.name` first segment | yes (= ToolSet id)    | no                  | `file_read`, `conversation_search`, `toolset_load` |
| Action segment                     | verb / singular sense | no                  | `_read`, `_search` (not `_reads`)                  |
| Meta fields holding id lists       | no                    | yes                 | `cached_toolsets`, `staged_toolsets`               |
| TS types                           | `ToolSet`             | property `toolSets` | unrelated to id strings                            |

**Multi-segment tool names:** `_` is standard (`mcp_{server}_{local}`, `acp_{agent}_{action}`, `sap_{app}_{instance}_{local}`). `:` only for SAP alias. `-` only in ToolSet ids (e.g. `fridge-magnet`), not in tool names. `/` forbidden.

**Module files:** one ToolSet per register module — `capabilities/**/src/{toolset-id}.ts` matching `registerToolSet("…")` (composite ids: `memory_semantic` → `memory-semantic.ts`). Plural filenames allowed only for multi-id config (`default-conversation-toolsets.ts`).

## Type ownership

When adding or moving types / Zod / ports, decide in this order:

1. **PG storage shape (DDL + JSONB Zod)** → `@freeanima/core/db` (sole SSOT) — [`core/src/db/schema/`](../../core/src/db/schema/)
2. **Repository ports and aggregates** → `@freeanima/core/repos` (`*StorePort`, `PgRepositories`; includes `null*` adapters) — [`core/src/repos/ports/`](../../core/src/repos/ports/)
3. **Domain types** → owner package (`{layer}-{slug}` or `@freeanima/core/*` subpath); hoist to kernel pure-type packages only when shared across domains

Additional rules:

- Domain views may `import type` / `z.infer` from `@freeanima/core/db`, but **must not duplicate** storage Zod definitions
- **HTTP/Admin contracts** → `@freeanima/admin-api/api`; **in-process snapshots/display** → `@freeanima/platform`
- **EventBus payloads** → publisher's domain package (e.g. memory events → `capabilities-memory`)

Do not maintain a domain-to-package inventory in docs — use source and `grep`.

## Security and continuity

- Credentials and secrets never in git / logs / tool return values
- Memory and self-layer changes need extra care — [`docs/concepts/identity.md`](../../docs/concepts/identity.md)
- Continuity over feature pile-up; simple infra in-house, complex logic via mature third-party libs

## 横切审查清单（重构 / 大改后）

| 领域   | 检查项                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 安全   | 凭证路径不入 log / tool 返回；Hub REST 输入校验；memory/self-layer 变更对照 [`identity.md`](../../docs/concepts/identity.md) |
| 性能   | PG 查询热点（`platform/connectors/db-pg`）；EventBus/Redis；流式 merge（`core/src/provider/stream-tools.ts`）                |
| 可测性 | colocated 单测 + `tests/integration/` 覆盖 boot / SAP 路径 gaps                                                              |

**New PG domain**: `core/src/db/schema/{domain}` → add port in `@freeanima/core/repos` → implement in `platform/connectors/db-pg` → extend `PgRepositories` → wire in [`serve.ts`](../../platform/src/serve.ts).

**Flow**: change `core/src/db/schema/` → **`drizzle-kit generate`** → **`migrate`**.

| Step | Command / action                                              | Output                                                               |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Change Drizzle schema (`core/src/db/schema/`)                 | TypeScript SSOT                                                      |
| 2    | `DATABASE_URL=… bun run --filter @freeanima/core db:generate` | `core/migrations/{ts}_{name}/migration.sql` + **`snapshot.json`**    |
| 3    | `DATABASE_URL=… bun run --filter @freeanima/core db:migrate`  | PG applies DDL; production may auto-migrate on `anima service` start |

**Forbidden**:

- **Skip `generate` and hand-write `migration.sql` only** (missing `snapshot.json` breaks Drizzle snapshot chain; next `generate` may recreate tables)
- **Edit SQL / delete snapshot in already-applied migration dirs** (add a new migration to fix)

**Allowed**: after `generate`, **append** SQL Drizzle cannot express in that migration's `migration.sql` (e.g. `CREATE EXTENSION`, `message_fts_input()`, some GIN expression indexes); **do not** use this to replace the whole generate step.

**Data migration (required when DDL drops or renames a populated table)**:

- **Co-locate with schema migration** — backfill / `INSERT … SELECT` / column moves belong in the **same** `core/migrations/{ts}_{name}/migration.sql` as the DDL, appended after `db:generate` output.
- **Order**: copy/transform data **before** `DROP TABLE` / destructive DDL in that file. Hub startup runs `runMigrations` only; it does **not** run standalone scripts under `scripts/`.
- **Forbidden**: a migration that `DROP TABLE` legacy data without an in-file backfill in the same migration; a separate manual script as the **only** migration path (scripts may exist for dry-run / repair, but production path must be the migration SQL).
- One-off repair scripts (`scripts/*.ts`) are for operator recovery or idempotent re-runs after the fact — not a substitute for the migration chain.

Table shapes SSOT: [`core/src/db/schema/`](../../core/src/db/schema/). User ops (install, backup): [`docs/guide/database.md`](../../docs/guide/database.md).

Repository query conventions (ORM vs `db.execute`, DbRow typing): [`drizzle-db.md`](drizzle-db.md).

## LLM profile 回退

- 内置场景 id：`chat` / `summary` / `reflect`（`PROFILE_*` 常量）
- 请求场景 profile 时，若 `config.yaml` 的 `llm.profiles` **未配置**该 id，**必须回退**到 `llm.default_profile`
- 回退 SSOT：`ProfileRegistry.resolve()`（运行时）、`resolveConfiguredProfileId()` / `getProfileHopModel()`（读配置）；调用方仍传场景常量，勿在各功能点手写 fallback

## Release

- **Do not manually edit [`CHANGELOG.md`](../../CHANGELOG.md)** — Release Please only
- Commit conventions and release flow: [`release.md`](release.md)
