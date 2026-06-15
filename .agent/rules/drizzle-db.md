# Drizzle / PostgreSQL query conventions

Repository query patterns for `@freeanima/platform/connectors/db-pg`. Schema DDL and migrations → [`coding.md`](coding.md) § PG migrations.

**Conflict priority**: implementation in `platform/connectors/db-pg/` > this file.

---

## Scope

| In scope                                                 | Out of scope                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `platform/connectors/db-pg/` repository / FTS query code | Migration DDL (`db:generate`, `snapshot.json`) — see [`coding.md`](coding.md)               |
| ORM query patterns, type safety, dynamic filters         | Product memory pipeline — see [`docs/concepts/memory.md`](../../docs/concepts/memory.md)    |
| Mapper / DbRow typing                                    | User PG install, backup, ops — see [`docs/guide/database.md`](../../docs/guide/database.md) |

Driver: `drizzle-orm/bun-sql/postgres` via [`platform/connectors/db-pg/client.ts`](../../platform/connectors/db-pg/client.ts).

---

## Decision tree: ORM only

All queries in `platform/connectors/db-pg/` and `tests/integration/` use Drizzle ORM — **`db.execute` is forbidden** (enforced by [`scripts/check-no-db-execute.ts`](../../scripts/check-no-db-execute.ts)).

| Tier                         | When                                                                              | How                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1 — default ORM**          | Single-table CRUD, list, count, `eq` / `inArray` filters                          | `db.select()` / `.insert()` / `.update()` / `.delete()` on schema table                  |
| **2 — ORM + `sql` fragment** | PG functions (`to_tsquery`, `ts_rank_cd`, `pg_trgm`, `pgvector`), CTEs, subselect | Column refs and PG operators in `sql\`…\``inside`.where()`/`.select()`/`.from(sql\`…\`)` |

PG-specific operators (`@@`, `<=>`, `word_similarity`, `array &&`, etc.) belong in **`sql` fragments within ORM builders**, not in standalone `db.execute` calls.

For complex multi-branch SQL (e.g. hybrid count with `UNION`), prefer Drizzle `union()` or `.from(sql\`(subquery) AS alias\`)`.

Do **not** use `drizzleSql.raw` with user-controlled input.

---

## Type safety

### DbRow SSOT

Derive storage row types from Drizzle schema — do not hand-write column structs in repos:

```typescript
export type TaskDbRow = typeof tasks.$inferSelect;
```

Reference: [`platform/connectors/db-pg/tasks/mappers/task-mapper.ts`](../../platform/connectors/db-pg/tasks/mappers/task-mapper.ts).

Patch objects: `Partial<typeof {table}.$inferInsert>`.

### Computed columns (FTS rank, aggregates)

```typescript
type SemanticMemoryFtsRow = typeof semanticMemory.$inferSelect & { rank: number };
```

Prefer quoted SQL aliases aligned with schema camelCase (`AS "referenceCount"`) so raw rows map cleanly; otherwise centralize snake→camel in one mapper — do not duplicate dual-key fields across repos.

---

## Patterns (SSOT implementations)

Link to source — do not maintain function inventories here.

| Pattern                                          | Reference                                                                                                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple CRUD (select / insert / update / delete)  | [`semantic-crud-repo.ts`](../../platform/connectors/db-pg/semantic-memory/repos/semantic-crud-repo.ts) — `getSemanticMemory`, `createSemanticMemory`                                                                                         |
| Count via ORM                                    | [`message-repo.ts`](../../platform/connectors/db-pg/session/repos/message-repo.ts) — `countMessages`; [`task-crud-repo.ts`](../../platform/connectors/db-pg/tasks/repos/task-crud-repo.ts) — `countTasks`                                    |
| Dynamic filters (`buildListConditions` + `and`)  | [`task-crud-repo.ts`](../../platform/connectors/db-pg/tasks/repos/task-crud-repo.ts) — `buildListConditions`; [`semantic-filters.ts`](../../platform/connectors/db-pg/semantic-memory/repos/semantic-filters.ts) — `buildSemanticConditions` |
| PG function in predicate (`ILIKE`, `CASE` order) | [`task-crud-repo.ts`](../../platform/connectors/db-pg/tasks/repos/task-crud-repo.ts) — query / priority sort                                                                                                                                 |
| Text array overlap                               | Drizzle `arrayOverlaps(column, values)` in `.where()` — verify with integration test on bun-sql driver ([drizzle#4034](https://github.com/drizzle-team/drizzle-orm/issues/4034))                                                             |
| FTS / hybrid search (sql subquery in ORM)        | [`fts/hybrid-raw.ts`](../../platform/connectors/db-pg/fts/hybrid-raw.ts), [`fts/hybrid-search.ts`](../../platform/connectors/db-pg/fts/hybrid-search.ts)                                                                                     |
| Domain row mapping                               | [`task-mapper.ts`](../../platform/connectors/db-pg/tasks/mappers/task-mapper.ts)                                                                                                                                                             |

Table shapes: [`core/src/db/schema/`](../../core/src/db/schema/). Port types: [`core/src/repos/ports/`](../../core/src/repos/ports/).

---

## Forbidden (new code)

- `db.execute` anywhere under `platform/connectors/db-pg/` or `tests/integration/`
- `drizzleSql.raw` with user-controlled input
- `WHERE true ${rawFragment}` string stitching — use `and(...conditions)` (legacy repos may still use fragments; migrate when touched)
- Hand-written row struct types repeated across repo files

---

## Review checklist

When adding or changing PG queries:

1. Can Tier 1 ORM handle it?
2. If not, can a `sql` fragment inside ORM (Tier 2)?
3. Is row type derived from `$inferSelect` (± computed fields)?
4. Does mapper live in one place per domain?
5. Integration test needed for new PG operators or driver-sensitive array/vector casts?
