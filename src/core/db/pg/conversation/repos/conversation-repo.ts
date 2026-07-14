import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  compressionStateSchema,
  conversationTodoStoreSchema,
  type CompressionState,
  type ConversationMetaMessage,
  type ConversationTodoStore,
} from "@freeanima/core/db/domain";

import type { ConversationCleanupResult, ConversationSummaryRow } from "../types.ts";
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
} from "../transform.ts";
import { formatDbError } from "../../utils/db-error.ts";
import { pgJsonbOrNull, pgTextOrNull } from "../../utils/timestamp.ts";
import type { ConversationInsert } from "@freeanima/core/db/schema";

const pgNow = (): Date => new Date();

export async function getConversationMeta(
  conversation_id: string,
): Promise<ConversationMetaMessage | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  const metaRow = rows[0];
  if (!metaRow) return null;
  return rowToConversationMeta(metaRow);
}

/** 是否为历史 cron agent 创建的 session（platform_info.platform = cron） */
export async function isCronSession(conversation_id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({
      platform: sql<string | null>`${conversations.platform_info}->>'platform'`,
    })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  return rows[0]?.platform === "cron";
}

/** 列出 platform_info.platform = cron 的 conversation id */
export async function listCronSessionIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(sql`COALESCE(${conversations.platform_info}->>'platform', '') = 'cron'`);
  return rows.map((r) => r.id);
}

/** Hot-path meta: keep cached/staged toolsets for runtime */
export async function getConversationMetaLite(
  conversation_id: string,
): Promise<ConversationMetaMessage | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      model: conversations.model,
      title: conversations.title,
      cwd: conversations.cwd,
      system_prompt: conversations.system_prompt,
      system_prompt_built_at: conversations.system_prompt_built_at,
      platform_info: conversations.platform_info,
      compression: conversations.compression,
      todos: conversations.todos,
      awaiting_clarify: conversations.awaiting_clarify,
      acp_tasks: conversations.acp_tasks,
      goal: conversations.goal,
      cached_toolsets: conversations.cached_toolsets,
      staged_toolsets: conversations.staged_toolsets,
      functions: conversations.functions,
      debug: conversations.debug,
      archived_at: conversations.archived_at,
      created_at: conversations.created_at,
      updated_at: conversations.updated_at,
    })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  const metaRow = rows[0];
  if (!metaRow) return null;
  return rowToConversationMeta(metaRow);
}

export async function getConversationTools(
  conversation_id: string,
): Promise<ConversationMetaMessage["cached_toolsets"]> {
  const db = getDb();
  const rows = await db
    .select({ cached_toolsets: conversations.cached_toolsets })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  const toolsRow = rows[0];
  if (!toolsRow) return [];
  return conversationCachedToolsetsSchema.parse(toolsRow.cached_toolsets ?? []);
}

export async function upsertConversationMeta(
  conversation_id: string,
  meta: ConversationMetaMessage,
): Promise<void> {
  const db = getDb();
  const row = conversationInsertSchema.parse(conversationMetaToInsert(conversation_id, meta));
  try {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversation_id))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(conversations)
        .set({
          model: row.model,
          title: row.title,
          cwd: row.cwd,
          system_prompt: row.system_prompt,
          system_prompt_built_at: row.system_prompt_built_at,
          platform_info: row.platform_info,
          compression: row.compression,
          todos: row.todos,
          awaiting_clarify: row.awaiting_clarify,
          acp_tasks: row.acp_tasks,
          goal: row.goal,
          cached_toolsets: row.cached_toolsets,
          staged_toolsets: row.staged_toolsets,
          functions: row.functions,
          debug: row.debug,
          updated_at: row.updated_at,
        })
        .where(eq(conversations.id, conversation_id));
      return;
    }
    await db.insert(conversations).values(row);
  } catch (e) {
    throw new Error(formatDbError(e), { cause: e });
  }
}

export async function patchConversationMeta(
  conversation_id: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  const db = getDb();

  // platform_info 衍生字段（capability_mask / gateway_tool_display）须走全量 upsert
  if (
    "capability_mask" in patch ||
    "gateway_tool_display" in patch ||
    patch.platform !== undefined ||
    patch.platform_extra !== undefined
  ) {
    const existing = await getConversationMeta(conversation_id);
    if (!existing) return;
    const merged: ConversationMetaMessage = { ...existing, ...patch, role: "conversation_meta" };
    if ("gateway_tool_display" in patch && patch.gateway_tool_display === undefined) {
      delete merged.gateway_tool_display;
    }
    if ("capability_mask" in patch && patch.capability_mask === undefined) {
      delete merged.capability_mask;
    }
    await upsertConversationMeta(conversation_id, merged);
    return;
  }

  const set: Partial<ConversationInsert> = { updated_at: pgNow() };
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
    set.system_prompt = pgTextOrNull(patch.system_prompt);
    hasColumnPatch = true;
    if (typeof patch.system_prompt_built_at === "string" && patch.system_prompt_built_at.trim()) {
      const parsed = new Date(patch.system_prompt_built_at);
      set.system_prompt_built_at = Number.isNaN(parsed.getTime()) ? pgNow() : parsed;
    } else {
      set.system_prompt_built_at = pgNow();
    }
  } else if (typeof patch.system_prompt_built_at === "string") {
    const parsed = new Date(patch.system_prompt_built_at);
    set.system_prompt_built_at = Number.isNaN(parsed.getTime()) ? null : parsed;
    hasColumnPatch = true;
  }
  if (patch.compression == null) {
    set.compression = null;
    hasColumnPatch = true;
  } else if (patch.compression !== undefined) {
    const compression = compressionStateSchema.parse(patch.compression);
    if (compression == null) {
      set.compression = null;
    } else {
      Object.assign(set, patchCompression(compression));
    }
    hasColumnPatch = true;
  }
  if (patch.cached_toolsets !== undefined) {
    set.cached_toolsets = conversationCachedToolsetsSchema.parse(patch.cached_toolsets);
    hasColumnPatch = true;
  }
  if (patch.staged_toolsets !== undefined) {
    set.staged_toolsets = conversationStagedToolsetsSchema.parse(patch.staged_toolsets);
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
  if ("awaiting_clarify" in patch) {
    const awaitingRaw = pgJsonbOrNull(patch.awaiting_clarify);
    set.awaiting_clarify = awaitingRaw ? awaitingClarifySchema.parse(awaitingRaw) : null;
    hasColumnPatch = true;
  }
  if ("acp_tasks" in patch) {
    const acpRaw = pgJsonbOrNull(patch.acp_tasks);
    set.acp_tasks = acpRaw ? acpTasksSchema.parse(acpRaw) : null;
    hasColumnPatch = true;
  }
  if ("goal" in patch) {
    const goalRaw = pgJsonbOrNull(patch.goal);
    set.goal = goalRaw ? conversationGoalSchema.parse(goalRaw) : null;
    hasColumnPatch = true;
  }
  if (patch.model !== undefined) {
    set.model = String(patch.model);
    hasColumnPatch = true;
  }

  if (hasColumnPatch) {
    try {
      await db.update(conversations).set(set).where(eq(conversations.id, conversation_id));
      return;
    } catch (e) {
      throw new Error(formatDbError(e), { cause: e });
    }
  }

  const existing = await getConversationMeta(conversation_id);
  if (!existing) return;
  const merged: ConversationMetaMessage = { ...existing, ...patch, role: "conversation_meta" };
  await upsertConversationMeta(conversation_id, merged);
}

export async function updateCompression(
  conversation_id: string,
  compression: CompressionState,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set(patchCompression(compression))
    .where(eq(conversations.id, conversation_id));
}

export async function updateTodos(
  conversation_id: string,
  todos: ConversationTodoStore,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set(patchTodos(todos))
    .where(eq(conversations.id, conversation_id));
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
      updated_at: conversations.updated_at,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updated_at));
  return rows.map((r) => r.id);
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
  const platformExpr = sql<string>`COALESCE(NULLIF(btrim(${conversations.platform_info}->>'platform'), ''), 'unknown')`;
  const rows = await db
    .select({
      platform: platformExpr,
      n: sql<number>`count(*)::int`,
    })
    .from(conversations)
    .groupBy(platformExpr);
  const byPlatform: Record<string, number> = {};
  for (const row of rows) {
    byPlatform[row.platform] = Number(row.n);
  }
  return byPlatform;
}

function sessionPlatformWhere(platform?: string | null) {
  if (!platform) return;
  return sql`${conversations.platform_info}->>'platform' = ${platform}`;
}

function buildConversationListWhere(platform?: string | null, includeArchived?: boolean) {
  const conds = [];
  const platformCond = sessionPlatformWhere(platform);
  if (platformCond) conds.push(platformCond);
  if (!includeArchived) conds.push(isNull(conversations.archived_at));
  if (conds.length === 0) return;
  if (conds.length === 1) return conds[0];
  return and(...conds);
}

function mapConversationSummaryRow(row: {
  id: string;
  title: string | null;
  platform_info: { platform?: string } | null;
  created_at: Date;
  updated_at: Date;
  archived_at?: Date | null;
}): ConversationSummaryRow {
  const raw = row.platform_info?.platform;
  return {
    id: row.id,
    title: row.title ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    platform: typeof raw === "string" ? raw : "",
    archived_at: row.archived_at ?? null,
  };
}

export async function touchConversationUpdatedAt(conversation_id: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ updated_at: pgNow() })
    .where(eq(conversations.id, conversation_id));
}

export async function getConversationUpdatedAt(conversation_id: string): Promise<Date | null> {
  const db = getDb();
  const rows = await db
    .select({ updated_at: conversations.updated_at })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
    .limit(1);
  return rows[0]?.updated_at ?? null;
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
      platform_info: conversations.platform_info,
      created_at: conversations.created_at,
      updated_at: conversations.updated_at,
      archived_at: conversations.archived_at,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updated_at));
  return rows.map(mapConversationSummaryRow);
}

export async function listConversationSummariesPage(opts?: {
  platform?: string | null;
  offset?: number;
  limit?: number;
  includeArchived?: boolean;
}): Promise<{ items: ConversationSummaryRow[]; total: number }> {
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 20));
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
      platform_info: conversations.platform_info,
      created_at: conversations.created_at,
      updated_at: conversations.updated_at,
      archived_at: conversations.archived_at,
    })
    .from(conversations)
    .where(where)
    .orderBy(desc(conversations.updated_at))
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

export async function deleteConversation(conversation_id: string): Promise<void> {
  const db = getDb();
  await db.delete(conversations).where(eq(conversations.id, conversation_id));
}

export async function archiveConversation(conversation_id: string): Promise<void> {
  const db = getDb();
  const now = pgNow();
  await db
    .update(conversations)
    .set({ archived_at: now, updated_at: now })
    .where(eq(conversations.id, conversation_id));
}

export async function unarchiveConversation(conversation_id: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ archived_at: null, updated_at: pgNow() })
    .where(eq(conversations.id, conversation_id));
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
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.debug, false),
        isNull(conversations.archived_at),
        lt(conversations.updated_at, opts.olderThan),
        staleSessionCleanupPredicate,
      ),
    );
  return rows.map((r) => r.id);
}

export async function deleteStaleConversations(opts: {
  olderThan: Date;
}): Promise<ConversationCleanupResult> {
  const ids = await listStaleConversationIdsForCleanup(opts);
  if (ids.length === 0) return { deleted: 0, ids: [] };
  const db = getDb();
  const deleted = await db
    .delete(conversations)
    .where(inArray(conversations.id, ids))
    .returning({ id: conversations.id });
  return { deleted: deleted.length, ids: deleted.map((r) => r.id) };
}

export async function conversationExists(conversation_id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversation_id))
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
      sql`${conversations.platform_info} @> ${probeJson}::jsonb
        AND (${conversations.platform_info}->>'origin_active')::boolean IS TRUE`,
    )
    .orderBy(desc(conversations.updated_at))
    .limit(1);
  if (activeRows[0]?.id) return activeRows[0].id;

  const legacyRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      sql`${conversations.platform_info} @> ${probeJson}::jsonb
        AND COALESCE((${conversations.platform_info}->>'origin_active')::boolean, false) IS NOT TRUE
        AND (${conversations.platform_info}->>'origin_active') IS NULL`,
    )
    .orderBy(desc(conversations.updated_at))
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
    .where(sql`${conversations.platform_info} @> ${JSON.stringify(probe)}::jsonb`)
    .orderBy(desc(conversations.updated_at));
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
      sql`${conversations.updated_at} >= ${fromIso}::timestamptz
        AND ${conversations.updated_at} < ${toIso}::timestamptz
        AND ${conversations.debug} = false
        AND COALESCE(${conversations.platform_info}->>'platform', '') <> 'cron'`,
    )
    .orderBy(desc(conversations.updated_at));
  return rows.map((r) => r.id);
}

/** Earliest non-debug conversation CST calendar day YYYY-MM-DD */
export async function getEarliestConversationDay(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({
      day: sql<string | null>`to_char(
        (MIN(${conversations.created_at}) AT TIME ZONE 'Asia/Shanghai')::date,
        'YYYY-MM-DD'
      )`,
    })
    .from(conversations)
    .where(eq(conversations.debug, false));
  const day = rows[0]?.day?.trim();
  return day || null;
}
