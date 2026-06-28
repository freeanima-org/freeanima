# Drizzle / PostgreSQL query conventions

Repository query patterns for `@freeanima/core/db/pg`. Schema DDL and migrations → [`coding.md`](coding.md) § PG migrations.

**Conflict priority**: implementation in `core/src/db/pg/` > this file.

---

## Scope

| In scope                                         | Out of scope                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `core/src/db/pg/` repository / FTS query code    | Migration DDL (`db:generate`, `snapshot.json`) — see [`coding.md`](coding.md)               |
| ORM query patterns, type safety, dynamic filters | Product memory pipeline — see [`docs/concepts/memory.md`](../../docs/concepts/memory.md)    |
| Repo transform (non-trivial joins)               | User PG install, backup, ops — see [`docs/guide/database.md`](../../docs/guide/database.md) |

Driver: `drizzle-orm/bun-sql/postgres` via [`core/src/db/pg/client.ts`](../../core/src/db/pg/client.ts).

PG repository 实现位于 `core/src/db/pg/`（按域分子目录）；schema / row 类型 SSOT 在 `@freeanima/core/db`。`capabilities/*` 可直接 import `@freeanima/core/db/pg/*` 与 `@freeanima/core/db/schema`（见 [`code-layers.md`](code-layers.md)）。`@freeanima/core/repos` 仅保留共享类型与 marker 常量，不再暴露 `PgRepositories` / StorePort。

---

## Decision tree: ORM only

All queries in `core/src/db/pg/` and `tests/integration/` use Drizzle ORM — **`db.execute` is forbidden** (enforced by [`scripts/check-no-db-execute.ts`](../../scripts/check-no-db-execute.ts)).

| Tier                         | When                                                                              | How                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1 — default ORM**          | Single-table CRUD, list, count, `eq` / `inArray` filters                          | `db.select()` / `.insert()` / `.update()` / `.delete()` on schema table                  |
| **2 — ORM + `sql` fragment** | PG functions (`to_tsquery`, `ts_rank_cd`, `pg_trgm`, `pgvector`), CTEs, subselect | Column refs and PG operators in `sql\`…\``inside`.where()`/`.select()`/`.from(sql\`…\`)` |

PG-specific operators (`@@`, `<=>`, `word_similarity`, `array &&`, etc.) belong in **`sql` fragments within ORM builders**, not in standalone `db.execute` calls.

For complex multi-branch SQL (e.g. hybrid count with `UNION`), prefer Drizzle `union()` or `.from(sql\`(subquery) AS alias\`)`.

Do **not** use `drizzleSql.raw` with user-controlled input.

---

## Type safety

### DbRow / Port row SSOT

Derive row types from Drizzle schema — do not hand-write column structs or duplicate Zod row schemas:

```typescript
export type SelfBlockRow = typeof selfBlocks.$inferSelect;
// or re-export from core/src/db/schema/rows/
```

Thin exports live in [`core/src/db/schema/rows/`](../../core/src/db/schema/rows/). Ports re-export these types; **no per-table mapper** for 1:1 CRUD.

Patch objects: `Partial<typeof {table}.$inferInsert>`.

### Time columns

Use [`pgTimestamptz`](../../core/src/db/schema/columns/pg-timestamptz.ts) in schema — application code reads/writes **`Date`**. JSON API boundary: Elysia serializes `Date` → ISO string; Admin `unwrap()` calls [`reviveDates`](../../core/src/util/date-json.ts).

Column names: **`created_at` / `updated_at`** (no `created` / `updated` aliases).

### Computed columns (FTS rank, aggregates)

```typescript
type SemanticFtsHit = SemanticMemoryRow & { rank: number };
```

FTS / hybrid SELECT use Drizzle `getColumns(table)` or snake_case column refs aligned with schema — **no camelCase SQL aliases**. Extend port row types with `{ rank }` / `{ docKey }` at search layer, not dual-key DbRow structs.

### Non-trivial transform

Conversation/message assembly lives in [`conversation/transform.ts`](../../core/src/db/pg/conversation/transform.ts) and [`message-transform.ts`](../../core/src/db/pg/conversation/message-transform.ts) — not separate mapper directories.

---

## Patterns (SSOT implementations)

Link to source — do not maintain function inventories here.

| Pattern                                         | Reference                                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple CRUD (select / insert / update / delete) | [`semantic-crud-repo.ts`](../../core/src/db/pg/semantic-memory/repos/semantic-crud-repo.ts) — `createSemanticMemory`                                                    |
| Count via ORM                                   | [`message-repo.ts`](../../core/src/db/pg/conversation/repos/message-repo.ts) — `countMessages`                                                                          |
| Dynamic filters (`buildListConditions` + `and`) | [`entity-crud-repo.ts`](../../core/src/db/pg/entity/repos/entity-crud-repo.ts); [`semantic-filters.ts`](../../core/src/db/pg/semantic-memory/repos/semantic-filters.ts) |
| FTS / hybrid search (sql subquery in ORM)       | [`fts/hybrid-raw.ts`](../../core/src/db/pg/fts/hybrid-raw.ts), [`fts/hybrid-search.ts`](../../core/src/db/pg/fts/hybrid-search.ts)                                      |
| Conversation meta transform                     | [`conversation/transform.ts`](../../core/src/db/pg/conversation/transform.ts)                                                                                           |

Table shapes: [`core/src/db/schema/`](../../core/src/db/schema/). Row / input types: [`core/src/db/pg/*/types.ts`](../../core/src/db/pg/) + [`core/src/db/schema/rows/`](../../core/src/db/schema/rows/). `@freeanima/core/repos` re-exports select row types for backward-compatible imports.

---

## Forbidden (new code)

- `db.execute` anywhere under `core/src/db/pg/` or `tests/integration/`
- `drizzleSql.raw` with user-controlled input
- `WHERE true ${rawFragment}` string stitching — use `and(...conditions)` (legacy repos may still use fragments; migrate when touched)
- Hand-written row struct types duplicated across repo files
- Trivial `mapXxxRow` mappers for 1:1 schema rows (normalize in repo only when enum/legacy field rename required)

---

## Review checklist

When adding or changing PG queries:

1. Can Tier 1 ORM handle it?
2. If not, can a `sql` fragment inside ORM (Tier 2)?
3. Is row type derived from `$inferSelect` (± computed fields)?
4. Are timestamps `Date` via `pgTimestamptz`?
5. Integration test needed for new PG operators or driver-sensitive array/vector casts?
