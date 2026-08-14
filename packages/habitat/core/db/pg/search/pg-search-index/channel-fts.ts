import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { entities, messages, searchDocuments } from "@freeanima/habitat/core/db/schema";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/habitat/core/config";

import { getDb } from "../../client.ts";
import { buildFtsTsQuery } from "../../fts/query.ts";
import { buildSemanticConditions } from "../../semantic-memory/repos/semantic-filters.ts";
import type { SearchFilters, SearchHit } from "../types.ts";

function baseDocConditions(filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [eq(searchDocuments.resource, filters.resource)];
  if (!filters.include_deleted) {
    conditions.push(isNull(searchDocuments.deleted_at));
  }
  if (filters.world_id != null) {
    conditions.push(eq(searchDocuments.world_id, filters.world_id));
  }
  if (filters.primary_component) {
    conditions.push(eq(searchDocuments.primary_component, filters.primary_component));
  }
  if (filters.conversation_id) {
    conditions.push(eq(searchDocuments.conversation_id, filters.conversation_id));
  }
  return conditions;
}

export async function searchPgIndexFts(
  query: string,
  filters: SearchFilters,
  limit: number,
): Promise<SearchHit[]> {
  const tsquery = await buildFtsTsQuery(query);
  if (!tsquery) return [];

  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const conditions = [
    ...baseDocConditions(filters),
    sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
  ];

  if (filters.resource === "entity" && filters.primary_component === "semantic_memory") {
    const semantic = buildSemanticConditions({
      types: filters.semantic_types ?? [],
      status: filters.semantic_status ?? "active",
      source_conversations: filters.source_conversations ?? [],
    });
    const rows = await db
      .select({
        doc_key: searchDocuments.doc_key,
        source_id: searchDocuments.source_id,
        rank: rankExpr,
      })
      .from(searchDocuments)
      .innerJoin(
        entities,
        and(
          eq(searchDocuments.resource, "entity"),
          sql`${searchDocuments.source_id} = ${entities.id}::text`,
        ),
      )
      .where(and(...conditions, ...semantic))
      .orderBy(desc(rankExpr))
      .limit(limit);

    return rows.map((r) => ({
      doc_key: r.doc_key,
      source_id: r.source_id,
      resource: "entity" as const,
      score: r.rank,
      channels_hit: ["fts" as const],
      channel_scores: { fts: r.rank },
    }));
  }

  if (filters.resource === "message") {
    const rows = await db
      .select({
        doc_key: searchDocuments.doc_key,
        source_id: searchDocuments.source_id,
        rank: rankExpr,
      })
      .from(searchDocuments)
      .innerJoin(messages, eq(searchDocuments.source_id, messages.id))
      .where(and(...conditions))
      .orderBy(desc(rankExpr))
      .limit(limit);

    return rows.map((r) => ({
      doc_key: r.doc_key,
      source_id: r.source_id,
      resource: "message" as const,
      score: r.rank,
      channels_hit: ["fts" as const],
      channel_scores: { fts: r.rank },
    }));
  }

  const rows = await db
    .select({
      doc_key: searchDocuments.doc_key,
      source_id: searchDocuments.source_id,
      rank: rankExpr,
    })
    .from(searchDocuments)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    doc_key: r.doc_key,
    source_id: r.source_id,
    resource: filters.resource,
    score: r.rank,
    channels_hit: ["fts" as const],
    channel_scores: { fts: r.rank },
  }));
}

/** Exported for entity-search JOIN path (rich filters on entities). */
export function searchDocumentsFtsRankExpr(tsqueryExpr: ReturnType<typeof sql>) {
  return sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`;
}

export function searchDocumentsFtsMatch(tsqueryExpr: ReturnType<typeof sql>): SQL {
  return sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`;
}

export function entitySearchDocumentsJoin() {
  return and(
    eq(searchDocuments.resource, "entity"),
    sql`${searchDocuments.source_id} = ${entities.id}::text`,
  );
}

export function messageSearchDocumentsJoin() {
  return and(eq(searchDocuments.resource, "message"), eq(searchDocuments.source_id, messages.id));
}

export function trgmMinSimilarity(): number {
  return getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
}
