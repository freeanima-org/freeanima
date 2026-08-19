import { omitUndefined } from "@freeanima/habitat/core/util";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { canonicalizeConversationPlatform } from "@freeanima/shared/pg-shapes/jsonb/platform-info";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { resolveDefaultConversationToolSets } from "@freeanima/habitat/core/tool";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import type { CommandResult } from "@freeanima/habitat/capabilities/tools/slash-commands";
import type { MessagesDisplay } from "@freeanima/habitat/platform/schemas/display";
import type { ConversationSummary } from "@freeanima/habitat/platform/schemas/snapshot";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { buildMessagesDisplay } from "./build-messages-display.ts";
import { statsReport, billedUsageFromStats, computeStats } from "./conversation-stats.ts";
import { computeConversationContextUsage } from "./runtime-context-stats.ts";
import { sumConversationUsage } from "@freeanima/habitat/core/db/pg/conversation";
import { originLockKey, runExclusiveOrigin } from "./origin-lock.ts";

export async function resolveMessagingPlatform(
  deps: RuntimeDeps,
  conversationId: string,
  platform?: string,
): Promise<string> {
  const explicit = platform?.trim();
  if (explicit) return canonicalizeConversationPlatform(explicit);
  const meta = await deps.conversation.loadConversationMeta(conversationId);
  const fromMeta = isConversationMeta(meta) ? meta.platform : undefined;
  return canonicalizeConversationPlatform(fromMeta);
}

export async function checkPlatform(
  deps: RuntimeDeps,
  params: { platform?: string },
  sid: string,
): Promise<void> {
  const platform = (params.platform ?? "").trim();
  if (platform) await deps.conversation.assertConversationPlatform(sid, platform);
}

const DEFAULT_CONVERSATION_LIST_LIMIT = 200;

export async function listConversations(
  deps: RuntimeDeps,
  platform?: string | null,
  opts?: {
    offset?: number;
    limit?: number;
    includeArchived?: boolean;
    user_subject_id?: string;
  },
): Promise<{ conversations: ConversationSummary[]; total: number }> {
  const p = platform === "" ? null : platform;
  // 始终走分页 API，禁止无界全表拉取
  const page = await deps.conversation.listConversationSummariesPage(
    omitUndefined({
      platform: p ?? undefined,
      offset: opts?.offset ?? 0,
      limit: opts?.limit ?? DEFAULT_CONVERSATION_LIST_LIMIT,
      includeArchived: opts?.includeArchived,
      user_subject_id: opts?.user_subject_id,
    }),
  );
  return { conversations: page.items, total: page.total };
}

export async function createConversation(
  deps: RuntimeDeps,
  platform: string,
): Promise<{ conversation_id: string }> {
  const p = platform.trim();
  if (!p) throw new Error("platform is required");
  const sid = await deps.conversation.newConversation(p);
  return { conversation_id: sid };
}

export async function findOrCreateConversation(
  deps: RuntimeDeps,
  platform: string,
  platform_extra: Record<string, unknown> = {},
): Promise<{ conversation_id: string }> {
  const key = originLockKey(platform, platform_extra);
  return runExclusiveOrigin(key, async () => {
    let sid = await deps.conversation.findConversationByOrigin(platform, platform_extra);
    if (!sid) {
      sid = await deps.conversation.newConversation(platform, undefined, platform_extra);
      await deps.conversation.activateConversationOrigin(sid);
    } else {
      await deps.conversation.refreshSystemPromptOnResume(sid);
    }
    return { conversation_id: sid };
  });
}

export async function patchConversationOrigin(
  deps: RuntimeDeps,
  conversation_id: string,
  platform: string,
  platform_extra?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  await deps.conversation.patchConversationOrigin(conversation_id, platform, platform_extra);
  return { ok: true };
}

export async function applyCommandConversationEffects(
  deps: RuntimeDeps,
  result: CommandResult,
  _conversationId: string,
  platform: string,
  originExtra?: Record<string, unknown>,
): Promise<void> {
  const data = result.data as { new_conversation_id?: string } | undefined;
  if (data?.new_conversation_id && originExtra !== undefined) {
    await deps.conversation.patchConversationOrigin(
      data.new_conversation_id,
      platform,
      originExtra,
    );
    await deps.conversation.activateConversationOrigin(data.new_conversation_id);
  }
}

export async function getConversationInfo(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<Record<string, unknown>> {
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await checkPlatform(deps, { platform }, conversationId);
  const [statsText, stats] = await Promise.all([
    statsReport(deps, conversationId),
    computeStats(deps, conversationId),
  ]);
  return {
    conversation_id: conversationId,
    stats: statsText,
    usage: billedUsageFromStats(stats),
  };
}

export async function getMessages(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
  opts?: { offset?: number; limit?: number | null; before_pos?: number },
): Promise<MessagesDisplay> {
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await checkPlatform(deps, { platform }, conversationId);
  const limit = Math.max(1, opts?.limit ?? 500);
  const total = await deps.conversation.countMessages(conversationId);

  let page: StoredMessage[];
  let offset: number;

  if (opts?.before_pos != null) {
    page = await deps.conversation.loadMessagesBeforePos(conversationId, opts.before_pos, limit);
    offset = 0;
  } else if (opts?.offset != null) {
    offset = Math.max(0, opts.offset);
    page = await deps.conversation.loadMessagePage(conversationId, offset, limit);
  } else {
    // Chat 首屏：尾页（最近 limit 条）
    offset = Math.max(0, total - limit);
    page = await deps.conversation.loadMessagePage(conversationId, offset, limit);
  }

  page = await expandLeadingToolBoundary(deps, conversationId, page);

  if (opts?.offset == null) {
    // 尾页 / before_pos：扩窗后按窗口长度回写 offset（Habitat 显式 offset 保持原值）
    offset = Math.max(0, total - page.length);
  }

  const from_pos = pageMinPos(page);
  const to_pos = pageMaxPos(page);
  const has_more_before =
    from_pos != null
      ? (await deps.conversation.loadMessagesBeforePos(conversationId, from_pos, 1)).length > 0
      : false;

  const full = buildMessagesDisplay(page);
  const usage = await sumConversationUsage(conversationId);
  let context: MessagesDisplay["context"];
  if (opts?.before_pos == null) {
    try {
      context = await computeConversationContextUsage(deps, conversationId);
    } catch {
      context = undefined;
    }
  }
  return omitUndefined({
    conversation_id: conversationId,
    display: full,
    total,
    offset,
    limit,
    from_pos: from_pos ?? undefined,
    to_pos: to_pos ?? undefined,
    has_more_before,
    usage,
    context,
  });
}

function pageMinPos(page: StoredMessage[]): number | null {
  let min: number | null = null;
  for (const m of page) {
    if (typeof m.pos !== "number") continue;
    if (min == null || m.pos < min) min = m.pos;
  }
  return min;
}

function pageMaxPos(page: StoredMessage[]): number | null {
  let max: number | null = null;
  for (const m of page) {
    if (typeof m.pos !== "number") continue;
    if (max == null || m.pos > max) max = m.pos;
  }
  return max;
}

/** 页首若为孤立 tool 行，向更早扩窗直到非 tool 或会话起点 */
async function expandLeadingToolBoundary(
  deps: RuntimeDeps,
  conversationId: string,
  page: StoredMessage[],
): Promise<StoredMessage[]> {
  const out = [...page];
  while (out.length > 0 && out[0]?.role === "tool") {
    const pos = out[0].pos;
    if (typeof pos !== "number") break;
    const prev = await deps.conversation.loadMessagesBeforePos(conversationId, pos, 1);
    const prevMsg = prev[0];
    if (!prevMsg) break;
    out.unshift(prevMsg);
  }
  return out;
}

export async function setConversationTitle(
  deps: RuntimeDeps,
  conversationId: string,
  title: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  await deps.conversation.setConversationTitle(conversationId, title.slice(0, 50));
  return { ok: true };
}

export async function archiveConversation(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.archiveConversation(conversationId);
  return { ok: true };
}

export async function unarchiveConversation(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.unarchiveConversation(conversationId);
  return { ok: true };
}

export async function pinConversation(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.pinConversation(conversationId);
  return { ok: true };
}

export async function unpinConversation(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.unpinConversation(conversationId);
  return { ok: true };
}

export async function deleteConversation(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.deleteUserConversation(conversationId);
  return { ok: true };
}

export async function rollbackBeforeLastUser(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<{ ok: boolean }> {
  await checkPlatform(deps, { platform }, conversationId);
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await deps.conversation.rollbackBeforeLastUser(conversationId);
  return { ok: true };
}

export async function appendConversationMetaForEngine(
  deps: RuntimeDeps,
  conversationId: string,
): Promise<void> {
  const cfg = deps.engine.config.data;
  const toolSets = deps.engine.catalog.toolSets;
  const names = resolveDefaultConversationToolSets(toolSets);
  await deps.conversation.appendConversationMeta(
    conversationId,
    names,
    getProfileHopModel(cfg, PROFILE_CHAT),
    {},
  );
}
