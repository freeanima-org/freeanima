import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { entities, messages, searchDocuments } from "@freeanima/host/core/db/schema";

import { getDb } from "../../client.ts";
import { embedQueryText } from "../../embedding/query.ts";
import { formatPgVector } from "../../embedding/format.ts";
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

/**
 * Vector channel over `search_documents.embedding` (full-sentence query embed).
 * Returns [] when embedding is disabled / fails (fail-open).
 */
export async function searchPgIndexVector(
  query: string,
  filters: SearchFilters,
  limit: number,
): Promise<SearchHit[]> {
  const embedding = await embedQueryText(query);
  if (!embedding || embedding.length === 0) return [];

  const vecLiteral = formatPgVector(embedding);
  const db = getDb();
  const distanceExpr = sql<number>`(${searchDocuments.embedding} <=> ${vecLiteral}::vector)`;
  const rankExpr = sql<number>`(1 - (${searchDocuments.embedding} <=> ${vecLiteral}::vector))`.as(
    "rank",
  );
  const conditions = [...baseDocConditions(filters), sql`${searchDocuments.embedding} IS NOT NULL`];

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
      .orderBy(asc(distanceExpr))
      .limit(limit);

    return rows.map((r) => ({
      doc_key: r.doc_key,
      source_id: r.source_id,
      resource: "entity" as const,
      score: r.rank,
      channels_hit: ["vector" as const],
      channel_scores: { vector: r.rank },
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
      .orderBy(asc(distanceExpr))
      .limit(limit);

    return rows.map((r) => ({
      doc_key: r.doc_key,
      source_id: r.source_id,
      resource: "message" as const,
      score: r.rank,
      channels_hit: ["vector" as const],
      channel_scores: { vector: r.rank },
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
    .orderBy(asc(distanceExpr))
    .limit(limit);

  return rows.map((r) => ({
    doc_key: r.doc_key,
    source_id: r.source_id,
    resource: filters.resource,
    score: r.rank,
    channels_hit: ["vector" as const],
    channel_scores: { vector: r.rank },
  }));
}
