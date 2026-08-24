import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
export async function listActiveSemanticMemoryEmbeddings(opts?: {
  world_id?: number;
}): Promise<SemanticEmbeddingClusterRow[]> {
  const statusCond = buildSemanticStatusCondition("active");
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    eq(searchDocuments.resource, "entity"),
    isNotNull(searchDocuments.embedding),
    sql`${entities.deleted_at} IS NULL`,
  ];
  if (statusCond) conditions.push(statusCond);
  if (opts?.world_id != null) conditions.push(eq(entities.world_id, opts.world_id));

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
export async function listActiveSemanticMemoryClusterIds(opts?: {
  world_id?: number;
}): Promise<SemanticClusterIdRow[]> {
  const statusCond = buildSemanticStatusCondition("active");
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    sql`${entities.deleted_at} IS NULL`,
  ];
  if (statusCond) conditions.push(statusCond);
  if (opts?.world_id != null) conditions.push(eq(entities.world_id, opts.world_id));

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
  opts?: { excludeEntityId?: number; world_id?: number },
): Promise<{ entityId: number; clusterId: number; distance: number } | null> {
  const vecLiteral = formatPgVector(embedding);
  const distanceExpr = sql<number>`(${searchDocuments.embedding} <=> ${vecLiteral}::vector)`;
  const conditions = [
    eq(searchDocuments.resource, "entity"),
    eq(searchDocuments.primary_component, SEMANTIC_MEMORY_COMPONENT),
    isNotNull(searchDocuments.embedding),
    isNotNull(searchDocuments.cluster_id),
  ];
  if (opts?.world_id != null) {
    conditions.push(eq(searchDocuments.world_id, opts.world_id));
  }
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

/** Batch lookup cluster_id by semantic_memory entity ids. Missing docs → null. */
export async function getClusterIdsByEntityIds(
  entityIds: readonly number[],
): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  for (const id of entityIds) out.set(id, null);
  if (entityIds.length === 0) return out;

  const rows = await getDb()
    .select({
      sourceId: searchDocuments.source_id,
      clusterId: searchDocuments.cluster_id,
    })
    .from(searchDocuments)
    .where(
      and(
        eq(searchDocuments.resource, "entity"),
        inArray(
          searchDocuments.source_id,
          entityIds.map((id) => String(id)),
        ),
      ),
    );

  for (const row of rows) {
    const entityId = Number(row.sourceId);
    if (!Number.isInteger(entityId) || entityId <= 0) continue;
    out.set(entityId, row.clusterId ?? null);
  }
  return out;
}

export type SemanticClusterStat = {
  cluster_id: number | null;
  count: number;
};

/** Distinct cluster_id counts for active semantic memories (left join; null = 未分组). */
export async function listSemanticMemoryClusterStats(opts?: {
  status?: "active" | "deprecated" | "all";
  world_id?: number;
}): Promise<SemanticClusterStat[]> {
  const status = opts?.status ?? "active";
  const statusCond = buildSemanticStatusCondition(status);
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    sql`${entities.deleted_at} IS NULL`,
  ];
  if (statusCond) conditions.push(statusCond);
  if (opts?.world_id != null) conditions.push(eq(entities.world_id, opts.world_id));

  const rows = await getDb()
    .select({
      clusterId: searchDocuments.cluster_id,
      count: sql<number>`count(*)::int`,
    })
    .from(entities)
    .leftJoin(
      searchDocuments,
      and(
        eq(searchDocuments.resource, "entity"),
        sql`${searchDocuments.source_id} = ${entities.id}::text`,
      ),
    )
    .where(and(...conditions))
    .groupBy(searchDocuments.cluster_id)
    .orderBy(sql`${searchDocuments.cluster_id} ASC NULLS LAST`);

  return rows.map((row) => ({
    cluster_id: row.clusterId ?? null,
    count: row.count,
  }));
}

export type SemanticClusterTitleSample = {
  entityId: number;
  title: string;
  summary: string;
  content: string;
};

/**
 * 按 entity id 升序取某簇最多 limit 条，供簇 title 生成（确定性，非随机）。
 * cluster_id 必须为非负整数；未分组勿调用。
 */
export async function listSemanticClusterTitleSamples(
  clusterId: number,
  opts?: { limit?: number; world_id?: number },
): Promise<SemanticClusterTitleSample[]> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 3, 10));
  const statusCond = buildSemanticStatusCondition("active");
  const conditions = [
    eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
    sql`${entities.deleted_at} IS NULL`,
    eq(searchDocuments.resource, "entity"),
    eq(searchDocuments.cluster_id, clusterId),
    isNotNull(searchDocuments.cluster_id),
  ];
  if (statusCond) conditions.push(statusCond);
  if (opts?.world_id != null) conditions.push(eq(entities.world_id, opts.world_id));

  const rows = await getDb()
    .select({
      entityId: entities.id,
      title: entities.title,
      summary: entities.summary,
      content: entities.content,
    })
    .from(entities)
    .innerJoin(
      searchDocuments,
      and(
        eq(searchDocuments.resource, "entity"),
        sql`${searchDocuments.source_id} = ${entities.id}::text`,
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(entities.id))
    .limit(limit);

  return rows.map((row) => ({
    entityId: row.entityId,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
  }));
}
