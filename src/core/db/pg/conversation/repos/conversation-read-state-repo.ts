import { and, eq, isNull, sql } from "drizzle-orm";
import { conversationReadState, conversations } from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";
import { getMaxMessagePos } from "./message-repo.ts";

const pgNow = (): Date => new Date();

/** 用户视角：是否存在尚未读到的 assistant 消息 */
export function conversationUnreadExistsSql(userSubjectId: string) {
  return sql<boolean>`exists (
    select 1
    from messages m
    left join conversation_read_state rs
      on rs.conversation_id = m.conversation_id
     and rs.subject_id = ${userSubjectId}
    where m.conversation_id = "conversations"."id"
      and (m.payload->>'role') = 'assistant'
      and m.pos > coalesce(rs.last_read_pos, 0)
  )`;
}

/**
 * 将用户已读水位升到 last_read_pos（省略则取当前 max(pos)）。
 * 仅允许单调升高（不会因旧客户端回退水位）。
 */
export async function markConversationRead(opts: {
  conversation_id: string;
  subject_id: string;
  last_read_pos?: number;
}): Promise<{ last_read_pos: number }> {
  const conversation_id = opts.conversation_id.trim();
  const subject_id = opts.subject_id.trim();
  if (!conversation_id) throw new Error("conversation_id is required");
  if (!subject_id) throw new Error("subject_id is required");

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

/** 用户未归档且未读的会话个数（Shell 角标） */
export async function countUnreadConversations(userSubjectId: string): Promise<number> {
  const subject_id = userSubjectId.trim();
  if (!subject_id) return 0;
  const db = getDb();
  const unread = conversationUnreadExistsSql(subject_id);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(isNull(conversations.archived_at), sql`${unread}`));
  return rows[0]?.count ?? 0;
}

export async function getConversationLastReadPos(
  conversation_id: string,
  subject_id: string,
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
