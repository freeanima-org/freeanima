import { and, isNotNull, notLike, sql } from "drizzle-orm";
import { messages } from "@freeanima/core/db/schema";
import type { MessageFtsHit } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { hybridSearchMessages } from "../../fts/hybrid-search.ts";

export async function searchMessagesFts(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  return hybridSearchMessages(query, opts);
}

export async function countSearchableMessages(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(isNotNull(messages.contentFts), notLike(messages.sessionId, "debug-%")));
  return Number(rows[0]?.n ?? 0);
}
