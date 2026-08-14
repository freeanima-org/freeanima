import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  SEMANTIC_MEMORY_COMPONENT,
  entities,
  searchDocuments,
} from "@freeanima/habitat/core/db/schema";

import { getDb } from "../client.ts";
import { parsePgVector, formatPgVector } from "../embedding/format.ts";
import { searchDocKey } from "./doc-key.ts";
import { buildSemanticStatusCondition } from "../semantic-memory/repos/semantic-filters.ts";

export type SemanticEmbeddingClusterRow = {
  entityId: number;
  embedding: number[];
  clusterId: number | null;
};

/** Active semantic_memory entities that have a search_documents embedding. */
export async function listActiveSemanticMemoryEmbeddings(): Promise<SemanticEmbeddingClusterRow[]> {
  const statusCond = buildSemanticStatusCondition("active");
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    eq(searchDocuments.resource, "entity"),
    isNotNull(searchDocuments.embedding),
    sql`${entities.deleted_at} IS NULL`,
  ];
  if (statusCond) conditions.push(statusCond);

  const rows = await getDb()
    .select({
      entityId: entities.id,
      embedding: searchDocuments.embedding,
      clusterId: searchDocuments.cluster_id,
    })
    .from(entities)
    .innerJoin(
      searchDocuments,
      and(
        eq(searchDocuments.resource, "entity"),
        sql`${searchDocuments.source_id} = ${entities.id}::text`,
      ),
    )
    .where(and(...conditions));

  const out: SemanticEmbeddingClusterRow[] = [];
  for (const row of rows) {
    const embedding = parsePgVector(row.embedding);
    if (!embedding) continue;
    out.push({
      entityId: row.entityId,
      embedding,
      clusterId: row.clusterId ?? null,
    });
  }
  return out;
}

export type SemanticClusterIdRow = {
  entityId: number;
  clusterId: number | null;
};

/** Active semantic memories with optional cluster_id (left join; no embedding required). */
export async function listActiveSemanticMemoryClusterIds(): Promise<SemanticClusterIdRow[]> {
  const statusCond = buildSemanticStatusCondition("active");
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    sql`${entities.deleted_at} IS NULL`,
  ];
  if (statusCond) conditions.push(statusCond);

  const rows = await getDb()
    .select({
      entityId: entities.id,
      clusterId: searchDocuments.cluster_id,
    })
    .from(entities)
    .leftJoin(
      searchDocuments,
      and(
        eq(searchDocuments.resource, "entity"),
        sql`${searchDocuments.source_id} = ${entities.id}::text`,
      ),
    )
    .where(and(...conditions));

  return rows.map((row) => ({
    entityId: row.entityId,
    clusterId: row.clusterId ?? null,
  }));
}

/**
 * Incremental assign: nearest already-clustered neighbor via HNSW cosine distance.
 * Approximates "nearest centroid" without loading all vectors (2C2G-friendly).
 */
export async function findNearestClusteredNeighbor(
  embedding: number[],
  opts?: { excludeEntityId?: number },
): Promise<{ entityId: number; clusterId: number; distance: number } | null> {
  const vecLiteral = formatPgVector(embedding);
  const distanceExpr = sql<number>`(${searchDocuments.embedding} <=> ${vecLiteral}::vector)`;
  const conditions = [
    eq(searchDocuments.resource, "entity"),
    eq(searchDocuments.primary_component, SEMANTIC_MEMORY_COMPONENT),
    isNotNull(searchDocuments.embedding),
    isNotNull(searchDocuments.cluster_id),
  ];
  if (opts?.excludeEntityId != null) {
    conditions.push(sql`${searchDocuments.source_id} <> ${String(opts.excludeEntityId)}`);
  }

  const rows = await getDb()
    .select({
      sourceId: searchDocuments.source_id,
      clusterId: searchDocuments.cluster_id,
      distance: distanceExpr,
    })
    .from(searchDocuments)
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(1);

  const row = rows[0];
  if (!row || row.clusterId == null) return null;
  const entityId = Number(row.sourceId);
  if (!Number.isInteger(entityId) || entityId <= 0) return null;
  const distance = row.distance;
  if (!Number.isFinite(distance)) return null;
  return { entityId, clusterId: row.clusterId, distance };
}

export async function getEntitySearchDocumentClusterId(
  entityId: number,
): Promise<number | null | undefined> {
  const doc_key = searchDocKey("entity", entityId);
  const rows = await getDb()
    .select({ clusterId: searchDocuments.cluster_id })
    .from(searchDocuments)
    .where(eq(searchDocuments.doc_key, doc_key))
    .limit(1);
  if (rows.length === 0) return undefined;
  return rows[0]?.clusterId ?? null;
}
