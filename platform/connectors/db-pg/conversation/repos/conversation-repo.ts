import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  compressionStateSchema,
  conversationTodoStoreSchema,
  type CompressionState,
  type ConversationMetaMessage,
  type ConversationTodoStore,
} from "@freeanima/core/db/domain";

import type { ConversationCleanupResult, ConversationSummaryRow } from "@freeanima/core/repos";
import {
  acpTasksSchema,
  awaitingClarifySchema,
  buildOriginIdentityProbe,
  conversationCachedToolsetsSchema,
  conversationFunctionsSchema,
  conversationGoalSchema,
  conversationInsertSchema,
  conversationStagedToolsetsSchema,
  conversations,
} from "@freeanima/core/db/schema";

import { getDb } from "../../client.ts";
import {
  patchCompression,
  patchTodos,
  rowToConversationMeta,
  conversationMetaToInsert,
} from "../mappers/conversation-mapper.ts";
import { formatDbError } from "../../utils/db-error.ts";
import { normalizePgTimestamp, pgJsonbOrNull, pgTextOrNull } from "../../utils/timestamp.ts";

const pgNowIso = (): string => normalizePgTimestamp(new Date());

export async function getConversationMeta(
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!rows.length) return null;
  return rowToConversationMeta(rows[0]!);
}

/** 是否为历史 cron agent 创建的 session（platform_info.platform = cron） */
export async function isCronSession(conversationId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({
      platform: sql<string | null>`${conversations.platformInfo}->>'platform'`,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows[0]?.platform === "cron";
}

/** 列出 platform_info.platform = cron 的 conversation id */
export async function listCronSessionIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(sql`COALESCE(${conversations.platformInfo}->>'platform', '') = 'cron'`);
  return rows.map((r) => r.id);
}

/** Hot-path meta: keep cached/staged toolsets for runtime */
export async function getConversationMetaLite(
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      model: conversations.model,
      title: conversations.title,
      cwd: conversations.cwd,
      systemPrompt: conversations.systemPrompt,
      platformInfo: conversations.platformInfo,
      compression: conversations.compression,
      todos: conversations.todos,
      awaitingClarify: conversations.awaitingClarify,
      acpTasks: conversations.acpTasks,
      goal: conversations.goal,
      cachedToolsets: conversations.cachedToolsets,
      stagedToolsets: conversations.stagedToolsets,
      functions: conversations.functions,
      debug: conversations.debug,
      archivedAt: conversations.archivedAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!rows.length) return null;
  return rowToConversationMeta(rows[0]!);
}

export async function getConversationTools(
  conversationId: string,
): Promise<ConversationMetaMessage["cached_toolsets"]> {
  const db = getDb();
  const rows = await db
    .select({ cachedToolsets: conversations.cachedToolsets })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!rows.length) return [];
  return conversationCachedToolsetsSchema.parse(rows[0]!.cachedToolsets ?? []);
}

export async function upsertConversationMeta(
  conversationId: string,
  meta: ConversationMetaMessage,
): Promise<void> {
  const db = getDb();
  const row = conversationInsertSchema.parse(conversationMetaToInsert(conversationId, meta));
  try {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (existing.length) {
      await db
        .update(conversations)
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
          goal: row.goal,
          cachedToolsets: row.cachedToolsets,
          stagedToolsets: row.stagedToolsets,
          functions: row.functions,
          debug: row.debug,
          updatedAt: row.updatedAt,
        })
        .where(eq(conversations.id, conversationId));
      return;
    }
    await db.insert(conversations).values(row);
  } catch (e) {
    throw new Error(formatDbError(e), { cause: e });
  }
}

export async function patchConversationMeta(
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
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
    set.cachedToolsets = conversationCachedToolsetsSchema.parse(patch.cached_toolsets);
    hasColumnPatch = true;
  }
  if (patch.staged_toolsets !== undefined) {
    set.stagedToolsets = conversationStagedToolsetsSchema.parse(patch.staged_toolsets);
    hasColumnPatch = true;
  }
  if (patch.functions !== undefined) {
    set.functions = conversationFunctionsSchema.parse(patch.functions);
    hasColumnPatch = true;
  }
  if (patch.todos !== undefined) {
    Object.assign(set, patchTodos(conversationTodoStoreSchema.parse(patch.todos)));
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
  if (patch.goal !== undefined) {
    const goalRaw = pgJsonbOrNull(patch.goal);
    set.goal = goalRaw ? conversationGoalSchema.parse(goalRaw) : null;
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
      await db.update(conversations).set(set).where(eq(conversations.id, conversationId));
      return;
    } catch (e) {
      throw new Error(formatDbError(e), { cause: e });
    }
  }

  const existing = await getConversationMeta(conversationId);
  if (!existing) return;
  const merged: ConversationMetaMessage = { ...existing, ...patch, role: "conversation_meta" };
  await upsertConversationMeta(conversationId, merged);
}

export async function updateCompression(
  conversationId: string,
  compression: CompressionState,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set(patchCompression(compression))
    .where(eq(conversations.id, conversationId));
}

export async function updateTodos(
  conversationId: string,
  todos: ConversationTodoStore,
): Promise<void> {
  const db = getDb();
  await db.update(conversations).set(patchTodos(todos)).where(eq(conversations.id, conversationId));
}

export async function listConversationIds(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  const db = getDb();
  const where = buildConversationListWhere(platform, opts?.includeArchived);
  const rows = await db
    .select({
      id: conversations.id,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updatedAt));
  return rows.map((r) => r.id).toReversed();
}

export async function listDebugConversationIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.debug, true));
  return rows.map((r) => r.id);
}

export async function countConversationsByPlatform(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.select({ platformInfo: conversations.platformInfo }).from(conversations);
  const byPlatform: Record<string, number> = {};
  for (const row of rows) {
    const raw = row.platformInfo?.platform;
    const platform = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return byPlatform;
}

function sessionPlatformWhere(platform?: string | null) {
  if (!platform) return undefined;
  return sql`${conversations.platformInfo}->>'platform' = ${platform}`;
}

function buildConversationListWhere(platform?: string | null, includeArchived?: boolean) {
  const conds = [];
  const platformCond = sessionPlatformWhere(platform);
  if (platformCond) conds.push(platformCond);
  if (!includeArchived) conds.push(isNull(conversations.archivedAt));
  if (conds.length === 0) return undefined;
  if (conds.length === 1) return conds[0];
  return and(...conds);
}

function mapConversationSummaryRow(row: {
  id: string;
  title: string | null;
  platformInfo: { platform?: string } | null;
  createdAt: string;
  archivedAt?: string | null;
}): ConversationSummaryRow {
  const raw = row.platformInfo?.platform;
  return {
    id: row.id,
    title: row.title ?? "",
    created: row.createdAt,
    platform: typeof raw === "string" ? raw : "",
    archived_at: row.archivedAt ?? null,
  };
}

export async function listConversationSummaries(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<ConversationSummaryRow[]> {
  const db = getDb();
  const where = buildConversationListWhere(platform, opts?.includeArchived);
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      platformInfo: conversations.platformInfo,
      createdAt: conversations.createdAt,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updatedAt));
  return rows.map(mapConversationSummaryRow).toReversed();
}

export async function listConversationSummariesPage(opts?: {
  platform?: string | null;
  offset?: number;
  limit?: number;
  includeArchived?: boolean;
}): Promise<{ items: ConversationSummaryRow[]; total: number }> {
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 20));
  const platform = opts?.platform;
  const db = getDb();
  const where = buildConversationListWhere(platform, opts?.includeArchived);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      platformInfo: conversations.platformInfo,
      createdAt: conversations.createdAt,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map(mapConversationSummaryRow),
    total,
  };
}

export async function deleteDebugConversations(): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(conversations)
    .where(eq(conversations.debug, true))
    .returning({ id: conversations.id });
  return rows.length;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = getDb();
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

export async function archiveConversation(conversationId: string): Promise<void> {
  const db = getDb();
  const now = pgNowIso();
  await db
    .update(conversations)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(conversations.id, conversationId));
}

export async function unarchiveConversation(conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ archivedAt: null, updatedAt: pgNowIso() })
    .where(eq(conversations.id, conversationId));
}

const staleSessionCleanupPredicate = sql`(
  NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = ${conversations.id})
  OR (SELECT count(*)::int FROM messages m WHERE m.conversation_id = ${conversations.id}) = 1
  OR (
    (SELECT count(*)::int FROM messages m WHERE m.conversation_id = ${conversations.id}) > 1
    AND NOT EXISTS (
      SELECT 1 FROM messages m
      WHERE m.conversation_id = ${conversations.id}
        AND (m.payload)->>'role' = 'assistant'
    )
  )
)`;

export async function listStaleConversationIdsForCleanup(opts: {
  olderThan: Date;
}): Promise<string[]> {
  const db = getDb();
  const olderThanIso = normalizePgTimestamp(opts.olderThan);
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.debug, false),
        isNull(conversations.archivedAt),
        lt(conversations.updatedAt, olderThanIso),
        staleSessionCleanupPredicate,
      ),
    );
  return rows.map((r) => r.id);
}

export async function deleteStaleConversations(opts: {
  olderThan: Date;
}): Promise<ConversationCleanupResult> {
  const ids = await listStaleConversationIdsForCleanup(opts);
  if (!ids.length) return { deleted: 0, ids: [] };
  const db = getDb();
  const deleted = await db
    .delete(conversations)
    .where(inArray(conversations.id, ids))
    .returning({ id: conversations.id });
  return { deleted: deleted.length, ids: deleted.map((r) => r.id) };
}

export async function conversationExists(conversationId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Find active conversation by platform + platform_extra identity (excludes routing meta from probe).
 * Falls back to most recently updated match for legacy rows without origin_active.
 */
export async function findConversationIdByPlatformInfo(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  const probe = buildOriginIdentityProbe(platform, platformExtra);
  if (!probe) return null;
  const db = getDb();
  const probeJson = JSON.stringify(probe);

  const activeRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      sql`${conversations.platformInfo} @> ${probeJson}::jsonb
        AND (${conversations.platformInfo}->>'origin_active')::boolean IS TRUE`,
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  if (activeRows[0]?.id) return activeRows[0].id;

  const legacyRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      sql`${conversations.platformInfo} @> ${probeJson}::jsonb
        AND COALESCE((${conversations.platformInfo}->>'origin_active')::boolean, false) IS NOT TRUE
        AND (${conversations.platformInfo}->>'origin_active') IS NULL`,
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  return legacyRows[0]?.id ?? null;
}

/** All conversation ids whose platform_info contains the identity probe (routing meta excluded). */
export async function listConversationIdsMatchingPlatformProbe(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string[]> {
  const probe = buildOriginIdentityProbe(platform, platformExtra);
  if (!probe) return [];
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(sql`${conversations.platformInfo} @> ${JSON.stringify(probe)}::jsonb`)
    .orderBy(desc(conversations.updatedAt));
  return rows.map((r) => r.id);
}

/** Non-debug conversation ids with conversations.updated_at in [fromIso, toIso) */
export async function listConversationIdsUpdatedBetween(
  fromIso: string,
  toIso: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      sql`${conversations.updatedAt} >= ${fromIso}::timestamptz
        AND ${conversations.updatedAt} < ${toIso}::timestamptz
        AND ${conversations.debug} = false
        AND COALESCE(${conversations.platformInfo}->>'platform', '') <> 'cron'`,
    )
    .orderBy(desc(conversations.updatedAt));
  return rows.map((r) => r.id);
}

/** Earliest non-debug conversation CST calendar day YYYY-MM-DD */
export async function getEarliestConversationDay(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      day: sql<string | null>`to_char(
        (MIN(${conversations.createdAt}) AT TIME ZONE 'Asia/Shanghai')::date,
        'YYYY-MM-DD'
      )`,
    })
    .from(conversations)
    .where(eq(conversations.debug, false));
  const day = rows[0]?.day?.trim();
  return day || null;
}
