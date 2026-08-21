import { randomPublicId } from "@freeanima/shared/util";

import { omitUndefined } from "@freeanima/habitat/core/util";
import { parsePublicOrigin, resolveNotificationRecipients } from "@freeanima/habitat/core/config";
import {
  countUnreadConversations,
  getConversationLastReadPos,
  getLastMessageRole,
  getMaxMessagePos,
  markConversationRead,
} from "@freeanima/habitat/core/db/pg/conversation";
import { getConversationUpdatedAt } from "@freeanima/habitat/core/db/pg/conversation/repos/conversation-repo.ts";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";
import { type RemoteToolsRequestContext } from "../../protocol/index.ts";
import { loadLlmDebugCache } from "../llm-debug-cache.ts";
import { chatMethodDefs } from "../method-defs.ts";
import { handleChatAttachmentUpload } from "../binary.ts";
import { chatSessionPumps } from "../session-pumps.ts";
import {
  attachStreamSession,
  pumpContinueStream,
  pumpInboxUpdates,
  pumpMessageStream,
  pumpSessionUpdates,
  resolveConversationPlatform,
} from "../stream.ts";
import { streamSessionRegistry } from "../stream-session-registry.ts";
import { sweepExpiredChatAttachmentTemps } from "../../domain/attachment-temp.ts";
import {
  buildConversationSharePublicUrl,
  conversationShareUrlPath,
  deleteConversationShare,
  filterDisplayByPosList,
  getConversationShare,
  listConversationShares,
  newConversationShareId,
  putConversationShare,
  ttlSecondsFor,
} from "../../domain/conversation-share.ts";
import { buildMessagesDisplay } from "@freeanima/habitat/platform/service/build-messages-display.ts";

sweepExpiredChatAttachmentTemps();

type ChatHubDeps = RemoteToolsServerDeps;

function depsOf(deps: unknown): ChatHubDeps {
  return asRouteDeps<ChatHubDeps>(deps);
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return asRouteCtx<RemoteToolsRequestContext>(ctx);
}

function readConfiguredPublicOrigin(deps: ChatHubDeps): string | undefined {
  const section = deps.runtime.getConfig().config.public;
  if (section == null || typeof section !== "object" || Array.isArray(section)) {
    return undefined;
  }
  const origin = (section as { origin?: unknown }).origin;
  return typeof origin === "string" ? parsePublicOrigin(origin) : undefined;
}

function resolveUserSubjectId(deps: ChatHubDeps): number {
  return resolveNotificationRecipients(deps.runtime.runtimeDeps().engine.config.data).user.id;
}

async function loadServiceSessions() {
  return import("@freeanima/habitat/platform/service/service-conversations");
}

async function loadServiceStatus() {
  return import("@freeanima/habitat/platform/service/service-status");
}

export const chatHabitatRoutes = bindHabitatRouteHandlers(chatMethodDefs, {
  "conversation.create": async (deps, input, _ctx) => {
    const platform = input.platform?.trim() || "chat";
    const platformExtra: Record<string, unknown> = {};
    if (input.workspace_root) platformExtra.workspace_root = input.workspace_root;
    if (input.workspace_gitignore !== undefined) {
      platformExtra.workspace_gitignore = input.workspace_gitignore;
    }
    if (input.workspace_show_hidden !== undefined) {
      platformExtra.workspace_show_hidden = input.workspace_show_hidden;
    }
    if (input.project_world_id !== undefined) {
      platformExtra.project_world_id = input.project_world_id;
    }
    if (platform === "coding" || platform === "companion") {
      const outpostAppId = input.outpost_app_id?.trim() || platform;
      const outpostInstanceId = input.outpost_instance_id?.trim();
      if (outpostAppId) platformExtra.outpost_app_id = outpostAppId;
      if (outpostInstanceId) platformExtra.outpost_instance_id = outpostInstanceId;
    }
    const scenario = input.scenario ?? (platform === "coding" ? "coding_agent" : "digital_human");
    const sid = await depsOf(deps).runtime.conversation.newConversation(
      platform,
      undefined,
      Object.keys(platformExtra).length > 0 ? platformExtra : undefined,
      scenario,
      input.agent_subject_id,
    );
    if (input.title?.trim()) {
      await depsOf(deps).runtime.setConversationTitle(sid, input.title.trim(), platform);
    }
    return { conversation_id: sid };
  },
  "conversation.setAgent": async (deps, input) => {
    await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const result = await depsOf(deps).runtime.conversation.setConversationAgent(
      input.conversation_id,
      input.agent_subject_id,
    );
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const, agent_subject_id: result.agent_subject_id };
  },
  "conversation.list": async (deps, input, _ctx) => {
    const platform = input.platform?.trim() || undefined;
    const serviceSessions = await loadServiceSessions();
    const user_subject_id = resolveUserSubjectId(depsOf(deps));
    const result = await serviceSessions.listConversations(
      depsOf(deps).runtime.runtimeDeps(),
      platform ?? null,
      omitUndefined({
        includeArchived: input.include_archived,
        offset: input.offset,
        limit: input.limit,
        user_subject_id,
      }),
    );
    return {
      conversations: result.conversations.map((s) =>
        omitUndefined({
          conversation_id: s.id,
          title: s.title,
          platform: s.platform,
          updated_at: s.updated_at.toISOString(),
          archived_at: s.archived_at?.toISOString() ?? null,
          pinned_at: s.pinned_at?.toISOString() ?? null,
          unread: s.unread === true ? true : s.unread === false ? false : undefined,
          agent_subject_id: s.agent_subject_id,
        }),
      ),
    };
  },
  "conversation.markRead": async (deps, input) => {
    await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const subject_id = resolveUserSubjectId(depsOf(deps));
    const before = await getConversationLastReadPos(input.conversation_id, subject_id);
    const result = await markConversationRead(
      omitUndefined({
        conversation_id: input.conversation_id,
        subject_id,
        last_read_pos: input.last_read_pos,
      }),
    );
    if (result.last_read_pos > before) {
      depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    }
    return { ok: true as const, last_read_pos: result.last_read_pos };
  },
  "conversation.unreadCount": async (deps, input) => {
    const subject_id = resolveUserSubjectId(depsOf(deps));
    const platform = input.platform?.trim() || undefined;
    const count = await countUnreadConversations(subject_id, platform ? { platform } : undefined);
    return { count };
  },
  "conversation.messages": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const messages = await depsOf(deps).runtime.getMessages(
      input.conversation_id,
      platform,
      omitUndefined({
        offset: input.offset,
        limit: input.limit,
        before_pos: input.before_pos,
      }),
    );
    return messages;
  },
  "conversation.tail": async (deps, input) => {
    await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const tail_pos = await getMaxMessagePos(input.conversation_id);
    const tail_role = (await getLastMessageRole(input.conversation_id)) ?? undefined;
    const updatedAt = await getConversationUpdatedAt(input.conversation_id);
    const updated_at = updatedAt?.toISOString();
    return omitUndefined({
      tail_pos,
      tail_role,
      updated_at,
    });
  },
  "conversation.patchTitle": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.setConversationTitle(input.conversation_id, input.title, platform);
    return { ok: true as const };
  },
  "conversation.archive": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.archiveConversation(input.conversation_id, platform);
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const };
  },
  "conversation.unarchive": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.unarchiveConversation(input.conversation_id, platform);
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const };
  },
  "conversation.pin": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.pinConversation(input.conversation_id, platform);
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const };
  },
  "conversation.unpin": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.unpinConversation(input.conversation_id, platform);
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const };
  },
  "conversation.delete": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.deleteConversation(input.conversation_id, platform);
    depsOf(deps).runtime.emitSessionUpdated(input.conversation_id);
    return { ok: true as const };
  },
  "conversation.rollbackBeforeLastUser": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.rollbackBeforeLastUser(input.conversation_id, platform);
    return { ok: true as const };
  },
  "conversation.subscribe": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const sessionPumps = chatSessionPumps();
    const pumpKey = `${sapCtx.app_id}:${sapCtx.instance_id}:${input.conversation_id}`;
    if (!sessionPumps.has(pumpKey)) {
      const controller = new AbortController();
      sessionPumps.set(pumpKey, controller);
      void pumpSessionUpdates(
        depsOf(deps),
        sapCtx,
        input.conversation_id,
        controller.signal,
      ).finally(() => {
        sessionPumps.delete(pumpKey);
      });
    }
    return { ok: true as const };
  },
  "conversation.subscribeInbox": async (deps, _input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const sessionPumps = chatSessionPumps();
    const pumpKey = `${sapCtx.app_id}:${sapCtx.instance_id}:inbox`;
    if (!sessionPumps.has(pumpKey)) {
      const controller = new AbortController();
      sessionPumps.set(pumpKey, controller);
      void pumpInboxUpdates(depsOf(deps), sapCtx, controller.signal).finally(() => {
        sessionPumps.delete(pumpKey);
      });
    }
    return { ok: true as const };
  },
  "conversation.commands": async (_deps, input, _ctx) => {
    const platform = input.platform?.trim() || undefined;
    const serviceStatus = await loadServiceStatus();
    return serviceStatus.listCommands(
      omitUndefined({
        platform: input.all ? undefined : platform,
        all: input.all,
      }),
    );
  },
  "conversation.command": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    return depsOf(deps).runtime.runConversationCommand(
      omitUndefined({
        conversation_id: input.conversation_id,
        text: input.text,
        platform,
        origin_extra: {
          app_id: sapCtx.app_id,
          instance_id: sapCtx.instance_id,
        },
      }),
    );
  },
  "conversation.share.create": async (deps, input) => {
    await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const conv = depsOf(deps).runtime.runtimeDeps().conversation;
    if (!(await conv.conversationExists(input.conversation_id))) {
      throw new Error(`Conversation not found: ${input.conversation_id}`);
    }
    const messages = await conv.load(input.conversation_id);
    const displayFull = buildMessagesDisplay(messages);
    const posList = input.pos_list;
    const scope = posList?.length ? ("selected" as const) : ("full" as const);
    const display =
      scope === "selected" && posList ? filterDisplayByPosList(displayFull, posList) : displayFull;
    if (display.length === 0) {
      throw new Error("没有可分享的消息");
    }
    const ttl = input.ttl ?? "1h";
    const ttlSeconds = ttlSecondsFor(ttl);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
    const title = (await conv.getConversationTitle(input.conversation_id)) || undefined;
    const id = newConversationShareId();
    const ok = await putConversationShare(
      id,
      omitUndefined({
        conversation_id: input.conversation_id,
        scope,
        title,
        display,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      }),
      ttlSeconds,
    );
    if (!ok) {
      throw new Error("临时分享需要 Redis，当前未配置或写入失败");
    }
    const publicOrigin = readConfiguredPublicOrigin(depsOf(deps));
    return omitUndefined({
      id,
      expires_at: expiresAt.toISOString(),
      url_path: conversationShareUrlPath(id),
      url: publicOrigin ? buildConversationSharePublicUrl(id, publicOrigin) : undefined,
    });
  },
  "conversation.share.get": async (_deps, input) => {
    const snapshot = await getConversationShare(input.id);
    if (!snapshot) {
      throw new Error("分享链接已失效或不存在");
    }
    return omitUndefined({
      id: input.id,
      conversation_id: snapshot.conversation_id,
      scope: snapshot.scope,
      title: snapshot.title,
      display: snapshot.display,
      created_at: snapshot.created_at,
      expires_at: snapshot.expires_at,
    });
  },
  "conversation.share.list": async (deps) => {
    const publicOrigin = readConfiguredPublicOrigin(depsOf(deps));
    const items = await listConversationShares();
    return {
      items: items.map((item) =>
        omitUndefined({
          ...item,
          url: publicOrigin ? buildConversationSharePublicUrl(item.id, publicOrigin) : undefined,
        }),
      ),
    };
  },
  "conversation.share.delete": async (_deps, input) => {
    const existing = await getConversationShare(input.id);
    if (!existing) {
      throw new Error("分享链接已失效或不存在");
    }
    const ok = await deleteConversationShare(input.id);
    if (!ok) {
      throw new Error("删除失败：Redis 未配置或写入失败");
    }
    return { ok: true as const };
  },
  "message.send": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);

    // 弱网重复投递：已有进行中 stream 则复用 stream_id，不新开 pump
    if (input.client_op_id) {
      const existing = streamSessionRegistry.findByClientOpId(input.client_op_id);
      if (existing && existing.status === "active") {
        return { stream_id: existing.stream_id };
      }
    }

    const streamId = randomPublicId();
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    streamSessionRegistry.openSession(
      streamId,
      input.conversation_id,
      omitUndefined({ client_op_id: input.client_op_id }),
    );
    void pumpMessageStream(
      depsOf(deps),
      sapCtx,
      streamId,
      input.conversation_id,
      input.message,
      platform,
      omitUndefined({
        llm_debug: input.llm_debug,
        client_op_id: input.client_op_id,
        expected_tail_pos: input.expected_tail_pos,
        force_tail: input.force_tail,
        attachment_temp_ids: input.attachment_temp_ids,
        attachments: input.attachments,
      }),
    );
    return { stream_id: streamId };
  },
  "message.continue": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const streamId = randomPublicId();
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    streamSessionRegistry.openSession(streamId, input.conversation_id);
    void pumpContinueStream(
      depsOf(deps),
      sapCtx,
      streamId,
      input.conversation_id,
      platform,
      omitUndefined({ llm_debug: input.llm_debug }),
    );
    return { stream_id: streamId };
  },
  "chat.attachment.upload": async (_deps, input, ctx) =>
    handleChatAttachmentUpload(_deps, input, ctxOf(ctx)),
  "message.interrupt": async (deps, input) => {
    depsOf(deps).runtime.interruptSessionStream(input.conversation_id);
    return { ok: true as const };
  },
  "stream.attach": async (_deps, input, ctx) => {
    return attachStreamSession(ctxOf(ctx), input.stream_id);
  },
  "stream.lookup": async (_deps, input) => {
    const session = streamSessionRegistry.findByConversationId(input.conversation_id);
    // 仅进行中：done 仍在 TTL 内时不应在打开会话时误触发 resume 重放
    if (!session || session.status !== "active") return {};
    return { stream_id: session.stream_id, status: session.status };
  },
  "llm_debug.get": async (_deps, input) => {
    const cached = await loadLlmDebugCache(input.conversation_id);
    if (!cached) return {};
    return {
      ...(cached.initial ? { initial: cached.initial } : {}),
      ...(cached.final ? { final: cached.final } : {}),
      ...(cached.updated_at ? { updated_at: cached.updated_at } : {}),
    };
  },
});
