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
    sourceSessions?: string[];
  },
): Promise<VectorSemanticHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${semanticMemory.contentEmbedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(semanticMemory.contentEmbedding),
    ...buildSemanticConditions({ types, status, sourceSessions }),
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
  session_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesVector(
  queryEmbedding: number[],
  opts?: { sessionId?: string; limit?: number },
): Promise<VectorMessageHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const sessionId = opts?.sessionId?.trim() || null;
  const queryVec = formatPgVector(queryEmbedding);

  const db = getDb();
  const distanceExpr = sql`${messages.contentEmbedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");
  const conditions = [
    isNotNull(messages.contentEmbedding),
    isNotNull(messages.contentFts),
    notLike(messages.sessionId, "debug-%"),
  ];
  if (sessionId) {
    conditions.push(eq(messages.sessionId, sessionId));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: sql<string>`${messages.payload}->>'content'`,
      role: sql<string>`${messages.payload}->>'role'`,
      session_id: messages.sessionId,
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
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    docKey: messageDocKey(r.id),
    rank: Number(r.rank),
  }));
}
