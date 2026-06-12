# Drizzle / PostgreSQL query conventions

Repository query patterns for `@freeanima/platform/connectors/db-pg`. Schema DDL and migrations → [`coding.md`](coding.md) § PG migrations.

**Conflict priority**: implementation in `connectors/db-pg/` > this file.

---

## Scope

| In scope                                                 | Out of scope                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `connectors/db-pg/` repository / FTS query code          | Migration DDL (`db:generate`, `snapshot.json`) — see [`coding.md`](coding.md)               |
| ORM vs `db.execute` choice, type safety, dynamic filters | Product memory pipeline — see [`docs/concepts/memory.md`](../../docs/concepts/memory.md)    |
| Mapper / DbRow typing                                    | User PG install, backup, ops — see [`docs/guide/database.md`](../../docs/guide/database.md) |

Driver: `drizzle-orm/bun-sql/postgres` via [`connectors/db-pg/src/client.ts`](../../connectors/db-pg/src/client.ts).

---

## Decision tree: ORM vs `db.execute`

Before adding `db.execute`, ask: **can this be `db.select().from(table).where(and(...))`?**

| Tier                         | When                                                                               | How                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **1 — default ORM**          | Single-table CRUD, list, count, `eq` / `inArray` filters                           | `db.select()` / `.insert()` / `.update()` / `.delete()` on schema table |
| **2 — ORM + `sql` fragment** | PG functions (`btrim`, `ILIKE`, `CASE` sort), computed predicates on known columns | Column refs in `sql\`…\``inside`.where()`/`.orderBy()`/`.set()`         |
| **3 — `db.execute` only**    | Drizzle query builder cannot express the SQL                                       | Tagged `drizzleSql\`…\`` with minimal hand-written row type             |

**Tier 3 whitelist** (raw SQL is expected):

- Full-text / hybrid / vector search (`to_tsquery`, `ts_rank_cd`, `pg_trgm`, `pgvector`)
- Complex CTEs, `COUNT … FILTER`, cross-table JSONB scans
- `pg_catalog` / `information_schema` introspection
- Dynamic-column `UPDATE` (patch-driven SET list)
- Batch rebuild / cursor pagination over large tables with PG-specific expressions

Do **not** use `db.execute` for simple count, browse, or filter queries that match Tier 1–2.

---

## Type safety

### DbRow SSOT

Derive storage row types from Drizzle schema — do not hand-write column structs in repos:

```typescript
export type TaskDbRow = typeof tasks.$inferSelect;
```

Reference: [`connectors/db-pg/src/tasks/mappers/task-mapper.ts`](../../connectors/db-pg/src/tasks/mappers/task-mapper.ts).

Patch objects: `Partial<typeof {table}.$inferInsert>`.

### Computed columns (FTS rank, aggregates)

```typescript
type SemanticMemoryFtsRow = typeof semanticMemory.$inferSelect & { rank: number };
```

Prefer quoted SQL aliases aligned with schema camelCase (`AS "referenceCount"`) so raw rows map cleanly; otherwise centralize snake→camel in one mapper — do not duplicate dual-key fields across repos.

### `db.execute<T>` is an assertion

`T` is not validated against SQL. Minimize Tier 3 surface; never paste `{ id: string; type: string; … }` literals in multiple repo files.

---

## Patterns (SSOT implementations)

Link to source — do not maintain function inventories here.

| Pattern                                          | Reference                                                                                                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple CRUD (select / insert / update / delete)  | [`semantic-crud-repo.ts`](../../connectors/db-pg/src/semantic-memory/repos/semantic-crud-repo.ts) — `getSemanticMemory`, `createSemanticMemory`                                                                                    |
| Count via ORM                                    | [`message-repo.ts`](../../connectors/db-pg/src/session/repos/message-repo.ts) — `countMessages`; [`task-crud-repo.ts`](../../connectors/db-pg/src/tasks/repos/task-crud-repo.ts) — `countTasks`                                    |
| Dynamic filters (`buildListConditions` + `and`)  | [`task-crud-repo.ts`](../../connectors/db-pg/src/tasks/repos/task-crud-repo.ts) — `buildListConditions`; [`semantic-filters.ts`](../../connectors/db-pg/src/semantic-memory/repos/semantic-filters.ts) — `buildSemanticConditions` |
| PG function in predicate (`ILIKE`, `CASE` order) | [`task-crud-repo.ts`](../../connectors/db-pg/src/tasks/repos/task-crud-repo.ts) — query / priority sort                                                                                                                            |
| Text array overlap                               | Drizzle `arrayOverlaps(column, values)` in `.where()` — verify with integration test on bun-sql driver ([drizzle#4034](https://github.com/drizzle-team/drizzle-orm/issues/4034))                                                   |
| FTS / hybrid search (Tier 3)                     | [`fts/hybrid-raw.ts`](../../connectors/db-pg/src/fts/hybrid-raw.ts), [`fts/hybrid-search.ts`](../../connectors/db-pg/src/fts/hybrid-search.ts)                                                                                     |
| Domain row mapping                               | [`task-mapper.ts`](../../connectors/db-pg/src/tasks/mappers/task-mapper.ts)                                                                                                                                                        |

Table shapes: [`storage/db/src/schema/`](../../storage/db/src/schema/). Port types: [`storage/repos/src/ports/`](../../storage/repos/src/ports/).

---

## Forbidden (new code)

- `WHERE true ${rawFragment}` string stitching — use `and(...conditions)` (legacy repos may still use fragments; migrate when touched)
- `drizzleSql.raw` with user-controlled input
- Hand-written row struct types repeated across repo files
- Tier 1–2 queries implemented as `db.execute` without comment explaining why Tier 3 is required

---

## Review checklist

When adding or changing PG queries:

1. Can Tier 1 ORM handle it?
2. If not, can a `sql` fragment inside ORM (Tier 2)?
3. If Tier 3, is row type derived from `$inferSelect` (± computed fields)?
4. Does mapper live in one place per domain?
5. Integration test needed for new PG operators or driver-sensitive array/vector casts?
