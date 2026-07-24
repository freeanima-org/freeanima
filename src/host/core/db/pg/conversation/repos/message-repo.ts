import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import type { ConversationMessage, StoredMessage } from "@freeanima/host/core/db/domain";
import type { MessageRowView } from "../types.ts";

import { messages, type MessageSelect } from "@freeanima/host/core/db/schema";
import { omitUndefined } from "@freeanima/host/core/util";

import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { scheduleMessageEmbedding } from "../../embedding/schedule.ts";
import { recordMessageReferences } from "../../memory-reference/repos/memory-reference-repo.ts";
import { isCronSession, touchConversationUpdatedAt } from "./conversation-repo.ts";
import { getDb } from "../../client.ts";
import { messageToInsert, rowToMessage } from "../message-transform.ts";

function extractIndexableContent(payload: { role: string; content?: string | null }): string {
  if (payload.role !== "user" && payload.role !== "assistant") return "";
  return typeof payload.content === "string" ? payload.content.trim() : "";
}

function rowToMessageRowView(row: Pick<MessageSelect, "id" | "pos" | "payload">): MessageRowView {
  const role = row.payload.role ?? "";
  const raw = typeof row.payload.content === "string" ? row.payload.content : "";
  let content = "";
  if (role === "user" || role === "assistant") {
    content = raw;
  } else if (role === "tool") {
    content = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  }
  return {
    message_id: row.id,
    pos: Number(row.pos),
    role,
    content,
    timestamp: typeof row.payload.timestamp === "string" ? row.payload.timestamp : "",
  };
}

export async function appendMessage(
  conversation_id: string,
  msg: StoredMessage,
): Promise<ConversationMessage> {
  const db = getDb();
  const insert = messageToInsert(conversation_id, msg);
  const fts_segmented = await resolveFtsSegmentedForWrite(extractIndexableContent(insert.payload));
  const inserted = await db
    .insert(messages)
    .values({ ...insert, fts_segmented })
    .onConflictDoNothing({ target: [messages.conversation_id, messages.pos] })
    .returning();
  if (inserted.length > 0) {
    const row = inserted[0];
    if (!row) throw new Error(`Row missing after messages insert: session=${conversation_id}`);
    const content = extractIndexableContent(row.payload);
    if (content) {
      scheduleMessageEmbedding(row.id, content);
      const created_at =
        typeof row.payload.timestamp === "string" ? row.payload.timestamp : undefined;
      const skipRefs = await isCronSession(conversation_id);
      await recordMessageReferences(
        omitUndefined({
          message_id: row.id,
          conversation_id: conversation_id,
          content,
          created_at: created_at,
          skip_reference_count: skipRefs,
        }),
      );
    }
    await touchConversationUpdatedAt(conversation_id);
    return rowToMessage(row);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), eq(messages.pos, insert.pos)))
    .limit(1);
  const existingRow = rows[0];
  if (!existingRow) {
    throw new Error(
      `Row not found after messages write: session=${conversation_id} pos=${insert.pos}`,
    );
  }
  return rowToMessage(existingRow);
}

export async function getMessageContentById(
  conversation_id: string,
  message_id: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), eq(messages.id, message_id)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const payload = row.payload;
  if (payload.role !== "assistant" && payload.role !== "user") return null;
  const raw = payload.content;
  return typeof raw === "string" ? raw : null;
}

export async function getMessageContentsByIds(
  conversation_id: string,
  messageIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const db = getDb();
  const rows = await db
    .select({ id: messages.id, payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), inArray(messages.id, uniqueIds)));
  const out: Record<string, string> = {};
  for (const row of rows) {
    const payload = row.payload;
    if (payload.role !== "assistant" && payload.role !== "user") continue;
    const raw = payload.content;
    if (typeof raw === "string" && raw.trim()) {
      out[row.id] = raw;
    }
  }
  return out;
}

export async function appendMessageReturningId(
  conversation_id: string,
  msg: StoredMessage,
): Promise<{ messageId: string }> {
  const out: StoredMessage = { ...msg };
  if (out.pos === undefined && out.role !== "conversation_meta") {
    out.pos = await nextMessagePos(conversation_id);
  }
  const db = getDb();
  const insert = messageToInsert(conversation_id, out);
  const fts_segmented = await resolveFtsSegmentedForWrite(extractIndexableContent(insert.payload));
  const inserted = await db
    .insert(messages)
    .values({ ...insert, fts_segmented })
    .onConflictDoNothing({ target: [messages.conversation_id, messages.pos] })
    .returning();
  if (inserted.length > 0) {
    const insertedRow = inserted[0];
    if (!insertedRow)
      throw new Error(`Row missing after messages insert: session=${conversation_id}`);
    return { messageId: insertedRow.id };
  }

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), eq(messages.pos, insert.pos)))
    .limit(1);
  const idRow = rows[0];
  if (!idRow) {
    throw new Error(
      `Row not found after messages write: session=${conversation_id} pos=${insert.pos}`,
    );
  }
  return { messageId: idRow.id };
}

export async function updateMessageContent(
  conversation_id: string,
  message_id: string,
  content: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: messages.id, payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), eq(messages.id, message_id)))
    .limit(1);
  const contentRow = rows[0];
  if (!contentRow) return;

  const payload = contentRow.payload;
  if (payload.role !== "assistant" && payload.role !== "user") return;

  const fts_segmented = await resolveFtsSegmentedForWrite(content.trim());
  await db
    .update(messages)
    .set({
      payload: { ...payload, content },
      fts_segmented,
    })
    .where(eq(messages.id, message_id));
}

export async function nextMessagePos(conversation_id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ maxPos: sql<number>`coalesce(max(${messages.pos}), 0)` })
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id));
  return Number(rows[0]?.maxPos ?? 0) + 1;
}

/** 当前会话末条消息的 pos；空会话为 0 */
export async function getMaxMessagePos(conversation_id: string): Promise<number> {
  const next = await nextMessagePos(conversation_id);
  return Math.max(0, next - 1);
}

export async function findUserMessageByClientOpId(
  conversation_id: string,
  client_op_id: string,
): Promise<ConversationMessage | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversation_id, conversation_id),
        sql`(${messages.payload})->>'role' = 'user'`,
        sql`(${messages.payload})->>'client_op_id' = ${client_op_id}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? rowToMessage(row) : null;
}

export async function getLastMessageRole(conversation_id: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ role: sql<string>`(${messages.payload})->>'role'` })
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id))
    .orderBy(desc(messages.pos))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function listMessages(conversation_id: string): Promise<ConversationMessage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id))
    .orderBy(asc(messages.pos));
  return rows.map((r) => rowToMessage(r));
}

/** 按 pos 降序拉取最近消息（ACP result 扫描等，避免整会话 listMessages） */
export async function listRecentMessages(
  conversation_id: string,
  limit: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(200, limit));
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id))
    .orderBy(desc(messages.pos))
    .limit(safeLimit);
  return rows.map((r) => rowToMessage(r));
}

/** Chat 向上分页：pos < beforePos，取最近 limit 条后升序返回 */
export async function listMessagesBeforePos(
  conversation_id: string,
  beforePos: number,
  limit: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const safeLimit = Math.max(1, limit);
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), lt(messages.pos, beforePos)))
    .orderBy(desc(messages.pos))
    .limit(safeLimit);
  return rows.map((r) => rowToMessage(r)).toReversed();
}

export async function listMessagesByPosRange(
  conversation_id: string,
  fromPos: number,
  toPos?: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const conditions = [eq(messages.conversation_id, conversation_id), gte(messages.pos, fromPos)];
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

export async function countMessages(conversation_id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id));
  return Number(rows[0]?.count ?? 0);
}

export async function countUserMessages(conversation_id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.conversation_id, conversation_id),
        sql`(${messages.payload})->>'role' = 'user'`,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** API / history pagination: slice by pos order, avoid full listMessages */
export async function listMessagesPage(
  conversation_id: string,
  offset: number,
  limit: number,
): Promise<ConversationMessage[]> {
  const db = getDb();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id))
    .orderBy(asc(messages.pos))
    .offset(safeOffset)
    .limit(safeLimit);
  return rows.map((r) => rowToMessage(r));
}

export async function findMessagePos(
  conversation_id: string,
  message_id: string,
): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ pos: messages.pos })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), eq(messages.id, message_id)))
    .limit(1);
  const posRow = rows[0];
  if (!posRow) return null;
  return Number(posRow.pos);
}

export async function listMessageRowsPage(
  conversation_id: string,
  offset: number,
  limit: number,
): Promise<MessageRowView[]> {
  const db = getDb();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const rows = await db
    .select({
      id: messages.id,
      pos: messages.pos,
      payload: messages.payload,
    })
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id))
    .orderBy(asc(messages.pos))
    .offset(safeOffset)
    .limit(safeLimit);
  return rows.map((r) => rowToMessageRowView(r));
}

export async function listMessageRowsFromPos(
  conversation_id: string,
  fromPos: number,
  limit: number,
): Promise<MessageRowView[]> {
  const db = getDb();
  const safeLimit = Math.max(1, limit);
  const rows = await db
    .select({
      id: messages.id,
      pos: messages.pos,
      payload: messages.payload,
    })
    .from(messages)
    .where(and(eq(messages.conversation_id, conversation_id), gte(messages.pos, fromPos)))
    .orderBy(asc(messages.pos))
    .limit(safeLimit);
  return rows.map((r) => rowToMessageRowView(r));
}

/** Latest message timestamp (avoids full listMessages load) */
export async function lastMessageTimestamp(conversation_id: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      ts: sql<string | null>`max((${messages.payload}->>'timestamp')::timestamptz)::text`,
    })
    .from(messages)
    .where(eq(messages.conversation_id, conversation_id));
  return rows[0]?.ts ?? null;
}

export async function truncateMessagesAfter(
  conversation_id: string,
  keepThroughPos: number,
): Promise<void> {
  const db = getDb();
  await db
    .delete(messages)
    .where(
      and(eq(messages.conversation_id, conversation_id), sql`${messages.pos} > ${keepThroughPos}`),
    );
}

/**
 * Shift message pos > afterPos by delta.
 * 正 delta：先抬到临时高位再落到位，避开 (conversation_id, pos) 唯一约束冲突。
 */
export async function shiftMessagePositions(
  conversation_id: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const db = getDb();
  const scoped = and(
    eq(messages.conversation_id, conversation_id),
    sql`${messages.pos} > ${afterPos}`,
  );
  if (delta > 0) {
    const TEMP_OFFSET = 1_000_000_000;
    await db.transaction(async (tx) => {
      await tx
        .update(messages)
        .set({ pos: sql`${messages.pos} + ${TEMP_OFFSET}` })
        .where(scoped);
      await tx
        .update(messages)
        .set({ pos: sql`${messages.pos} - ${TEMP_OFFSET - delta}` })
        .where(
          and(
            eq(messages.conversation_id, conversation_id),
            sql`${messages.pos} > ${afterPos + TEMP_OFFSET}`,
          ),
        );
    });
    return;
  }
  await db
    .update(messages)
    .set({ pos: sql`${messages.pos} + ${delta}` })
    .where(scoped);
}
