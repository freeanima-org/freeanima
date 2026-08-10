import { and, desc, sql } from "drizzle-orm";
import { entities, searchDocuments } from "@freeanima/host/core/db/schema";
import { entityRowSelectColumns, mapEntityRow } from "@freeanima/host/core/db/schema/entity";
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

async function searchEntitiesFtsWithTsquery(
  tsquery: string,
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityFtsDbRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const where = buildEntitySearchWhere(opts);
  const conditions = [
    sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
    ...(where ? [where] : []),
  ];

  const rows = await db
    .select({
      ...entityRowSelectColumns,
      rank: rankExpr,
    })
    .from(entities)
    .innerJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({ ...mapEntityRow(r), rank: Number(r.rank) }));
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
  const byId = new Map<number, EntityFtsDbRow>();

  for (const tsquery of tsqueries) {
    const hits = await searchEntitiesFtsWithTsquery(tsquery, { ...opts, limit });
    for (const hit of hits) {
      const prev = byId.get(hit.id);
      if (!prev || hit.rank > prev.rank) byId.set(hit.id, hit);
    }
  }

  return [...byId.values()].toSorted((a, b) => b.rank - a.rank).slice(0, limit);
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
