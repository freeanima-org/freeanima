import type { SemanticFtsHit } from "@freeanima/core/repos";
import { and, asc, eq, getColumns, isNotNull, notLike, sql } from "drizzle-orm";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { formatPgVector } from "../embedding/format.ts";
import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";

export type VectorSemanticHit = SemanticFtsHit & { docKey: string };

export async function searchSemanticMemoryVector(
  queryEmbedding: number[],
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
  },
): Promise<VectorSemanticHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const source_conversations =
    opts?.source_conversations?.map((s) => s.trim()).filter(Boolean) ?? [];
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${semanticMemory.content_embedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(semanticMemory.content_embedding),
    ...buildSemanticConditions({ types, status, source_conversations }),
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
    ...r,
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
  opts?: { conversation_id?: string; limit?: number },
): Promise<VectorMessageHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const conversation_id = opts?.conversation_id?.trim() || null;
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${messages.content_embedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(messages.content_embedding),
    isNotNull(messages.content_fts),
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
