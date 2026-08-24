import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { conversationReadState, conversations, messages } from "@freeanima/habitat/core/db/schema";

import { getDb } from "../../client.ts";
import { getMaxMessagePos } from "./message-repo.ts";

const pgNow = (): Date => new Date();

/**
 * 将用户已读水位升到 last_read_pos（省略则取当前 max(pos)）。
 * 仅允许单调升高（不会因旧客户端回退水位）。
 */
export async function markConversationRead(opts: {
  conversation_id: string;
  subject_id: number;
  last_read_pos?: number;
}): Promise<{ last_read_pos: number }> {
  const conversation_id = opts.conversation_id.trim();
  const subject_id = opts.subject_id;
  if (!conversation_id) throw new Error("conversation_id is required");
  if (!Number.isFinite(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }

  const targetPos =
    opts.last_read_pos != null
      ? Math.max(0, Math.floor(opts.last_read_pos))
      : await getMaxMessagePos(conversation_id);

  const now = pgNow();
  const db = getDb();
  await db
    .insert(conversationReadState)
    .values({
      conversation_id,
      subject_id,
      last_read_pos: targetPos,
      read_at: now,
    })
    .onConflictDoUpdate({
      target: [conversationReadState.conversation_id, conversationReadState.subject_id],
      set: {
        last_read_pos: sql`greatest(${conversationReadState.last_read_pos}, ${targetPos})`,
        read_at: now,
      },
    });

  const rows = await db
    .select({ last_read_pos: conversationReadState.last_read_pos })
    .from(conversationReadState)
    .where(
      and(
        eq(conversationReadState.conversation_id, conversation_id),
        eq(conversationReadState.subject_id, subject_id),
      ),
    )
    .limit(1);
  return { last_read_pos: rows[0]?.last_read_pos ?? targetPos };
}

/**
 * 对本页会话 id 批量判定未读（用户视角：存在尚未读到的 assistant 消息）。
 * 一次查询替代列表 SELECT 上的相关 EXISTS。
 */
export async function listUnreadConversationIds(
  userSubjectId: number,
  conversationIds: string[],
): Promise<Set<string>> {
  if (!Number.isFinite(userSubjectId) || userSubjectId <= 0 || conversationIds.length === 0) {
    return new Set();
  }
  const db = getDb();
  const rows = await db
    .selectDistinct({ conversation_id: messages.conversation_id })
    .from(messages)
    .leftJoin(
      conversationReadState,
      and(
        eq(conversationReadState.conversation_id, messages.conversation_id),
        eq(conversationReadState.subject_id, userSubjectId),
      ),
    )
    .where(
      and(
        inArray(messages.conversation_id, conversationIds),
        sql`(${messages.payload}->>'role') = 'assistant'`,
        sql`${messages.pos} > coalesce(${conversationReadState.last_read_pos}, 0)`,
      ),
    );
  return new Set(rows.map((r) => r.conversation_id));
}

/** 用户未归档且未读的会话个数（Shell 角标；可选按 platform 与列表对齐） */
export async function countUnreadConversations(
  userSubjectId: number,
  opts?: { platform?: string },
): Promise<number> {
  if (!Number.isFinite(userSubjectId) || userSubjectId <= 0) return 0;
  const db = getDb();
  const platform = opts?.platform?.trim();
  const conds = [
    isNull(conversations.archived_at),
    sql`(${messages.payload}->>'role') = 'assistant'`,
    sql`${messages.pos} > coalesce(${conversationReadState.last_read_pos}, 0)`,
  ];
  if (platform) {
    conds.push(sql`${conversations.platform_info}->>'platform' = ${platform}`);
  }
  const rows = await db
    .select({ count: sql<number>`count(distinct ${conversations.id})::int` })
    .from(conversations)
    .innerJoin(messages, eq(messages.conversation_id, conversations.id))
    .leftJoin(
      conversationReadState,
      and(
        eq(conversationReadState.conversation_id, messages.conversation_id),
        eq(conversationReadState.subject_id, userSubjectId),
      ),
    )
    .where(and(...conds));
  return rows[0]?.count ?? 0;
}

export async function getConversationLastReadPos(
  conversation_id: string,
  subject_id: number,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ last_read_pos: conversationReadState.last_read_pos })
    .from(conversationReadState)
    .where(
      and(
        eq(conversationReadState.conversation_id, conversation_id),
        eq(conversationReadState.subject_id, subject_id),
      ),
    )
    .limit(1);
  return rows[0]?.last_read_pos ?? 0;
}
