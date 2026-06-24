import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { ConversationMessage, SessionMessage } from "@freeanima/core/db/domain";
import type { MessageRowView } from "@freeanima/core/repos";

import { messages } from "@freeanima/core/db/schema";

import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { scheduleMessageEmbedding } from "../../embedding/schedule.ts";
import { recordMessageReferences } from "../../memory-reference/repos/memory-reference-repo.ts";
import { isCronSession } from "./session-repo.ts";
import { getDb } from "../../client.ts";
import { messageToInsert, rowToMessage } from "../mappers/message-mapper.ts";

function extractIndexableContent(payload: { role: string; content?: string | null }): string {
  if (payload.role !== "user" && payload.role !== "assistant") return "";
  return typeof payload.content === "string" ? payload.content.trim() : "";
}

function rowToMessageRowView(row: {
  id: string;
  pos: number;
  payload: { role: string; content?: string | null; timestamp?: string | null };
}): MessageRowView {
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
  sessionId: string,
  msg: SessionMessage,
): Promise<ConversationMessage> {
  const db = getDb();
  const insert = messageToInsert(sessionId, msg);
  const ftsSegmented = await resolveFtsSegmentedForWrite(extractIndexableContent(insert.payload));
  const inserted = await db
    .insert(messages)
    .values({ ...insert, ftsSegmented })
    .onConflictDoNothing({ target: [messages.sessionId, messages.pos] })
    .returning();
  if (inserted.length) {
    const row = inserted[0]!;
    const content = extractIndexableContent(row.payload);
    if (content) {
      scheduleMessageEmbedding(row.id, content);
      const createdAt =
        typeof row.payload.timestamp === "string" ? row.payload.timestamp : undefined;
      const skipRefs = await isCronSession(sessionId);
      await recordMessageReferences({
        message_id: row.id,
        session_id: sessionId,
        content,
        created_at: createdAt,
        skip_reference_count: skipRefs,
      });
    }
    return rowToMessage(row);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.pos, insert.pos)))
    .limit(1);
  if (!rows.length) {
    throw new Error(`Row not found after messages write: session=${sessionId} pos=${insert.pos}`);
  }
  return rowToMessage(rows[0]!);
}

export async function getMessageContentById(
  sessionId: string,
  messageId: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.id, messageId)))
    .limit(1);
  if (!rows.length) return null;
  const payload = rows[0]!.payload;
  if (payload.role !== "assistant" && payload.role !== "user") return null;
  const raw = payload.content;
  return typeof raw === "string" ? raw : null;
}

export async function getMessageContentsByIds(
  sessionId: string,
  messageIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))];
  if (!uniqueIds.length) return {};
  const db = getDb();
  const rows = await db
    .select({ id: messages.id, payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), inArray(messages.id, uniqueIds)));
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
  sessionId: string,
  msg: SessionMessage,
): Promise<{ messageId: string }> {
  const out: SessionMessage = { ...msg };
  if (out.pos === undefined && out.role !== "session_meta") {
    out.pos = await nextMessagePos(sessionId);
  }
  const db = getDb();
  const insert = messageToInsert(sessionId, out);
  const ftsSegmented = await resolveFtsSegmentedForWrite(extractIndexableContent(insert.payload));
  const inserted = await db
    .insert(messages)
    .values({ ...insert, ftsSegmented })
    .onConflictDoNothing({ target: [messages.sessionId, messages.pos] })
    .returning();
  if (inserted.length) {
    return { messageId: inserted[0]!.id };
  }

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.pos, insert.pos)))
    .limit(1);
  if (!rows.length) {
    throw new Error(`Row not found after messages write: session=${sessionId} pos=${insert.pos}`);
  }
  return { messageId: rows[0]!.id };
}

export async function updateMessageContent(
  sessionId: string,
  messageId: string,
  content: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: messages.id, payload: messages.payload })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.id, messageId)))
    .limit(1);
  if (!rows.length) return;

  const payload = rows[0]!.payload;
  if (payload.role !== "assistant" && payload.role !== "user") return;

  const ftsSegmented = await resolveFtsSegmentedForWrite(content.trim());
  await db
    .update(messages)
    .set({
      payload: { ...payload, content },
      ftsSegmented,
    })
    .where(eq(messages.id, messageId));
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

export async function countUserMessages(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), sql`(${messages.payload})->>'role' = 'user'`));
  return Number(rows[0]?.count ?? 0);
}

/** API / history pagination: slice by pos order, avoid full listMessages */
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

export async function findMessagePos(sessionId: string, messageId: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ pos: messages.pos })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.id, messageId)))
    .limit(1);
  if (!rows.length) return null;
  return Number(rows[0]!.pos);
}

export async function listMessageRowsPage(
  sessionId: string,
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
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.pos))
    .offset(safeOffset)
    .limit(safeLimit);
  return rows.map((r) => rowToMessageRowView(r));
}

export async function listMessageRowsFromPos(
  sessionId: string,
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
    .where(and(eq(messages.sessionId, sessionId), gte(messages.pos, fromPos)))
    .orderBy(asc(messages.pos))
    .limit(safeLimit);
  return rows.map((r) => rowToMessageRowView(r));
}

/** Latest message timestamp (avoids full listMessages load) */
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
 * Shift message pos > afterPos by delta (avoid unique conflicts: positive delta high-to-low, negative low-to-high).
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
