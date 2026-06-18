import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  compressionStateSchema,
  sessionTodoStoreSchema,
  type CompressionState,
  type SessionMetaMessage,
  type SessionTodoStore,
} from "@freeanima/core/db/domain";

import type { SessionCleanupResult, SessionSummaryRow } from "@freeanima/core/repos";
import {
  acpTasksSchema,
  awaitingClarifySchema,
  buildOriginIdentityProbe,
  sessionCachedToolsetsSchema,
  sessionFunctionsSchema,
  sessionInsertSchema,
  sessionStagedToolsetsSchema,
  sessions,
} from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";
import {
  patchCompression,
  patchTodos,
  rowToSessionMeta,
  sessionMetaToInsert,
} from "../mappers/session-mapper.ts";
import { formatDbError } from "../../utils/db-error.ts";
import { normalizePgTimestamp, pgJsonbOrNull, pgTextOrNull } from "../../utils/timestamp.ts";

const pgNowIso = (): string => normalizePgTimestamp(new Date());

export async function getSessionMeta(sessionId: string): Promise<SessionMetaMessage | null> {
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!rows.length) return null;
  return rowToSessionMeta(rows[0]!);
}

/** Hot-path meta: keep cached/staged toolsets for runtime */
export async function getSessionMetaLite(sessionId: string): Promise<SessionMetaMessage | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessions.id,
      model: sessions.model,
      title: sessions.title,
      cwd: sessions.cwd,
      systemPrompt: sessions.systemPrompt,
      platformInfo: sessions.platformInfo,
      compression: sessions.compression,
      todos: sessions.todos,
      awaitingClarify: sessions.awaitingClarify,
      acpTasks: sessions.acpTasks,
      cachedToolsets: sessions.cachedToolsets,
      stagedToolsets: sessions.stagedToolsets,
      functions: sessions.functions,
      debug: sessions.debug,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!rows.length) return null;
  return rowToSessionMeta(rows[0]!);
}

export async function getSessionTools(
  sessionId: string,
): Promise<SessionMetaMessage["cached_toolsets"]> {
  const db = getDb();
  const rows = await db
    .select({ cachedToolsets: sessions.cachedToolsets })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!rows.length) return [];
  return sessionCachedToolsetsSchema.parse(rows[0]!.cachedToolsets ?? []);
}

export async function upsertSessionMeta(
  sessionId: string,
  meta: SessionMetaMessage,
): Promise<void> {
  const db = getDb();
  const row = sessionInsertSchema.parse(sessionMetaToInsert(sessionId, meta));
  try {
    const existing = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (existing.length) {
      await db
        .update(sessions)
        .set({
          model: row.model,
          title: row.title,
          cwd: row.cwd,
          systemPrompt: row.systemPrompt,
          platformInfo: row.platformInfo,
          compression: row.compression,
          todos: row.todos,
          awaitingClarify: row.awaitingClarify,
          acpTasks: row.acpTasks,
          cachedToolsets: row.cachedToolsets,
          stagedToolsets: row.stagedToolsets,
          functions: row.functions,
          debug: row.debug,
          updatedAt: row.updatedAt,
        })
        .where(eq(sessions.id, sessionId));
      return;
    }
    await db.insert(sessions).values(row);
  } catch (e) {
    throw new Error(formatDbError(e), { cause: e });
  }
}

export async function patchSessionMeta(
  sessionId: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: pgNowIso() };
  let hasColumnPatch = false;

  if (patch.title !== undefined) {
    set.title = pgTextOrNull(patch.title);
    hasColumnPatch = true;
  }
  if (patch.cwd !== undefined) {
    set.cwd = pgTextOrNull(patch.cwd);
    hasColumnPatch = true;
  }
  if (patch.system_prompt !== undefined) {
    set.systemPrompt = pgTextOrNull(patch.system_prompt);
    hasColumnPatch = true;
  }
  if (patch.compression === null) {
    set.compression = null;
    hasColumnPatch = true;
  } else if (patch.compression !== undefined) {
    const compression = compressionStateSchema.parse(patch.compression);
    if (compression === null) {
      set.compression = null;
    } else {
      Object.assign(set, patchCompression(compression));
    }
    hasColumnPatch = true;
  }
  if (patch.cached_toolsets !== undefined) {
    set.cachedToolsets = sessionCachedToolsetsSchema.parse(patch.cached_toolsets);
    hasColumnPatch = true;
  }
  if (patch.staged_toolsets !== undefined) {
    set.stagedToolsets = sessionStagedToolsetsSchema.parse(patch.staged_toolsets);
    hasColumnPatch = true;
  }
  if (patch.functions !== undefined) {
    set.functions = sessionFunctionsSchema.parse(patch.functions);
    hasColumnPatch = true;
  }
  if (patch.todos !== undefined) {
    Object.assign(set, patchTodos(sessionTodoStoreSchema.parse(patch.todos)));
    hasColumnPatch = true;
  }
  if (patch.debug !== undefined) {
    set.debug = patch.debug === true;
    hasColumnPatch = true;
  }
  if (patch.awaiting_clarify !== undefined) {
    const awaitingRaw = pgJsonbOrNull(patch.awaiting_clarify);
    set.awaitingClarify = awaitingRaw ? awaitingClarifySchema.parse(awaitingRaw) : null;
    hasColumnPatch = true;
  }
  if (patch.acp_tasks !== undefined) {
    const acpRaw = pgJsonbOrNull(patch.acp_tasks);
    set.acpTasks = acpRaw ? acpTasksSchema.parse(acpRaw) : null;
    hasColumnPatch = true;
  }
  if (patch.model !== undefined) {
    set.model = String(patch.model);
    hasColumnPatch = true;
  }
  if (patch.platform !== undefined || patch.platform_extra !== undefined) {
    hasColumnPatch = false;
  }

  if (hasColumnPatch && patch.platform === undefined && patch.platform_extra === undefined) {
    try {
      await db.update(sessions).set(set).where(eq(sessions.id, sessionId));
      return;
    } catch (e) {
      throw new Error(formatDbError(e), { cause: e });
    }
  }

  const existing = await getSessionMeta(sessionId);
  if (!existing) return;
  const merged: SessionMetaMessage = { ...existing, ...patch, role: "session_meta" };
  await upsertSessionMeta(sessionId, merged);
}

export async function updateCompression(
  sessionId: string,
  compression: CompressionState,
): Promise<void> {
  const db = getDb();
  await db.update(sessions).set(patchCompression(compression)).where(eq(sessions.id, sessionId));
}

export async function updateTodos(sessionId: string, todos: SessionTodoStore): Promise<void> {
  const db = getDb();
  await db.update(sessions).set(patchTodos(todos)).where(eq(sessions.id, sessionId));
}

export async function listSessionIds(platform?: string | null): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessions.id,
      platformInfo: sessions.platformInfo,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.updatedAt));
  return rows
    .filter((r) => {
      if (!platform) return true;
      const p = r.platformInfo?.platform;
      return p === platform;
    })
    .map((r) => r.id)
    .toReversed();
}

export async function listDebugSessionIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.debug, true));
  return rows.map((r) => r.id);
}

export async function countSessionsByPlatform(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.select({ platformInfo: sessions.platformInfo }).from(sessions);
  const byPlatform: Record<string, number> = {};
  for (const row of rows) {
    const raw = row.platformInfo?.platform;
    const platform = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return byPlatform;
}

export async function listSessionSummaries(platform?: string | null): Promise<SessionSummaryRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      platformInfo: sessions.platformInfo,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.updatedAt));
  return rows
    .filter((row) => {
      if (!platform) return true;
      return row.platformInfo?.platform === platform;
    })
    .map((row) => {
      const raw = row.platformInfo?.platform;
      return {
        id: row.id,
        title: row.title ?? "",
        created: row.createdAt,
        platform: typeof raw === "string" ? raw : "",
      };
    })
    .toReversed();
}

export async function deleteDebugSessions(): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(sessions)
    .where(eq(sessions.debug, true))
    .returning({ id: sessions.id });
  return rows.length;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

const staleSessionCleanupPredicate = sql`(
  NOT EXISTS (SELECT 1 FROM messages m WHERE m.session_id = ${sessions.id})
  OR (SELECT count(*)::int FROM messages m WHERE m.session_id = ${sessions.id}) = 1
  OR (
    (SELECT count(*)::int FROM messages m WHERE m.session_id = ${sessions.id}) > 1
    AND NOT EXISTS (
      SELECT 1 FROM messages m
      WHERE m.session_id = ${sessions.id}
        AND (m.payload)->>'role' = 'assistant'
    )
  )
)`;

export async function listStaleSessionIdsForCleanup(opts: { olderThan: Date }): Promise<string[]> {
  const db = getDb();
  const olderThanIso = normalizePgTimestamp(opts.olderThan);
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.debug, false),
        lt(sessions.updatedAt, olderThanIso),
        staleSessionCleanupPredicate,
      ),
    );
  return rows.map((r) => r.id);
}

export async function deleteStaleSessions(opts: {
  olderThan: Date;
}): Promise<SessionCleanupResult> {
  const ids = await listStaleSessionIdsForCleanup(opts);
  if (!ids.length) return { deleted: 0, ids: [] };
  const db = getDb();
  const deleted = await db
    .delete(sessions)
    .where(inArray(sessions.id, ids))
    .returning({ id: sessions.id });
  return { deleted: deleted.length, ids: deleted.map((r) => r.id) };
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Find active session by platform + platform_extra identity (excludes routing meta from probe).
 * Falls back to most recently updated match for legacy rows without origin_active.
 */
export async function findSessionIdByPlatformInfo(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  const probe = buildOriginIdentityProbe(platform, platformExtra);
  if (!probe) return null;
  const db = getDb();
  const probeJson = JSON.stringify(probe);

  const activeRows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      sql`${sessions.platformInfo} @> ${probeJson}::jsonb
        AND (${sessions.platformInfo}->>'origin_active')::boolean IS TRUE`,
    )
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  if (activeRows[0]?.id) return activeRows[0].id;

  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(sql`${sessions.platformInfo} @> ${probeJson}::jsonb`)
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** All session ids whose platform_info contains the identity probe (routing meta excluded). */
export async function listSessionIdsMatchingPlatformProbe(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string[]> {
  const probe = buildOriginIdentityProbe(platform, platformExtra);
  if (!probe) return [];
  const db = getDb();
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(sql`${sessions.platformInfo} @> ${JSON.stringify(probe)}::jsonb`)
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => r.id);
}

/** Non-debug session ids with sessions.updated_at in [fromIso, toIso) */
export async function listSessionIdsUpdatedBetween(
  fromIso: string,
  toIso: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      sql`${sessions.updatedAt} >= ${fromIso}::timestamptz
        AND ${sessions.updatedAt} < ${toIso}::timestamptz
        AND ${sessions.debug} = false`,
    )
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => r.id);
}

/** Earliest non-debug session CST calendar day YYYY-MM-DD */
export async function getEarliestSessionDay(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      day: sql<string | null>`to_char(
        (MIN(${sessions.createdAt}) AT TIME ZONE 'Asia/Shanghai')::date,
        'YYYY-MM-DD'
      )`,
    })
    .from(sessions)
    .where(eq(sessions.debug, false));
  const day = rows[0]?.day?.trim();
  return day || null;
}
