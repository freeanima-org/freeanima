import { asRecord } from "@freeanima/shared/util";
import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import { and, desc, eq, notLike, sql } from "drizzle-orm";
import { entities, messages, searchDocuments } from "@freeanima/habitat/core/db/schema";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { entityToSemanticMemoryRow } from "../semantic-memory/map-row.ts";
import { buildFtsTsQuery } from "./query.ts";
import {
  entitySearchDocumentsJoin,
  messageSearchDocumentsJoin,
} from "../search/pg-search-index/channel-fts.ts";

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

function mapHit(row: {
  id: number;
  type: string;
  world_id: number;
  components: string[];
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  body: unknown;
  pinned: boolean;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  rank: number;
  cluster_id: number | null;
}): SemanticFtsHit {
  const entityRow: EntityRow = {
    id: row.id,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- PG text → EntityRow.type
    type: row.type as EntityRow["type"],
    world_id: row.world_id,
    components: [...row.components],
    primary_component: row.primary_component,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: asRecord(row.body) ?? {},
    pinned: row.pinned ?? false,
    reference_count: row.reference_count ?? 0,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return {
    ...entityToSemanticMemoryRow(entityRow),
    rank: row.rank,
    cluster_id: row.cluster_id ?? null,
  };
}

export async function searchSemanticMemoryFtsRaw(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
    cluster_id?: number | null;
    world_id?: number;
  },
): Promise<SemanticFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const source_conversations =
    opts?.source_conversations?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const conditions = [
    sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
    ...buildSemanticConditions(
      omitUndefined({
        types,
        status,
        source_conversations,
        cluster_id: opts?.cluster_id,
        world_id: opts?.world_id,
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
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map(mapHit);
}

export async function searchMessagesFtsRaw(
  query: string,
  opts?: { conversation_id?: string; limit?: number },
): Promise<
  Array<{
    id: string;
    content: string;
    role: string;
    conversation_id: string;
    timestamp: string;
    rank: number;
  }>
> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const conversation_id = opts?.conversation_id?.trim() || null;

  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${searchDocuments.search_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const conditions = [
    sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
    notLike(messages.conversation_id, "debug-%"),
  ];
  if (conversation_id) {
    conditions.push(eq(messages.conversation_id, conversation_id));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: sql<string>`${messages.payload}->>'content'`,
      role: sql<string>`${messages.payload}->>'role'`,
      conversation_id: messages.conversation_id,
      timestamp: sql<string>`${messages.payload}->>'timestamp'`,
      rank: rankExpr,
    })
    .from(messages)
    .innerJoin(searchDocuments, messageSearchDocumentsJoin())
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    conversation_id: r.conversation_id,
    timestamp: r.timestamp ?? "",
    rank: r.rank,
  }));
}
