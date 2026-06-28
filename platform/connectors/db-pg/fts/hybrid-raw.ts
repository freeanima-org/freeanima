import type { SemanticFtsHit } from "@freeanima/core/repos";
import { and, desc, eq, getColumns, notLike, sql } from "drizzle-orm";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { mapSemanticMemoryRow } from "../semantic-memory/mappers/semantic-mapper.ts";
import { buildFtsTsQuery } from "./query.ts";

export async function searchSemanticMemoryFtsRaw(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
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
  const rankExpr = sql<number>`ts_rank_cd(${semanticMemory.content_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );
  const conditions = [
    sql`${semanticMemory.content_fts} @@ ${tsqueryExpr}`,
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

  return rows.map((r) => ({ ...mapSemanticMemoryRow(r), rank: Number(r.rank) }));
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
  const rankExpr = sql<number>`ts_rank_cd(${messages.content_fts}, ${tsqueryExpr}, 32)`.as("rank");
  const conditions = [
    sql`${messages.content_fts} @@ ${tsqueryExpr}`,
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
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    conversation_id: r.conversation_id,
    timestamp: r.timestamp ?? "",
    rank: Number(r.rank),
  }));
}
