import { omitUndefined } from "@freeanima/core/util";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { resolveDefaultConversationToolSets } from "@freeanima/core/tool";
import { getProfileHopModel } from "@freeanima/platform/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import type { CommandResult } from "@freeanima/platform/commands";
import type { MessagesDisplay } from "@freeanima/platform/schemas/display";
import type { ConversationSummary } from "@freeanima/platform/schemas/snapshot";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { buildMessagesDisplay } from "./build-messages-display.ts";
import { statsReport } from "./conversation-stats.ts";
import { originLockKey, runExclusiveOrigin } from "./origin-lock.ts";

export async function resolveMessagingPlatform(
  deps: RuntimeDeps,
  conversationId: string,
  platform?: string,
): Promise<string> {
  const explicit = platform?.trim();
  if (explicit) return explicit;
  const meta = await deps.conversation.loadConversationMeta(conversationId);
  const fromMeta = isConversationMeta(meta) ? meta.platform?.trim() : undefined;
  if (fromMeta) return fromMeta;
  throw new Error(`conversation ${conversationId.slice(0, 16)} has no platform`);
}

export async function checkPlatform(
  deps: RuntimeDeps,
  params: { platform?: string },
  sid: string,
): Promise<void> {
  const platform = (params.platform ?? "").trim();
  if (platform) await deps.conversation.assertConversationPlatform(sid, platform);
}

export async function listConversations(
  deps: RuntimeDeps,
  platform?: string | null,
  opts?: { offset?: number; limit?: number; includeArchived?: boolean },
): Promise<{ conversations: ConversationSummary[]; total: number }> {
  const p = platform === "" ? null : platform;
  if (opts?.offset != null || opts?.limit != null) {
    const page = await deps.conversation.listConversationSummariesPage(
      omitUndefined({
        platform: p ?? undefined,
        offset: opts.offset,
        limit: opts.limit,
        includeArchived: opts.includeArchived,
      }),
    );
    return { conversations: page.items, total: page.total };
  }
  const items = await deps.conversation.listConversationSummaries(
    p ?? undefined,
    omitUndefined({ includeArchived: opts?.includeArchived }),
  );
  return { conversations: items, total: items.length };
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
  return { conversation_id: conversationId, stats: await statsReport(deps, conversationId) };
}

export async function getMessages(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
  opts?: { offset?: number; limit?: number | null },
): Promise<MessagesDisplay> {
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await checkPlatform(deps, { platform }, conversationId);
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.max(1, opts?.limit ?? 500);
  const [total, page] = await Promise.all([
    deps.conversation.countMessages(conversationId),
    deps.conversation.loadMessagePage(conversationId, offset, limit),
  ]);
  const full = buildMessagesDisplay(page);
  return {
    conversation_id: conversationId,
    display: full,
    total,
    offset,
    limit,
  };
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
