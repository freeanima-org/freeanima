import { randomUUID } from "node:crypto";
import { omitUndefined } from "@freeanima/core/util";
import { getLastMessageRole, getMaxMessagePos } from "@freeanima/core/db/pg/conversation";
import { getConversationUpdatedAt } from "@freeanima/core/db/pg/conversation/repos/conversation-repo.ts";
import type { SapServerDeps } from "@freeanima/platform/sap/types";
import {
  conversationArchiveInputSchema,
  conversationCommandsInputSchema,
  conversationCreateInputSchema,
  conversationDeleteInputSchema,
  conversationListInputSchema,
  conversationMessagesInputSchema,
  conversationPatchTitleInputSchema,
  conversationSubscribeInputSchema,
  conversationTailInputSchema,
  conversationUnarchiveInputSchema,
  messageInterruptInputSchema,
  messageSendInputSchema,
  sessionAcpDockInputSchema,
  formatSapPlatform,
  normalizeAppSlug,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { SapRouterOutputs } from "@freeanima/shared/sap-contract";
import { chatSessionPumps } from "./session-pumps.ts";
import { pumpMessageStream, pumpSessionUpdates, resolveConversationPlatform } from "./stream.ts";

export type ChatHubDeps = SapServerDeps;

async function loadServiceSessions() {
  return import("@freeanima/platform/runtime/service-conversations");
}

async function loadServiceAcpDock() {
  return import("@freeanima/platform/runtime/service-acp-dock");
}

async function loadServiceStatus() {
  return import("@freeanima/platform/runtime/service-status");
}

export async function handleConversationCreate(
  deps: ChatHubDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = conversationCreateInputSchema.parse(payload);
  const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
  const platformExtra: Record<string, unknown> = {};
  if (ctx.app_id.trim() && ctx.instance_id.trim()) {
    platformExtra.satellite_app_id = normalizeAppSlug(ctx.app_id);
    platformExtra.satellite_instance_id = ctx.instance_id;
  }
  if (input.workspace_root) platformExtra.workspace_root = input.workspace_root;
  if (input.workspace_gitignore !== undefined) {
    platformExtra.workspace_gitignore = input.workspace_gitignore;
  }
  if (input.workspace_show_hidden !== undefined) {
    platformExtra.workspace_show_hidden = input.workspace_show_hidden;
  }
  if (input.capability_mask) {
    platformExtra.capability_mask = input.capability_mask;
  }
  const sid = await deps.runtime.conversation.newConversation(platform, undefined, platformExtra);
  if (input.title?.trim()) {
    await deps.runtime.setConversationTitle(sid, input.title.trim(), platform);
  }
  return { conversation_id: sid };
}

export async function handleConversationList(
  deps: ChatHubDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = conversationListInputSchema.parse(payload);
  const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
  const serviceSessions = await loadServiceSessions();
  const result = await serviceSessions.listConversations(
    deps.runtime.runtimeDeps(),
    platform ?? null,
    omitUndefined({ includeArchived: input.include_archived }),
  );
  return {
    conversations: result.conversations.map((s) => ({
      conversation_id: s.id,
      title: s.title,
      platform: s.platform,
      updated_at: s.updated_at,
      archived_at: s.archived_at ?? null,
    })),
  };
}

export async function handleConversationMessages(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationMessagesInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  const messages = await deps.runtime.getMessages(
    input.conversation_id,
    platform,
    omitUndefined({
      offset: input.offset,
      limit: input.limit,
    }),
  );
  return messages as SapRouterOutputs["conversation.messages"];
}

export async function handleConversationTail(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationTailInputSchema.parse(payload);
  await resolveConversationPlatform(deps, input.conversation_id);
  const tail_pos = await getMaxMessagePos(input.conversation_id);
  const tail_role = (await getLastMessageRole(input.conversation_id)) ?? undefined;
  const updatedAt = await getConversationUpdatedAt(input.conversation_id);
  const updated_at = updatedAt?.toISOString();
  return omitUndefined({
    tail_pos,
    tail_role,
    updated_at,
  });
}

export async function handleConversationPatchTitle(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationPatchTitleInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  await deps.runtime.setConversationTitle(input.conversation_id, input.title, platform);
  return { ok: true as const };
}

export async function handleConversationArchive(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationArchiveInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  await deps.runtime.archiveConversation(input.conversation_id, platform);
  return { ok: true as const };
}

export async function handleConversationUnarchive(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationUnarchiveInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  await deps.runtime.unarchiveConversation(input.conversation_id, platform);
  return { ok: true as const };
}

export async function handleConversationDelete(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationDeleteInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  await deps.runtime.deleteConversation(input.conversation_id, platform);
  return { ok: true as const };
}

export async function handleConversationRollbackBeforeLastUser(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = conversationDeleteInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  await deps.runtime.rollbackBeforeLastUser(input.conversation_id, platform);
  return { ok: true as const };
}

export async function handleConversationSubscribe(
  deps: ChatHubDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = conversationSubscribeInputSchema.parse(payload);
  const sessionPumps = chatSessionPumps();
  const pumpKey = `${ctx.app_id}:${ctx.instance_id}:${input.conversation_id}`;
  if (!sessionPumps.has(pumpKey)) {
    const controller = new AbortController();
    sessionPumps.set(pumpKey, controller);
    void pumpSessionUpdates(deps, ctx, input.conversation_id, controller.signal).finally(() => {
      sessionPumps.delete(pumpKey);
    });
  }
  return { ok: true as const };
}

export async function handleConversationAcpDock(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = sessionAcpDockInputSchema.parse(payload);
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  const serviceAcpDock = await loadServiceAcpDock();
  return serviceAcpDock.getConversationAcpDock(
    deps.runtime.runtimeDeps(),
    input.conversation_id,
    platform,
  );
}

export async function handleConversationCommands(
  _deps: ChatHubDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = conversationCommandsInputSchema.parse(payload);
  const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
  const serviceStatus = await loadServiceStatus();
  return serviceStatus.listCommands(
    omitUndefined({
      platform: input.all ? undefined : platform,
      all: input.all,
    }),
  );
}

export async function handleMessageSend(
  deps: ChatHubDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = messageSendInputSchema.parse(payload);
  const streamId = randomUUID();
  const platform = await resolveConversationPlatform(deps, input.conversation_id);
  void pumpMessageStream(
    deps,
    ctx,
    streamId,
    input.conversation_id,
    input.message,
    platform,
    omitUndefined({
      llm_debug: input.llm_debug,
      client_op_id: input.client_op_id,
      expected_tail_pos: input.expected_tail_pos,
      force_tail: input.force_tail,
    }),
  );
  return { stream_id: streamId };
}

export async function handleMessageInterrupt(
  deps: ChatHubDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = messageInterruptInputSchema.parse(payload);
  deps.runtime.interruptSessionStream(input.conversation_id);
  return { ok: true as const };
}
