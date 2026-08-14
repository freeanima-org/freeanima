import { and, notLike, sql } from "drizzle-orm";
import { messages, searchDocuments } from "@freeanima/habitat/core/db/schema";
import type { MessageFtsHit } from "../types.ts";

import { getDb } from "../../client.ts";
import { hybridSearchMessages } from "../../fts/hybrid-search.ts";
import { messageSearchDocumentsJoin } from "../../search/pg-search-index/channel-fts.ts";

export async function searchMessagesFts(
  query: string,
  opts?: { conversation_id?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  return hybridSearchMessages(query, opts);
}

export async function countSearchableMessages(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(searchDocuments, messageSearchDocumentsJoin())
    .where(
      and(
        sql`${searchDocuments.search_fts} IS NOT NULL`,
        notLike(messages.conversation_id, "debug-%"),
      ),
    );
  return rows[0]?.n ?? 0;
}
