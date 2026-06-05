import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { ConversationMessage, SessionMessage } from "@freeanima/legacy-kernel";

import { getDb } from "../client.ts";
import { messageToInsert, rowToMessage } from "../mappers/message-mapper.ts";
import { messages } from "../schema/messages.ts";

export async function appendMessage(
  sessionId: string,
  msg: SessionMessage,
): Promise<ConversationMessage> {
  const db = getDb();
  const insert = messageToInsert(sessionId, msg);
  const inserted = await db
    .insert(messages)
    .values(insert)
    .onConflictDoNothing({ target: [messages.sessionId, messages.pos] })
    .returning();
  if (inserted.length) {
    return rowToMessage(inserted[0]!);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.pos, insert.pos)))
    .limit(1);
  if (!rows.length) {
    throw new Error(`messages 写入后未找到行: session=${sessionId} pos=${insert.pos}`);
  }
  return rowToMessage(rows[0]!);
}

export async function nextMessagePos(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ maxPos: sql<number>`coalesce(max(${messages.pos}), 0)` })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  return Number(rows[0]?.maxPos ?? 0) + 1;
}

export async function listMessages(sessionId: string): Promise<ConversationMessage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.pos));
  return rows.map((r) => rowToMessage(r));
}

export async function listMessagesByPosRange(
  sessionId: string,
  fromPos: number,
  toPos?: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const conditions = [eq(messages.sessionId, sessionId), gte(messages.pos, fromPos)];
  if (toPos !== undefined) {
    conditions.push(lte(messages.pos, toPos));
  }
  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.pos));
  return rows.map((r) => rowToMessage(r));
}

export async function countMessages(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  return Number(rows[0]?.count ?? 0);
}

/** API / 历史分页：按 pos 顺序切片，避免全量 listMessages */
export async function listMessagesPage(
  sessionId: string,
  offset: number,
  limit: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.pos))
    .offset(safeOffset)
    .limit(safeLimit);
  return rows.map((r) => rowToMessage(r));
}

/** 最近一条消息时间戳（避免 listMessages 全量加载） */
export async function lastMessageTimestamp(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      ts: sql<string | null>`max((${messages.payload}->>'timestamp')::timestamptz)::text`,
    })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  return rows[0]?.ts ?? null;
}

export async function truncateMessagesAfter(
  sessionId: string,
  keepThroughPos: number,
): Promise<void> {
  const db = getDb();
  await db
    .delete(messages)
    .where(and(eq(messages.sessionId, sessionId), sql`${messages.pos} > ${keepThroughPos}`));
}

/**
 * 将会话内 pos > afterPos 的消息序号整体平移 delta（避免 unique 冲突：正 delta 从高到低，负 delta 从低到高）。
 */
export async function shiftMessagePositions(
  sessionId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: messages.id, pos: messages.pos })
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), sql`${messages.pos} > ${afterPos}`))
      .orderBy(delta > 0 ? desc(messages.pos) : asc(messages.pos));
    for (const row of rows) {
      await tx
        .update(messages)
        .set({ pos: row.pos + delta })
        .where(eq(messages.id, row.id));
    }
  });
}
