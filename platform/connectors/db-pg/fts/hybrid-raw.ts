import { and, desc, eq, getColumns, notLike, sql } from "drizzle-orm";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import {
  mapSemanticMemoryRow,
  type SemanticMemoryFtsDbRow,
} from "../semantic-memory/mappers/semantic-mapper.ts";
import { buildFtsTsQuery } from "./query.ts";

export async function searchSemanticMemoryFtsRaw(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceSessions?: string[];
  },
): Promise<SemanticMemoryFtsDbRow[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${semanticMemory.contentFts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const conditions = [
    sql`${semanticMemory.contentFts} @@ ${tsqueryExpr}`,
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

  return rows.map((r) => ({ ...mapSemanticMemoryRow(r), rank: Number(r.rank) }));
}

export async function searchMessagesFtsRaw(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<
  Array<{
    id: string;
    content: string;
    role: string;
    session_id: string;
    timestamp: string;
    rank: number;
  }>
> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const sessionId = opts?.sessionId?.trim() || null;

  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${messages.contentFts}, ${tsqueryExpr}, 32)`.as("rank");
  const conditions = [
    sql`${messages.contentFts} @@ ${tsqueryExpr}`,
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
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    rank: Number(r.rank),
  }));
}
