import { and, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { entities, searchDocuments } from "@freeanima/habitat/core/db/schema";
import { entityRowSelectColumns, mapEntityRow } from "@freeanima/habitat/core/db/schema/entity";
import type { EntitySearchOpts } from "../types.ts";

import { getDb } from "../../client.ts";
import { buildCharModeTsQuery } from "../../fts/query-char.ts";
import { buildFtsTsQuery } from "../../fts/query.ts";
import { entitySearchDocumentsJoin } from "../../search/pg-search-index/channel-fts.ts";
import { buildEntitySearchWhere, normalizeEntitySearchQuery } from "./conditions.ts";

export type EntityFtsDbRow = ReturnType<typeof mapEntityRow> & { rank: number };

async function collectEntityFtsTsQueries(query: string): Promise<string[]> {
  const seen = new Set<string>();
  const add = (part: string) => {
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed);
  };

  add(await buildFtsTsQuery(query));
  add(buildCharModeTsQuery(query));

  const normalized = normalizeEntitySearchQuery(query);
  if (normalized && normalized !== query.trim()) {
    add(await buildFtsTsQuery(normalized));
    add(buildCharModeTsQuery(normalized));
  }

  return [...seen];
}

/** 推到 search_documents 已有列，便于 GIN + world_primary 索引。 */
function buildSearchDocumentsFtsScope(opts: EntitySearchOpts): SQL[] {
  const conditions: SQL[] = [];
  const deleted = opts.deleted ?? "alive";
  if (deleted === "alive") {
    conditions.push(isNull(searchDocuments.deleted_at));
  } else if (deleted === "deleted") {
    conditions.push(isNotNull(searchDocuments.deleted_at));
  }
  if (opts.primary_component) {
    conditions.push(eq(searchDocuments.primary_component, opts.primary_component));
  }
  if (opts.global) {
    const ids = opts.accessible_world_ids?.filter((id) => Number.isFinite(id) && id > 0) ?? [];
    if (ids.length === 1) {
      const only = ids[0];
      if (only !== undefined) conditions.push(eq(searchDocuments.world_id, only));
    } else if (ids.length > 1) {
      conditions.push(inArray(searchDocuments.world_id, ids));
    }
  } else if (opts.world_id != null && opts.world_id > 0) {
    conditions.push(eq(searchDocuments.world_id, opts.world_id));
  }
  return conditions;
}

type EntityFtsIdRank = { id: number; rank: number };

async function searchEntitiesFtsIdsWithTsquery(
  tsquery: string,
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityFtsIdRank[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const where = buildEntitySearchWhere(opts);
  const conditions = [
    sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
    ...buildSearchDocumentsFtsScope(opts),
    ...(where ? [where] : []),
  ];

  const rows = await db
    .select({
      id: entities.id,
      rank: rankExpr,
    })
    .from(entities)
    .innerJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({ id: r.id, rank: r.rank }));
}

async function hydrateEntityFtsHits(
  byId: Map<number, number>,
  limit: number,
): Promise<EntityFtsDbRow[]> {
  const top = [...byId.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const ids = top.map(([id]) => id);
  const db = getDb();
  const rows = await db
    .select(entityRowSelectColumns)
    .from(entities)
    .where(inArray(entities.id, ids));
  const entitiesById = new Map(rows.map((r) => [r.id, mapEntityRow(r)]));

  const out: EntityFtsDbRow[] = [];
  for (const [id, rank] of top) {
    const row = entitiesById.get(id);
    if (row) out.push({ ...row, rank });
  }
  return out;
}

export async function searchEntitiesFtsRaw(
  query: string,
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityFtsDbRow[]> {
  const q = query.trim();
  if (!q) return [];

  const tsqueries = await collectEntityFtsTsQueries(q);
  if (tsqueries.length === 0) return [];

  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const byId = new Map<number, number>();

  for (const tsquery of tsqueries) {
    const hits = await searchEntitiesFtsIdsWithTsquery(tsquery, { ...opts, limit });
    for (const hit of hits) {
      const prev = byId.get(hit.id);
      if (prev === undefined || hit.rank > prev) byId.set(hit.id, hit.rank);
    }
  }

  return hydrateEntityFtsHits(byId, limit);
}

export function buildEntitySnippet(
  row: { title: string; summary: string; content: string },
  query: string,
): string {
  const q = query.trim();
  const haystack = [row.title, row.summary, row.content].filter(Boolean).join(" — ");
  if (!q || !haystack) return row.title || row.summary || row.content || "";
  const lowerHay = haystack.toLowerCase();
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/['"]/g, "").trim())
    .filter((t) => t.length > 0);
  for (const term of terms) {
    const idx = lowerHay.indexOf(term.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(haystack.length, idx + term.length + 60);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < haystack.length ? "…" : "";
      return `${prefix}${haystack.slice(start, end)}${suffix}`;
    }
  }
  return haystack.length > 120 ? `${haystack.slice(0, 117)}…` : haystack;
}
