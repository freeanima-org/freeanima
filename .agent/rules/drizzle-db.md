# Drizzle / PostgreSQL query conventions

Repository query patterns for `@freeanima/core/db/pg`. Schema DDL and migrations → [`coding.md`](coding.md) § PG migrations.

**Conflict priority**: implementation in `src/core/db/pg/` > this file.

---

## Scope

| In scope                                         | Out of scope                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/core/db/pg/` repository / FTS query code    | Migration DDL (`db:generate`, `snapshot.json`) — see [`coding.md`](coding.md)               |
| ORM query patterns, type safety, dynamic filters | Product memory pipeline — see [`docs/concepts/memory.md`](../../docs/concepts/memory.md)    |
| Repo transform (non-trivial joins)               | User PG install, backup, ops — see [`docs/guide/database.md`](../../docs/guide/database.md) |

Driver: `drizzle-orm/bun-sql/postgres` via [`src/core/db/pg/client.ts`](../../src/core/db/pg/client.ts).

Pool（`FREEANIMA_PG_POOL_*`）：`idleTimeout` **默认 0**。Bun ≤1.3.14 会把进行中的查询误杀为 `ERR_POSTGRES_IDLE_TIMEOUT`（[oven-sh/bun#30646](https://github.com/oven-sh/bun/issues/30646)）；勿在未确认 Bun 已修复前把默认改回 30。

PG repository 实现位于 `src/core/db/pg/`（按域分子目录）；schema / row 类型 SSOT 在 `@freeanima/core/db`。`src/capabilities/*` 可直接 import `@freeanima/core/db/pg/*` 与 `@freeanima/core/db/schema`（见 [`code-layers.md`](code-layers.md)）。

---

## Decision tree: ORM only

All queries in `src/core/db/pg/` and `tests/integration/` use Drizzle ORM — **`db.execute` is forbidden**（约定；review 把关）。

| Tier                         | When                                                                              | How                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1 — default ORM**          | Single-table CRUD, list, count, `eq` / `inArray` filters                          | `db.select()` / `.insert()` / `.update()` / `.delete()` on schema table                  |
| **2 — ORM + `sql` fragment** | PG functions (`to_tsquery`, `ts_rank_cd`, `pg_trgm`, `pgvector`), CTEs, subselect | Column refs and PG operators in `sql\`…\``inside`.where()`/`.select()`/`.from(sql\`…\`)` |

PG-specific operators (`@@`, `<=>`, `word_similarity`, `array &&`, etc.) belong in **`sql` fragments within ORM builders**, not in standalone `db.execute` calls.

For complex multi-branch SQL (e.g. hybrid count with `UNION`), prefer Drizzle `union()` or `.from(sql\`(subquery) AS alias\`)`.

Do **not** use `drizzleSql.raw` with user-controlled input.

### Bun SQL `text[]` / array operators

`drizzle-orm/bun-sql` **不能**把 JS `string[]` 可靠绑成 PostgreSQL `text[]`。在 `sql` / `drizzleSql` 片段里写 `ANY(${ids})`、`?| ${ids}`、`?& ${ids}`、`&& ${ids}`（`ids: string[]`）会把参数绑成标量，运行时报错（典型：`op ANY/ALL (array) requires array on right side`）。

| Prefer                                                                         | When                               |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| `inArray(column, ids)`                                                         | 普通列 IN / = ANY（Tier 1）        |
| `pgTextArray(ids)` → [`utils/pg-sql.ts`](../../src/core/db/pg/utils/pg-sql.ts) | 必须在 `sql` 里用 `ANY` / jsonb `? | `/ array`&&` |
| `IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`                       | 标量展开，无数组参数               |
| `ARRAY[${one}]::text[]`                                                        | 单元素字面量（如 `components @>`） |

```typescript
// bad
sql`e.val = ANY(${ids})`;
sql`(${entities.body}->'source_conversations') ?| ${ids}`;

// good
sql`e.val = ANY(${pgTextArray(ids)})`;
sql`(${entities.body}->'source_conversations') ?| ${pgTextArray(ids)}`;
```

静态检查：`bun run pg-sql-arrays`（`scripts/check-pg-sql-arrays.ts`，纳入 `bun run check`）。

---

## Type safety

### DbRow / Port row SSOT

Derive row types from Drizzle schema — do not hand-write column structs or duplicate Zod row schemas:

```typescript
export type SelfBlockRow = typeof selfBlocks.$inferSelect;
// or re-export from core/src/db/schema/rows/
```

Thin exports live in [`src/core/db/schema/rows/`](../../src/core/db/schema/rows/). Ports re-export these types; **no per-table mapper** for 1:1 CRUD.

Patch objects: `Partial<typeof {table}.$inferInsert>`.

### Time columns

Use [`pgTimestamptz`](../../src/core/db/schema/columns/pg-timestamptz.ts) in schema — application code reads/writes **`Date`**. JSON API boundary: Hub RPC REST serializes `Date` → ISO string; Console `unwrap()` calls [`reviveDates`](../../src/core/util/date-json.ts).

Column names: **`created_at` / `updated_at`** (no `created` / `updated` aliases).

### Computed columns (FTS rank, aggregates)

```typescript
type SemanticFtsHit = SemanticMemoryRow & { rank: number };
```

FTS / hybrid SELECT use Drizzle `getColumns(table)` or snake_case column refs aligned with schema — **no camelCase SQL aliases**. Extend port row types with `{ rank }` / `{ docKey }` at search layer, not dual-key DbRow structs.

### Non-trivial transform

Conversation/message assembly lives in [`conversation/transform.ts`](../../src/core/db/pg/conversation/transform.ts) and [`message-transform.ts`](../../src/core/db/pg/conversation/message-transform.ts) — not separate mapper directories.

---

## Patterns (SSOT implementations)

Link to source — do not maintain function inventories here.

| Pattern                                         | Reference                                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple CRUD (select / insert / update / delete) | [`semantic-crud-repo.ts`](../../src/core/db/pg/semantic-memory/repos/semantic-crud-repo.ts) — `createSemanticMemory`                                                    |
| Count via ORM                                   | [`message-repo.ts`](../../src/core/db/pg/conversation/repos/message-repo.ts) — `countMessages`                                                                          |
| Dynamic filters (`buildListConditions` + `and`) | [`entity-crud-repo.ts`](../../src/core/db/pg/entity/repos/entity-crud-repo.ts); [`semantic-filters.ts`](../../src/core/db/pg/semantic-memory/repos/semantic-filters.ts) |
| Bun-safe `text[]` (`pgTextArray`)               | [`utils/pg-sql.ts`](../../src/core/db/pg/utils/pg-sql.ts) — `ANY` / jsonb `?                                                                                            | `/ array`&&` |
| FTS / hybrid search (sql subquery in ORM)       | [`fts/hybrid-raw.ts`](../../src/core/db/pg/fts/hybrid-raw.ts), [`fts/hybrid-search.ts`](../../src/core/db/pg/fts/hybrid-search.ts)                                      |
| Entity hybrid search (`searchEntities`)         | [`entity/search/entity-search-repo.ts`](../../src/core/db/pg/entity/search/entity-search-repo.ts) — FTS + trgm + vector → RRF                                           |
| Conversation meta transform                     | [`conversation/transform.ts`](../../src/core/db/pg/conversation/transform.ts)                                                                                           |

**检索与索引**：任何热路径使用 `<=>` / `word_similarity` / `similarity` 的表列，必须同步有 HNSW 或 `gin_trgm_ops`（可在 generate 后的 migration SQL 追加；见 entities / limbic / autobiographical）。表达式唯一索引（email IMAP 等）必须对应 SQL 点查，禁止 `limit N` 扫表 + JS 过滤。

### Entity search: result order

`searchEntities({ mode: "hybrid", query })` returns rows in **relevance order** (RRF score from FTS / trgm / vector). Feature domain **must not** re-sort hybrid hits with list/browse natural order (`sort_order`, `entry_at`, title localeCompare, etc.).

| Path                                                          | Order                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mode: "hybrid"` with non-empty `query`                       | Preserve `result.results` sequence (rank desc)                                                    |
| `mode: "filter_only"` or empty `query`                        | Domain natural order OK (`sort_order` for task_item list, `entry_at` desc for diary browse, etc.) |
| Hybrid empty → ILIKE fallback (`searchFilterOnly` with query) | `updated_at DESC` (not `sort_order`) for task_item                                                |

Domain search wrappers (`searchTaskItems`, `searchDiaryEntries`, `searchVaultItems`, …) map rows but keep hybrid order unless filtering drops items (e.g. closed task lists).

Table shapes: [`src/core/db/schema/`](../../src/core/db/schema/). Row / input types: [`src/core/db/pg/*/types.ts`](../../src/core/db/pg/) + [`src/core/db/schema/rows/`](../../src/core/db/schema/rows/).

---

## Forbidden (new code)

- `db.execute` anywhere under `src/core/db/pg/` or `tests/integration/`
- `drizzleSql.raw` with user-controlled input
- 在 `sql` 片段中把 JS `string[]` 直接绑给 `ANY` / `?|` / `?&` / array `&&`（须 `pgTextArray` 或标量展开；见上节）
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
6. 若 `sql` 使用 `ANY` / `?|` / array `&&`：是否经 `pgTextArray` 或标量展开（勿裸绑 `string[]`）？
