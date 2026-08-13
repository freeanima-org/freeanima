import { getActiveRuntimeConfig, getFtsTrgmFallbackWhenHitsLt } from "@freeanima/host/core/config";
import { entityDocKey, omitUndefined, rrfMerge } from "@freeanima/host/core/util";
import type { EntitySearchHit, EntitySearchOpts, EntitySearchResult } from "../types.ts";
import {
  entityListSelectColumns,
  entityRowSelectColumns,
  mapEntityRow,
} from "@freeanima/host/core/db/schema/entity";
import {
  entities,
  CONTENT_BLOCK_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  TASK_ITEM_COMPONENT,
} from "@freeanima/host/core/db/schema";
import { and, asc, count, desc, sql } from "drizzle-orm";

import { getDb } from "../../client.ts";
import {
  buildEntitySearchWhere,
  buildEntityTextMatchCondition,
  EntitySearchScopeError,
  normalizeEntitySearchQuery,
} from "./conditions.ts";
import { buildEntitySnippet, searchEntitiesFtsRaw } from "./entity-fts-raw.ts";
import { searchEntitiesTrgm } from "./entity-trgm-search.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

function defaultOrderBy(primary_component?: string, opts?: { hasQuery?: boolean }) {
  if (primary_component === DIARY_ENTRY_COMPONENT && !opts?.hasQuery) {
    return [desc(sql`(${entities.body}->>'entry_at')::timestamptz`), desc(entities.id)] as const;
  }
  if (
    (primary_component === TASK_ITEM_COMPONENT || primary_component === CONTENT_BLOCK_COMPONENT) &&
    !opts?.hasQuery
  ) {
    return [sql`COALESCE((${entities.body}->>'sort_order')::bigint, 0)`, asc(entities.id)] as const;
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

  const conditions = where ? [where] : [];
  if (q) {
    conditions.push(buildEntityTextMatchCondition(q));
  }

  const orderExprs = defaultOrderBy(opts.primary_component, { hasQuery: Boolean(q) });
  const columns = opts.projection === "list" ? entityListSelectColumns : entityRowSelectColumns;
  const rows = await db
    .select(columns)
    .from(entities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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

  const pool = candidateLimit(fetchLimit, 0);
  const [ftsHits, trgmHits] = await Promise.all([
    searchEntitiesFtsRaw(q, {
      ...searchOpts,
      limit: pool,
    }),
    searchEntitiesTrgm(q, { ...searchOpts, limit: pool }),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: entityDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked], { limit: pool });
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

    // hybrid COUNT 与 RRF 语义不一致且偏贵：默认用本页条数；调用方显式 include_count 时再估
    const total =
      opts.include_count === false || (mode === "hybrid" && opts.include_count !== true)
        ? results.length
        : await countEntitiesSearch(omitUndefined({ ...opts, query: q || undefined }));

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
  const conditions = where ? [where] : [];
  if (q) {
    // hybrid 也用文本谓词近似（FTS∪ILIKE），避免「仅结构化过滤」撑大 total
    conditions.push(buildEntityTextMatchCondition(q));
  }
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return row?.value ?? 0;
}

export { EntitySearchScopeError };
