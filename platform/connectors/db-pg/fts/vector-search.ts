import { and, asc, eq, getColumns, isNotNull, notLike, sql } from "drizzle-orm";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { formatPgVector } from "../embedding/format.ts";
import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import {
  mapSemanticMemoryRow,
  type SemanticMemoryFtsDbRow,
} from "../semantic-memory/mappers/semantic-mapper.ts";

export type VectorSemanticHit = SemanticMemoryFtsDbRow & { docKey: string };

export async function searchSemanticMemoryVector(
  queryEmbedding: number[],
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceConversations?: string[];
  },
): Promise<VectorSemanticHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceConversations = opts?.sourceConversations?.map((s) => s.trim()).filter(Boolean) ?? [];
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${semanticMemory.contentEmbedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(semanticMemory.contentEmbedding),
    ...buildSemanticConditions({ types, status, sourceConversations }),
  ];

  const rows = await db
    .select({
      ...getColumns(semanticMemory),
      rank: rankExpr,
    })
    .from(semanticMemory)
    .where(and(...conditions))
    .orderBy(asc(distanceExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    docKey: semanticMemoryDocKey(r.id),
    rank: Number(r.rank),
  }));
}

export type VectorMessageHit = {
  id: string;
  content: string;
  role: string;
  conversation_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesVector(
  queryEmbedding: number[],
  opts?: { conversationId?: string; limit?: number },
): Promise<VectorMessageHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const conversationId = opts?.conversationId?.trim() || null;
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${messages.contentEmbedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(messages.contentEmbedding),
    isNotNull(messages.contentFts),
    notLike(messages.conversationId, "debug-%"),
  ];
  if (conversationId) {
    conditions.push(eq(messages.conversationId, conversationId));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: sql<string>`${messages.payload}->>'content'`,
      role: sql<string>`${messages.payload}->>'role'`,
      conversation_id: messages.conversationId,
      timestamp: sql<string>`${messages.payload}->>'timestamp'`,
      rank: rankExpr,
    })
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(distanceExpr))
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
