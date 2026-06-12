# Coding standards

## TypeScript

- Full type annotations on new and touched code
- **Relative imports must include `.ts` / `.tsx` suffix** (oxlint `import/extensions`)

## Tool returns

- **Failures**: always `toolError(msg)` → JSON `{"error":"..."}`
- **Successes**: structured tools use `toolResult(obj)`; LLM-readable tools (`file_read_file`, `terminal_run`, `code_execute`, etc.) may return plain-text stdout
- Safe paths per existing code (write protection, device blocking, binary filtering)

## Type ownership

When adding or moving types / Zod / ports, decide in this order:

1. **PG storage shape (DDL + JSONB Zod)** → `@freeanima/core/db` (sole SSOT) — [`core/src/db/schema/`](../../core/src/db/schema/)
2. **Repository ports and aggregates** → `@freeanima/core/repos` (`*StorePort`, `PgRepositories`; includes `null*` adapters) — [`core/src/repos/ports/`](../../core/src/repos/ports/)
3. **Domain types** → owner package (`{layer}-{slug}` or `@freeanima/core/*` subpath); hoist to kernel pure-type packages only when shared across domains

Additional rules:

- Domain views may `import type` / `z.infer` from `@freeanima/core/db`, but **must not duplicate** storage Zod definitions
- **HTTP/WebUI contracts** → `@freeanima/platform/connectors/webui/api`; **in-process snapshots/display** → `@freeanima/platform`
- **EventBus payloads** → publisher's domain package (e.g. memory events → `capabilities-memory`)

Do not maintain a domain-to-package inventory in docs — use source and `grep`.

## Security and continuity

- Credentials and secrets never in git / logs / tool return values
- Memory and self-layer changes need extra care — [`docs/concepts/identity.md`](../../docs/concepts/identity.md)
- Continuity over feature pile-up; simple infra in-house, complex logic via mature third-party libs

## PG migrations

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

Table shapes SSOT: [`core/src/db/schema/`](../../core/src/db/schema/). User ops (install, backup): [`docs/guide/database.md`](../../docs/guide/database.md).

Repository query conventions (ORM vs `db.execute`, DbRow typing): [`drizzle-db.md`](drizzle-db.md).

## Release

- **Do not manually edit [`CHANGELOG.md`](../../CHANGELOG.md)** — Release Please only
- Commit conventions and release flow: [`release.md`](release.md)
