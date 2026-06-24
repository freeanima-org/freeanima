import { arrayOverlaps, eq, inArray } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  semanticMemory,
  conversations,
} from "@freeanima/core/db/schema";
import type { PgRepositories } from "@freeanima/core/repos";

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
export async function purgeCronConversations(
  repos: PgRepositories,
): Promise<PurgeCronConversationsResult> {
  if (!repos.pgAvailable) return { deleted: 0, ids: [] };

  const ids = await listCronSessionIds();
  if (!ids.length) return { deleted: 0, ids: [] };

  const idSet = new Set(ids);
  const db = getDb();

  await db.delete(limbicMemory).where(inArray(limbicMemory.conversationId, ids));

  const semanticRows = await db
    .select({ id: semanticMemory.id, sourceConversations: semanticMemory.sourceConversations })
    .from(semanticMemory)
    .where(arrayOverlaps(semanticMemory.sourceConversations, ids));
  for (const row of semanticRows) {
    const next = stripIdsFromArray(row.sourceConversations ?? [], idSet);
    if (next.length === (row.sourceConversations ?? []).length) continue;
    await db
      .update(semanticMemory)
      .set({ sourceConversations: next })
      .where(eq(semanticMemory.id, row.id));
  }

  const autoRows = await db
    .select({
      id: autobiographicalMemory.id,
      sourceConversations: autobiographicalMemory.sourceConversations,
    })
    .from(autobiographicalMemory)
    .where(arrayOverlaps(autobiographicalMemory.sourceConversations, ids));
  for (const row of autoRows) {
    const next = stripIdsFromArray(row.sourceConversations ?? [], idSet);
    if (next.length === (row.sourceConversations ?? []).length) continue;
    await db
      .update(autobiographicalMemory)
      .set({ sourceConversations: next })
      .where(eq(autobiographicalMemory.id, row.id));
  }

  const deletedRows = await db
    .delete(conversations)
    .where(inArray(conversations.id, ids))
    .returning({ id: conversations.id });

  return { deleted: deletedRows.length, ids: deletedRows.map((r) => r.id) };
}
