import { sql as drizzleSql } from "drizzle-orm";
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
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM messages
    WHERE content_fts IS NOT NULL
      AND NOT session_id LIKE 'debug-%'
  `);
  return Number(rows[0]?.n ?? 0);
}
