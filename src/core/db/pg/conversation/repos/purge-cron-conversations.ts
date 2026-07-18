import { and, eq, inArray, sql } from "drizzle-orm";
import {
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  SEMANTIC_MEMORY_COMPONENT,
} from "@freeanima/core/db/schema/entity";
import { entities, conversations } from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";
import { pgTextArray } from "../../utils/pg-sql.ts";
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
  if (ids.length === 0) return { deleted: 0, ids: [] };

  const idSet = new Set<string>(ids);
  const db = getDb();

  await db
    .delete(entities)
    .where(
      and(
        sql`${entities.components} @> ARRAY[${LIMBIC_COMPONENT}]::text[]`,
        sql`${entities.body}->>'conversation_id' = ANY(${pgTextArray(ids)})`,
      ),
    );

  const semanticRows = await db
    .select({ id: entities.id, body: entities.body })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
        sql`(${entities.body}->'source_conversations') ?| ${pgTextArray(ids)}`,
      ),
    );
  for (const row of semanticRows) {
    const body = (row.body ?? {}) as Record<string, unknown>;
    const raw = body.source_conversations;
    const convs = Array.isArray(raw) ? raw.map(String) : [];
    const next = stripIdsFromArray(convs, idSet);
    if (next.length === convs.length) continue;
    await db
      .update(entities)
      .set({
        body: sql`${entities.body} || ${JSON.stringify({ source_conversations: next })}::jsonb`,
      })
      .where(eq(entities.id, row.id));
  }

  const narrativeRows = await db
    .select({ id: entities.id, body: entities.body })
    .from(entities)
    .where(
      and(
        sql`${entities.components} @> ARRAY[${NARRATIVE_COMPONENT}]::text[]`,
        sql`(${entities.body}->'source_conversations') ?| ${pgTextArray(ids)}`,
      ),
    );
  for (const row of narrativeRows) {
    const body = (row.body ?? {}) as Record<string, unknown>;
    const raw = body.source_conversations;
    const convs = Array.isArray(raw) ? raw.map(String) : [];
    const next = stripIdsFromArray(convs, idSet);
    if (next.length === convs.length) continue;
    await db
      .update(entities)
      .set({
        body: sql`${entities.body} || ${JSON.stringify({ source_conversations: next })}::jsonb`,
      })
      .where(eq(entities.id, row.id));
  }

  const deletedRows = await db
    .delete(conversations)
    .where(inArray(conversations.id, ids))
    .returning({ id: conversations.id });

  return { deleted: deletedRows.length, ids: deletedRows.map((r: { id: string }) => r.id) };
}
