import { and, desc, eq, getColumns, isNotNull, notLike, sql } from "drizzle-orm";
import { getActiveConfig, getFtsTrgmMinSimilarity } from "@freeanima/platform/config";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import {
  mapSemanticMemoryRow,
  type SemanticMemoryFtsDbRow,
} from "../semantic-memory/mappers/semantic-mapper.ts";

export type TrgmSemanticHit = SemanticMemoryFtsDbRow & { docKey: string };

export async function searchSemanticMemoryTrgm(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceConversations?: string[];
  },
): Promise<TrgmSemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceConversations = opts?.sourceConversations?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const rankExpr = sql<number>`similarity(${semanticMemory.content}, ${q})`.as("rank");
  const conditions = [
    sql`word_similarity(${semanticMemory.content}, ${q}) >= ${minSim}`,
    ...buildSemanticConditions({ types, status, sourceConversations }),
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
    ...mapSemanticMemoryRow(r),
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
  opts?: { conversationId?: string; limit?: number },
): Promise<TrgmMessageHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const conversationId = opts?.conversationId?.trim() || null;
  const msgContent = sql<string>`${messages.payload}->>'content'`;

  const db = getDb();
  const rankExpr = sql<number>`similarity(${msgContent}, ${q})`.as("rank");
  const conditions = [
    isNotNull(messages.contentFts),
    sql`word_similarity(${msgContent}, ${q}) >= ${minSim}`,
    notLike(messages.conversationId, "debug-%"),
  ];
  if (conversationId) {
    conditions.push(eq(messages.conversationId, conversationId));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: msgContent,
      role: sql<string>`${messages.payload}->>'role'`,
      conversation_id: messages.conversationId,
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
