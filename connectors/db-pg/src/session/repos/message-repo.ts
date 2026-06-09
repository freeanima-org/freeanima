import { and, eq, sql } from "drizzle-orm";
import type { ConversationMessage, SessionMessage } from "@freeanima/engine-db/domain";

import { messages } from "@freeanima/engine-db/schema";

import { getDb } from "../../client.ts";
import {
  countMessagesForSession,
  lastMessageTimestamp as readLastMessageTimestamp,
  maxMessagePos,
  selectMessageBySessionPos,
  selectMessagesByPosRange,
  selectMessagesBySessionId,
  selectMessagesPage,
} from "../../utils/sql-read.ts";
import { messageToInsert, rowToMessage } from "../mappers/message-mapper.ts";

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

  const rows = await selectMessageBySessionPos(sessionId, insert.pos);
  if (!rows.length) {
    throw new Error(`messages 写入后未找到行: session=${sessionId} pos=${insert.pos}`);
  }
  return rowToMessage(rows[0]!);
}

export async function nextMessagePos(sessionId: string): Promise<number> {
  return (await maxMessagePos(sessionId)) + 1;
}

export async function listMessages(sessionId: string): Promise<ConversationMessage[]> {
  const rows = await selectMessagesBySessionId(sessionId);
  return rows.map((r) => rowToMessage(r));
}

export async function listMessagesByPosRange(
  sessionId: string,
  fromPos: number,
  toPos?: number,
): Promise<ConversationMessage[]> {
  const rows = await selectMessagesByPosRange(sessionId, fromPos, toPos);
  return rows.map((r) => rowToMessage(r));
}

export async function countMessages(sessionId: string): Promise<number> {
  return countMessagesForSession(sessionId);
}

/** API / 历史分页：按 pos 顺序切片，避免全量 listMessages */
export async function listMessagesPage(
  sessionId: string,
  offset: number,
  limit: number,
): Promise<ConversationMessage[]> {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const rows = await selectMessagesPage(sessionId, safeOffset, safeLimit);
  return rows.map((r) => rowToMessage(r));
}

/** 最近一条消息时间戳（避免 listMessages 全量加载） */
export async function lastMessageTimestamp(sessionId: string): Promise<string | null> {
  return readLastMessageTimestamp(sessionId);
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
    const order = delta > 0 ? sql`DESC` : sql`ASC`;
    const rows = await tx.execute<{ id: string; pos: number }>(sql`
      SELECT id, pos::int AS pos
      FROM messages
      WHERE session_id = ${sessionId} AND pos > ${afterPos}
      ORDER BY pos ${order}
    `);
    for (const row of rows) {
      await tx
        .update(messages)
        .set({ pos: row.pos + delta })
        .where(eq(messages.id, row.id));
    }
  });
}
