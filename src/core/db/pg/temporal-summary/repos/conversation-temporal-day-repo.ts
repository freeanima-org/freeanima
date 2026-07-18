import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import {
  conversations,
  temporalDayJsonSchema,
  type TemporalDayJson,
} from "@freeanima/core/db/schema";
import { getDb } from "../../client.ts";

export async function getConversationTemporalDay(
  conversation_id: string,
): Promise<TemporalDayJson | null> {
  const db = getDb();
  const rows = await db
    .select({ temporal_day: conversations.temporal_day })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  const raw = rows[0]?.temporal_day;
  if (raw == null) return null;
  const parsed = temporalDayJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function setConversationTemporalDay(
  conversation_id: string,
  temporal_day: TemporalDayJson,
): Promise<void> {
  const db = getDb();
  const parsed = temporalDayJsonSchema.parse(temporal_day);
  await db
    .update(conversations)
    .set({ temporal_day: parsed, updated_at: new Date() })
    .where(eq(conversations.id, conversation_id));
}

export type ConversationTemporalDayRow = {
  conversation_id: string;
  temporal_day: TemporalDayJson;
};

/** Non-cron conversations with temporal_day for a CST date */
export async function listTemporalDayByCstDate(
  cst_date: string,
  opts?: { exclude_conversation_id?: string },
): Promise<ConversationTemporalDayRow[]> {
  const db = getDb();
  const conditions = [
    isNotNull(conversations.temporal_day),
    sql`${conversations.temporal_day}->>'cst_date' = ${cst_date}`,
    sql`COALESCE(${conversations.platform_info}->>'platform', '') <> 'cron'`,
  ];
  if (opts?.exclude_conversation_id) {
    conditions.push(ne(conversations.id, opts.exclude_conversation_id));
  }
  const rows = await db
    .select({
      conversation_id: conversations.id,
      temporal_day: conversations.temporal_day,
    })
    .from(conversations)
    .where(and(...conditions));
  const out: ConversationTemporalDayRow[] = [];
  for (const row of rows) {
    const parsed = temporalDayJsonSchema.safeParse(row.temporal_day);
    if (!parsed.success) continue;
    out.push({ conversation_id: row.conversation_id, temporal_day: parsed.data });
  }
  return out;
}
