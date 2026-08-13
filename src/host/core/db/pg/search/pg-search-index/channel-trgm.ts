import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { entities, messages, searchDocuments } from "@freeanima/host/core/db/schema";

import { getDb } from "../../client.ts";
import { buildSemanticConditions } from "../../semantic-memory/repos/semantic-filters.ts";
import type { SearchFilters, SearchHit } from "../types.ts";
import { trgmMinSimilarity } from "./channel-fts.ts";

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

export async function searchPgIndexTrgm(
  query: string,
  filters: SearchFilters,
  limit: number,
): Promise<SearchHit[]> {
  const minSim = trgmMinSimilarity();
  const db = getDb();
  const rankExpr = sql<number>`similarity(${searchDocuments.content}, ${query})`.as("rank");
  const conditions = [
    ...baseDocConditions(filters),
    sql`word_similarity(${searchDocuments.content}, ${query}) >= ${minSim}`,
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
      channels_hit: ["trgm" as const],
      channel_scores: { trgm: r.rank },
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
      channels_hit: ["trgm" as const],
      channel_scores: { trgm: r.rank },
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
    channels_hit: ["trgm" as const],
    channel_scores: { trgm: r.rank },
  }));
}
