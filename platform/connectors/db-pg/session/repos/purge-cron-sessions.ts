import { arrayOverlaps, eq, inArray } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  semanticMemory,
  sessions,
} from "@freeanima/core/db/schema";
import type { PgRepositories } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { listCronSessionIds } from "./session-repo.ts";

export type PurgeCronSessionsResult = {
  deleted: number;
  ids: string[];
  skipped?: string;
};

function stripIdsFromArray(values: string[], remove: ReadonlySet<string>): string[] {
  return values.filter((id) => !remove.has(id));
}

/**
 * 一次性清理历史 cron agent 创建的 sessions（platform_info.platform = cron）。
 * 应在不再产生 cron session 且睡眠周期 session-cleanup 步骤中调用。
 */
export async function purgeCronSessions(repos: PgRepositories): Promise<PurgeCronSessionsResult> {
  if (!repos.pgAvailable) return { deleted: 0, ids: [] };

  const ids = await listCronSessionIds();
  if (!ids.length) return { deleted: 0, ids: [] };

  const idSet = new Set(ids);
  const db = getDb();

  await db.delete(limbicMemory).where(inArray(limbicMemory.sessionId, ids));

  const semanticRows = await db
    .select({ id: semanticMemory.id, sourceSessions: semanticMemory.sourceSessions })
    .from(semanticMemory)
    .where(arrayOverlaps(semanticMemory.sourceSessions, ids));
  for (const row of semanticRows) {
    const next = stripIdsFromArray(row.sourceSessions ?? [], idSet);
    if (next.length === (row.sourceSessions ?? []).length) continue;
    await db
      .update(semanticMemory)
      .set({ sourceSessions: next })
      .where(eq(semanticMemory.id, row.id));
  }

  const autoRows = await db
    .select({
      id: autobiographicalMemory.id,
      sourceSessions: autobiographicalMemory.sourceSessions,
    })
    .from(autobiographicalMemory)
    .where(arrayOverlaps(autobiographicalMemory.sourceSessions, ids));
  for (const row of autoRows) {
    const next = stripIdsFromArray(row.sourceSessions ?? [], idSet);
    if (next.length === (row.sourceSessions ?? []).length) continue;
    await db
      .update(autobiographicalMemory)
      .set({ sourceSessions: next })
      .where(eq(autobiographicalMemory.id, row.id));
  }

  const deletedRows = await db
    .delete(sessions)
    .where(inArray(sessions.id, ids))
    .returning({ id: sessions.id });

  return { deleted: deletedRows.length, ids: deletedRows.map((r) => r.id) };
}
