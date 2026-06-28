import { arrayOverlaps, eq, inArray } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  semanticMemory,
  conversations,
} from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";
import { listCronSessionIds } from "./conversation-repo.ts";

export type PurgeCronConversationsResult = {
  deleted: number;
  ids: string[];
  skipped?: string;
};

function stripIdsFromArray(values: string[], remove: ReadonlySet<string>): string[] {
  return values.filter((id) => !remove.has(id));
}

/**
 * 一次性清理历史 cron agent 创建的 sessions（platform_info.platform = cron）。
 * 应在不再产生 cron conversation 且睡眠周期 conversation-cleanup 步骤中调用。
 */
export async function purgeCronConversations(): Promise<PurgeCronConversationsResult> {
  const ids = await listCronSessionIds();
  if (!ids.length) return { deleted: 0, ids: [] };

  const idSet = new Set<string>(ids);
  const db = getDb();

  await db.delete(limbicMemory).where(inArray(limbicMemory.conversation_id, ids));

  const semanticRows = await db
    .select({ id: semanticMemory.id, source_conversations: semanticMemory.source_conversations })
    .from(semanticMemory)
    .where(arrayOverlaps(semanticMemory.source_conversations, ids));
  for (const row of semanticRows) {
    const next = stripIdsFromArray(row.source_conversations ?? [], idSet);
    if (next.length === (row.source_conversations ?? []).length) continue;
    await db
      .update(semanticMemory)
      .set({ source_conversations: next })
      .where(eq(semanticMemory.id, row.id));
  }

  const autoRows = await db
    .select({
      id: autobiographicalMemory.id,
      source_conversations: autobiographicalMemory.source_conversations,
    })
    .from(autobiographicalMemory)
    .where(arrayOverlaps(autobiographicalMemory.source_conversations, ids));
  for (const row of autoRows) {
    const next = stripIdsFromArray(row.source_conversations ?? [], idSet);
    if (next.length === (row.source_conversations ?? []).length) continue;
    await db
      .update(autobiographicalMemory)
      .set({ source_conversations: next })
      .where(eq(autobiographicalMemory.id, row.id));
  }

  const deletedRows = await db
    .delete(conversations)
    .where(inArray(conversations.id, ids))
    .returning({ id: conversations.id });

  return { deleted: deletedRows.length, ids: deletedRows.map((r: { id: string }) => r.id) };
}
