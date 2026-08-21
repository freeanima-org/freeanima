import { asRecord } from "@freeanima/shared/util";
import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import { and, asc, sql } from "drizzle-orm";
import { entities, searchDocuments } from "@freeanima/habitat/core/db/schema";
import { omitUndefined, semanticMemoryDocKey } from "@freeanima/habitat/core/util";

import { getDb } from "../client.ts";
import { embedQueryText } from "../embedding/query.ts";
import { formatPgVector } from "../embedding/format.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { entityToSemanticMemoryRow } from "../semantic-memory/map-row.ts";
import { entitySearchDocumentsJoin } from "../search/pg-search-index/channel-fts.ts";

export type VectorSemanticHit = SemanticFtsHit & { docKey: string };

const semanticSelect = {
  id: entities.id,
  type: entities.type,
  world_id: entities.world_id,
  components: entities.components,
  primary_component: entities.primary_component,
  title: entities.title,
  summary: entities.summary,
  content: entities.content,
  body: entities.body,
  pinned: entities.pinned,
  reference_count: entities.reference_count,
  created_at: entities.created_at,
  updated_at: entities.updated_at,
  cluster_id: searchDocuments.cluster_id,
} as const;

/**
 * Semantic-memory vector channel over `search_documents.embedding`.
 * Embeds the full natural-language query (do not pass content-word bags).
 * Fail-open: returns [] when embedding is unavailable / times out.
 */
export async function searchSemanticMemoryVector(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
    cluster_id?: number | null;
  },
): Promise<VectorSemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const embedding = await embedQueryText(q);
  if (!embedding || embedding.length === 0) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const source_conversations =
    opts?.source_conversations?.map((s) => s.trim()).filter(Boolean) ?? [];

  const vecLiteral = formatPgVector(embedding);
  const db = getDb();
  // Cosine distance: lower is closer; invert for rank-friendly higher-is-better score.
  const distanceExpr = sql<number>`(${searchDocuments.embedding} <=> ${vecLiteral}::vector)`;
  const rankExpr = sql<number>`(1 - (${searchDocuments.embedding} <=> ${vecLiteral}::vector))`.as(
    "rank",
  );
  const conditions = [
    sql`${searchDocuments.embedding} IS NOT NULL`,
    ...buildSemanticConditions(
      omitUndefined({
        types,
        status,
        source_conversations,
        cluster_id: opts?.cluster_id,
      }),
    ),
  ];

  const rows = await db
    .select({
      ...semanticSelect,
      rank: rankExpr,
    })
    .from(entities)
    .innerJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(and(...conditions))
    .orderBy(asc(distanceExpr))
    .limit(limit);

  return rows.map((r) => {
    const entityRow: EntityRow = {
      id: r.id,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- PG text → EntityRow.type
      type: r.type as EntityRow["type"],
      world_id: r.world_id,
      components: [...r.components],
      primary_component: r.primary_component,
      title: r.title ?? "",
      summary: r.summary ?? "",
      content: r.content ?? "",
      body: asRecord(r.body) ?? {},
      pinned: r.pinned ?? false,
      reference_count: r.reference_count ?? 0,
      tag_ids: [],
      revisions: [],
      deleted_at: null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
    const mapped = entityToSemanticMemoryRow(entityRow);
    return {
      ...mapped,
      docKey: semanticMemoryDocKey(mapped.id),
      rank: r.rank,
      cluster_id: r.cluster_id ?? null,
    };
  });
}
