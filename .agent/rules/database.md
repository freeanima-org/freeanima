# Database and PG migrations

## New PG domain

`storage-db/schema/{domain}` → add port in `storage-repos` → implement in `connectors-db-pg` → extend `PgRepositories` → wire in [`serve.ts`](../../service/service/src/serve.ts).

Design detail: [`docs/guide/database.md`](../../docs/guide/database.md).

## PG schema migrations (mandatory)

**Flow**: change `storage/db/src/schema/` → **`drizzle-kit generate`** → **`migrate`**.

| Step | Command / action                                                    | Output                                                               |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Change Drizzle schema (`storage/db/src/schema/`)                    | TypeScript SSOT                                                      |
| 2    | `DATABASE_URL=… bun run --filter @freeanima/storage-db db:generate` | `migrations/{ts}_{name}/migration.sql` + **`snapshot.json`**         |
| 3    | `DATABASE_URL=… bun run --filter @freeanima/storage-db db:migrate`  | PG applies DDL; production may auto-migrate on `anima service` start |

**Forbidden**:

- **Skip `generate` and hand-write `migration.sql` only** (missing `snapshot.json` breaks Drizzle snapshot chain; next `generate` may recreate tables)
- **Edit SQL / delete snapshot in already-applied migration dirs** (add a new migration to fix)

**Allowed**: after `generate`, **append** SQL Drizzle cannot express in that migration's `migration.sql` (e.g. `CREATE EXTENSION`, `message_fts_input()`, some GIN expression indexes); **do not** use this to replace the whole generate step.

Type placement: [`coding.md`](coding.md).
