import type { SemanticFtsHit } from "@freeanima/core/db/schema/rows";
import { and, desc, eq, getColumns, isNotNull, notLike, sql } from "drizzle-orm";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/core/config";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";

export type TrgmSemanticHit = SemanticFtsHit & { docKey: string };

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
  const rankExpr = sql<number>`similarity(${semanticMemory.content}, ${q})`.as("rank");
  const conditions = [
    sql`word_similarity(${semanticMemory.content}, ${q}) >= ${minSim}`,
    ...buildSemanticConditions({ types, status, source_conversations }),
  ];

  const rows = await db
    .select({
      ...getColumns(semanticMemory),
      rank: rankExpr,
    })
    .from(semanticMemory)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    docKey: semanticMemoryDocKey(r.id),
    rank: Number(r.rank),
  }));
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
  const conditions = [
    isNotNull(messages.content_fts),
    sql`word_similarity(${msgContent}, ${q}) >= ${minSim}`,
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
