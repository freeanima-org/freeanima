import { sql as drizzleSql } from "drizzle-orm";
import type { MessageFtsHit } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { buildFtsTsQuery } from "../../fts/query.ts";

export async function searchMessagesFts(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const sessionId = opts?.sessionId?.trim() || null;

  const db = getDb();
  const rows = await db.execute<{
    content: string;
    role: string;
    session_id: string;
    timestamp: string;
    rank: number;
  }>(drizzleSql`
    SELECT
      m.payload->>'content' AS content,
      m.payload->>'role' AS role,
      m.session_id,
      m.payload->>'timestamp' AS timestamp,
      ts_rank_cd(m.content_fts, q, 32) AS rank
    FROM messages m,
         to_tsquery('simple', ${tsquery}) q
    WHERE m.content_fts @@ q
      AND NOT m.session_id LIKE 'debug-%'
      AND (${sessionId}::text IS NULL OR m.session_id = ${sessionId})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    content: r.content,
    role: r.role,
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    rank: Number(r.rank),
  }));
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
