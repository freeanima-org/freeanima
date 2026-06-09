import { sql } from "drizzle-orm";

import type { MessageSelect, SessionSelect } from "@freeanima/engine-db/schema";

import { getDb } from "../client.ts";
import { normalizePgTimestamp } from "./timestamp.ts";

/** Drizzle 1.0.0-rc.3 + Bun.sql：RQB `.select()` 不生成列清单；读路径统一走 `execute`。 */

function coerceIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return normalizePgTimestamp(value);
  if (typeof value === "string") return value;
  return String(value);
}

function coerceSessionRow(row: Record<string, unknown>): SessionSelect {
  return {
    ...(row as SessionSelect),
    createdAt: coerceIsoTimestamp(row.createdAt) ?? "",
    updatedAt: coerceIsoTimestamp(row.updatedAt) ?? "",
  };
}

function coerceMessageRow(row: Record<string, unknown>): MessageSelect {
  return {
    ...(row as MessageSelect),
    pos: Number(row.pos),
    contentFts: (row.contentFts ?? row.content_fts ?? null) as MessageSelect["contentFts"],
  };
}

const SESSION_COLUMNS = sql`
  id,
  model,
  title,
  cwd,
  system_prompt AS "systemPrompt",
  platform_info AS "platformInfo",
  compression,
  todos,
  awaiting_clarify AS "awaitingClarify",
  acp_sessions AS "acpSessions",
  tools,
  functions,
  debug,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const MESSAGE_COLUMNS = sql`
  id,
  session_id AS "sessionId",
  pos,
  payload,
  content_fts AS "contentFts"
`;

export async function sessionExists(sessionId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(sql`SELECT 1 AS ok FROM sessions WHERE id = ${sessionId} LIMIT 1`);
  return rows.length > 0;
}

export async function selectSessionById(sessionId: string): Promise<SessionSelect[]> {
  const db = getDb();
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ${sessionId} LIMIT 1
  `);
  return rows.map(coerceSessionRow);
}

export async function selectSessionTools(
  sessionId: string,
): Promise<SessionSelect["tools"] | null> {
  const db = getDb();
  const rows = await db.execute<{ tools: SessionSelect["tools"] }>(sql`
    SELECT tools FROM sessions WHERE id = ${sessionId} LIMIT 1
  `);
  return rows[0]?.tools ?? null;
}

export async function selectSessionsForList(): Promise<
  Array<{ id: string; platformInfo: SessionSelect["platformInfo"]; updatedAt: string }>
> {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    platformInfo: SessionSelect["platformInfo"];
    updatedAt: string | Date;
  }>(sql`
    SELECT id, platform_info AS "platformInfo", updated_at AS "updatedAt"
    FROM sessions
    ORDER BY updated_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    platformInfo: r.platformInfo,
    updatedAt: coerceIsoTimestamp(r.updatedAt) ?? "",
  }));
}

export async function selectDebugSessionIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM sessions WHERE debug = true
  `);
  return rows.map((r) => r.id);
}

export async function selectSessionsPlatformInfo(): Promise<
  Array<{ platformInfo: SessionSelect["platformInfo"] }>
> {
  const db = getDb();
  return db.execute(sql`SELECT platform_info AS "platformInfo" FROM sessions`);
}

export async function selectSessionSummaries(): Promise<
  Array<{
    id: string;
    title: string | null;
    platformInfo: SessionSelect["platformInfo"];
    createdAt: string;
  }>
> {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    title: string | null;
    platformInfo: SessionSelect["platformInfo"];
    createdAt: string | Date;
  }>(sql`
    SELECT id, title, platform_info AS "platformInfo", created_at AS "createdAt"
    FROM sessions
    ORDER BY updated_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    platformInfo: r.platformInfo,
    createdAt: coerceIsoTimestamp(r.createdAt) ?? "",
  }));
}

export async function findSessionIdByPlatformProbe(probeJson: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM sessions
    WHERE platform_info @> ${probeJson}::jsonb
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

export async function selectSessionIdsUpdatedBetween(
  fromIso: string,
  toIso: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM sessions
    WHERE updated_at >= ${fromIso}::timestamptz
      AND updated_at < ${toIso}::timestamptz
      AND debug = false
    ORDER BY updated_at DESC
  `);
  return rows.map((r) => r.id);
}

export async function selectMessagesBySessionId(sessionId: string): Promise<MessageSelect[]> {
  const db = getDb();
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT ${MESSAGE_COLUMNS}
    FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY pos ASC
  `);
  return rows.map(coerceMessageRow);
}

export async function selectMessageBySessionPos(
  sessionId: string,
  pos: number,
): Promise<MessageSelect[]> {
  const db = getDb();
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT ${MESSAGE_COLUMNS}
    FROM messages
    WHERE session_id = ${sessionId} AND pos = ${pos}
    LIMIT 1
  `);
  return rows.map(coerceMessageRow);
}

export async function maxMessagePos(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ maxPos: number }>(sql`
    SELECT coalesce(max(pos), 0)::int AS "maxPos"
    FROM messages
    WHERE session_id = ${sessionId}
  `);
  return Number(rows[0]?.maxPos ?? 0);
}

export async function selectMessagesByPosRange(
  sessionId: string,
  fromPos: number,
  toPos?: number,
): Promise<MessageSelect[]> {
  const db = getDb();
  const rows =
    toPos === undefined
      ? await db.execute<Record<string, unknown>>(sql`
          SELECT ${MESSAGE_COLUMNS}
          FROM messages
          WHERE session_id = ${sessionId} AND pos >= ${fromPos}
          ORDER BY pos ASC
        `)
      : await db.execute<Record<string, unknown>>(sql`
          SELECT ${MESSAGE_COLUMNS}
          FROM messages
          WHERE session_id = ${sessionId} AND pos >= ${fromPos} AND pos <= ${toPos}
          ORDER BY pos ASC
        `);
  return rows.map(coerceMessageRow);
}

export async function countMessagesForSession(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM messages WHERE session_id = ${sessionId}
  `);
  return Number(rows[0]?.count ?? 0);
}

export async function selectMessagesPage(
  sessionId: string,
  offset: number,
  limit: number,
): Promise<MessageSelect[]> {
  const db = getDb();
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT ${MESSAGE_COLUMNS}
    FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY pos ASC
    OFFSET ${offset}
    LIMIT ${limit}
  `);
  return rows.map(coerceMessageRow);
}

export async function lastMessageTimestamp(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.execute<{ ts: string | null }>(sql`
    SELECT max((payload->>'timestamp')::timestamptz)::text AS ts
    FROM messages
    WHERE session_id = ${sessionId}
  `);
  return rows[0]?.ts ?? null;
}
