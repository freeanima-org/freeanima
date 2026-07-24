import type { SemanticFtsHit } from "@freeanima/host/core/db/schema/rows";
import type { EntityRow } from "@freeanima/host/core/db/schema/entity";
import { and, desc, eq, isNotNull, notLike, sql } from "drizzle-orm";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/host/core/config";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/host/core/util";
import { entities, messages } from "@freeanima/host/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { entityToSemanticMemoryRow } from "../semantic-memory/map-row.ts";

export type TrgmSemanticHit = SemanticFtsHit & { docKey: string };

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
} as const;

export async function searchSemanticMemoryTrgm(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
  },
): Promise<TrgmSemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const source_conversations =
    opts?.source_conversations?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const rankExpr = sql<number>`similarity(${entities.content}, ${q})`.as("rank");
  const conditions = [
    sql`word_similarity(${entities.content}, ${q}) >= ${minSim}`,
    ...buildSemanticConditions({ types, status, source_conversations }),
  ];

  const rows = await db
    .select({
      ...semanticSelect,
      rank: rankExpr,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => {
    const entityRow: EntityRow = {
      id: r.id,
      type: r.type as EntityRow["type"],
      world_id: r.world_id,
      components: [...r.components],
      primary_component: r.primary_component,
      title: r.title ?? "",
      summary: r.summary ?? "",
      content: r.content ?? "",
      body: (r.body ?? {}) as Record<string, unknown>,
      pinned: r.pinned ?? false,
      reference_count: r.reference_count ?? 0,
      tag_ids: [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
    const mapped = entityToSemanticMemoryRow(entityRow);
    return {
      ...mapped,
      docKey: semanticMemoryDocKey(mapped.id),
      rank: Number(r.rank),
    };
  });
}

export type TrgmMessageHit = {
  id: string;
  content: string;
  role: string;
  conversation_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesTrgm(
  query: string,
  opts?: { conversation_id?: string; limit?: number },
): Promise<TrgmMessageHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
  const conversation_id = opts?.conversation_id?.trim() || null;
  const msgContent = sql<string>`${messages.payload}->>'content'`;

  const db = getDb();
  const rankExpr = sql<number>`similarity(${msgContent}, ${q})`.as("rank");
  // `<%` + word_similarity_threshold 可走 idx_messages_content_trgm（gin_trgm_ops）
  const conditions = [
    isNotNull(messages.content_fts),
    sql`set_config('pg_trgm.word_similarity_threshold', ${String(minSim)}, true) IS NOT NULL`,
    sql`${msgContent} <% ${q}`,
    notLike(messages.conversation_id, "debug-%"),
  ];
  if (conversation_id) {
    conditions.push(eq(messages.conversation_id, conversation_id));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: msgContent,
      role: sql<string>`${messages.payload}->>'role'`,
      conversation_id: messages.conversation_id,
      timestamp: sql<string>`${messages.payload}->>'timestamp'`,
      rank: rankExpr,
    })
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    conversation_id: r.conversation_id,
    timestamp: r.timestamp ?? "",
    docKey: messageDocKey(r.id),
    rank: Number(r.rank),
  }));
}
