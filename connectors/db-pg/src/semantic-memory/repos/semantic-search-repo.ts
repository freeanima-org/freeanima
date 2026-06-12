import { sql as drizzleSql, type SQL } from "drizzle-orm";
import type {
  SemanticFtsHit,
  SemanticMemorySearchOpts,
  SemanticMemorySortBy,
} from "@freeanima/storage-repos";

import { getDb } from "../../client.ts";
import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "../../utils/pg-sql.ts";
import { hybridCountSemanticMemory, hybridSearchSemanticMemory } from "../../fts/hybrid-search.ts";
import { mapSemanticMemoryRow, type SemanticMemoryDbRow } from "../mappers/semantic-mapper.ts";

type SemanticSearchFilterOpts = Omit<SemanticMemorySearchOpts, "limit" | "offset">;

function normalizeSearchOpts(opts: SemanticSearchFilterOpts) {
  const types = opts.types?.filter(Boolean) ?? [];
  const status = opts.status ?? "active";
  const sourceSessions = opts.source_sessions?.map((s: string) => s.trim()).filter(Boolean) ?? [];
  const q = opts.query?.trim() ?? "";
  return { types, status, sourceSessions, q };
}

function buildSemanticFilters(
  types: string[],
  status: "active" | "deprecated" | "all",
  sourceSessions: string[],
) {
  const typeFilter = pgSemanticTypeFilter(types);
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter = pgSemanticSourceSessionsFilter(sourceSessions);
  return { typeFilter, statusFilter, sourceFilter };
}

function resolveEffectiveSort(
  q: string,
  sortBy: SemanticMemorySortBy | undefined,
): SemanticMemorySortBy {
  const resolved = sortBy ?? (q ? "rank" : "updated");
  if (q && resolved !== "rank") return "rank";
  if (!q && resolved === "rank") return "updated";
  return resolved;
}

function browseOrderBy(sortBy: Exclude<SemanticMemorySortBy, "rank">): SQL {
  const orderBy: Record<Exclude<SemanticMemorySortBy, "rank">, SQL> = {
    created: drizzleSql`sm.created DESC`,
    updated: drizzleSql`sm.updated DESC`,
    reference_count: drizzleSql`sm.reference_count DESC, sm.updated DESC`,
  };
  return orderBy[sortBy];
}

export async function searchSemanticMemory(
  opts: SemanticMemorySearchOpts,
): Promise<SemanticFtsHit[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  const { types, status, sourceSessions, q } = normalizeSearchOpts(opts);
  const { typeFilter, statusFilter, sourceFilter } = buildSemanticFilters(
    types,
    status,
    sourceSessions,
  );
  const effectiveSort = resolveEffectiveSort(q, opts.sort_by);

  const db = getDb();
  if (effectiveSort === "rank") {
    if (!q) {
      return searchSemanticMemoryBrowse(db, {
        typeFilter,
        statusFilter,
        sourceFilter,
        sortBy: "updated",
        offset,
        limit,
      });
    }
    return hybridSearchSemanticMemory(q, {
      limit,
      offset,
      types,
      status,
      sourceSessions,
    });
  }

  return searchSemanticMemoryBrowse(db, {
    typeFilter,
    statusFilter,
    sourceFilter,
    sortBy: effectiveSort,
    offset,
    limit,
  });
}

async function searchSemanticMemoryBrowse(
  db: ReturnType<typeof getDb>,
  args: {
    typeFilter: SQL;
    statusFilter: SQL;
    sourceFilter: SQL;
    sortBy: Exclude<SemanticMemorySortBy, "rank">;
    offset: number;
    limit: number;
  },
): Promise<SemanticFtsHit[]> {
  const { typeFilter, statusFilter, sourceFilter, sortBy, offset, limit } = args;
  const orderBy = browseOrderBy(sortBy);
  const rows = await db.execute<SemanticMemoryDbRow & { rank: number }>(drizzleSql`
    SELECT
      sm.id,
      sm.type,
      sm.pinned,
      sm.content,
      sm.source_sessions,
      sm.observed_at,
      sm.occurred_at,
      sm.status,
      sm.reference_count,
      sm.created,
      sm.updated,
      1.0 AS rank
    FROM semantic_memory sm
    WHERE true
    ${typeFilter}
    ${statusFilter}
    ${sourceFilter}
    ORDER BY ${orderBy}
    OFFSET ${offset}
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    rank: Number(r.rank),
  }));
}

export async function countSemanticMemorySearch(opts: SemanticSearchFilterOpts): Promise<number> {
  const { types, status, sourceSessions, q } = normalizeSearchOpts(opts);
  const { typeFilter, statusFilter, sourceFilter } = buildSemanticFilters(
    types,
    status,
    sourceSessions,
  );

  const db = getDb();
  if (q) {
    return hybridCountSemanticMemory(q, { types, status, sourceSessions });
  }

  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM semantic_memory sm
    WHERE true
    ${typeFilter}
    ${statusFilter}
    ${sourceFilter}
  `);
  return Number(rows[0]?.n ?? 0);
}
