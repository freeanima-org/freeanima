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
    sourceSessions?: string[];
  },
): Promise<TrgmSemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const rankExpr = sql<number>`similarity(${semanticMemory.content}, ${q})`.as("rank");
  const conditions = [
    sql`word_similarity(${semanticMemory.content}, ${q}) >= ${minSim}`,
    ...buildSemanticConditions({ types, status, sourceSessions }),
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
  session_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesTrgm(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<TrgmMessageHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const sessionId = opts?.sessionId?.trim() || null;
  const msgContent = sql<string>`${messages.payload}->>'content'`;

  const db = getDb();
  const rankExpr = sql<number>`similarity(${msgContent}, ${q})`.as("rank");
  const conditions = [
    isNotNull(messages.contentFts),
    sql`word_similarity(${msgContent}, ${q}) >= ${minSim}`,
    notLike(messages.sessionId, "debug-%"),
  ];
  if (sessionId) {
    conditions.push(eq(messages.sessionId, sessionId));
  }

  const rows = await db
    .select({
      id: messages.id,
      content: msgContent,
      role: sql<string>`${messages.payload}->>'role'`,
      session_id: messages.sessionId,
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
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    docKey: messageDocKey(r.id),
    rank: Number(r.rank),
  }));
}
