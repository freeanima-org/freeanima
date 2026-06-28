import { getActiveConfig, getFtsTrgmFallbackWhenHitsLt } from "@freeanima/platform/config";
import { entityDocKey, rrfMerge } from "@freeanima/core/util";
import type { EntitySearchHit, EntitySearchOpts, EntitySearchResult } from "@freeanima/core/repos";
import { mapEntityRow } from "@freeanima/core/db/schema/entity";
import { entities, TASK_ITEM_COMPONENT } from "@freeanima/core/db/schema";
import { and, asc, count, desc, getColumns, sql } from "drizzle-orm";

import { embedQueryText } from "../../embedding/query.ts";
import { getDb } from "../../client.ts";
import {
  buildEntitySearchWhere,
  buildEntityTextMatchCondition,
  EntitySearchScopeError,
  normalizeEntitySearchQuery,
} from "./conditions.ts";
import { buildEntitySnippet, searchEntitiesFtsRaw } from "./entity-fts-raw.ts";
import { searchEntitiesTrgm } from "./entity-trgm-search.ts";
import { searchEntitiesVector } from "./entity-vector-search.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

function defaultOrderBy(primary_component?: string) {
  if (primary_component === TASK_ITEM_COMPONENT) {
    return [sql`COALESCE((${entities.body}->>'sort_order')::int, 0)`, asc(entities.id)] as const;
  }
  return [desc(entities.updated_at), asc(entities.id)] as const;
}

function resolveSearchQuery(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  return normalizeEntitySearchQuery(trimmed) || trimmed;
}

async function searchFilterOnly(opts: EntitySearchOpts): Promise<EntitySearchHit[]> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const q = resolveSearchQuery(opts.query);
  const where = buildEntitySearchWhere(opts);
  const db = getDb();

  const conditions = [...(where ? [where] : [])];
  if (q) {
    conditions.push(buildEntityTextMatchCondition(q));
  }

  const orderExprs = defaultOrderBy(opts.primary_component);
  const rows = await db
    .select(getColumns(entities))
    .from(entities)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...orderExprs)
    .limit(limit)
    .offset(offset);

  return rows.map((row) => {
    const mapped = mapEntityRow(row);
    const hit: EntitySearchHit = { ...mapped };
    if (q) hit.snippet = buildEntitySnippet(mapped, q);
    return hit;
  });
}

async function searchHybrid(opts: EntitySearchOpts): Promise<EntitySearchHit[]> {
  const q = resolveSearchQuery(opts.query);
  if (!q) {
    return searchFilterOnly({ ...opts, mode: "filter_only" });
  }

  const limit = Math.max(1, Math.min(50, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  const fetchLimit = limit + offset;
  const searchOpts = { ...opts, query: q };

  const queryEmbedding = await embedQueryText(q);
  const ftsHits = await searchEntitiesFtsRaw(q, {
    ...searchOpts,
    limit: candidateLimit(fetchLimit, 0),
  });
  const pool = candidateLimit(fetchLimit, ftsHits.length);

  const [trgmHits, vectorHits] = await Promise.all([
    searchEntitiesTrgm(q, { ...searchOpts, limit: pool }),
    queryEmbedding
      ? searchEntitiesVector(queryEmbedding, { ...searchOpts, limit: pool })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: entityDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked, vectorRanked], { limit: pool });
  const hybridHits = merged.slice(offset, offset + limit).map((row) => {
    const {
      docKey: _docKey,
      score,
      rank: _rank,
      ...rest
    } = row as typeof row & {
      docKey?: string;
      rank?: number;
    };
    const hit: EntitySearchHit = {
      ...(rest as EntitySearchHit),
      rank: score,
      snippet: buildEntitySnippet(rest, q),
    };
    return hit;
  });

  if (hybridHits.length > 0) return hybridHits;

  return searchFilterOnly({ ...searchOpts, mode: "filter_only", limit, offset });
}

export async function searchEntities(opts: EntitySearchOpts = {}): Promise<EntitySearchResult> {
  try {
    const q = resolveSearchQuery(opts.query);
    const limit = Math.max(1, Math.min(opts.mode === "filter_only" ? 500 : 50, opts.limit ?? 10));
    const offset = Math.max(0, opts.offset ?? 0);
    const mode = opts.mode ?? (q ? "hybrid" : "filter_only");

    const results =
      mode === "hybrid"
        ? await searchHybrid({ ...opts, limit, offset })
        : await searchFilterOnly({ ...opts, limit, offset });

    const total = await countEntitiesSearch({ ...opts, query: q || undefined });

    return {
      query: q || null,
      limit,
      offset,
      count: total,
      results,
    };
  } catch (err) {
    if (err instanceof EntitySearchScopeError) throw err;
    throw err;
  }
}

export async function countEntitiesSearch(
  opts: Omit<EntitySearchOpts, "offset" | "limit"> = {},
): Promise<number> {
  const q = resolveSearchQuery(opts.query);
  const where = buildEntitySearchWhere(opts);
  const db = getDb();
  const conditions = [...(where ? [where] : [])];
  if (q && opts.mode !== "hybrid") {
    conditions.push(buildEntityTextMatchCondition(q));
  }
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(conditions.length ? and(...conditions) : undefined);
  return Number(row?.value ?? 0);
}

export { EntitySearchScopeError };
