import { randomUUID } from "node:crypto";

import { omitUndefined } from "@freeanima/core/util";
import { getLastMessageRole, getMaxMessagePos } from "@freeanima/core/db/pg/conversation";
import { getConversationUpdatedAt } from "@freeanima/core/db/pg/conversation/repos/conversation-repo.ts";
import type { SapServerDeps } from "@freeanima/platform/sap/types";
import { bindHubRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";
import type { SapRouterOutputs } from "@freeanima/shared/sap-contract";
import {
  formatSapPlatform,
  normalizeAppSlug,
  resolveDefaultSapPlatform,
  type SapRequestContext,
} from "../../protocol/index.ts";
import { loadLlmDebugCache } from "../llm-debug-cache.ts";
import { chatMethodDefs } from "../method-defs.ts";
import { chatSessionPumps } from "../session-pumps.ts";
import {
  attachStreamSession,
  pumpMessageStream,
  pumpSessionUpdates,
  resolveConversationPlatform,
} from "../stream.ts";
import { streamSessionRegistry } from "../stream-session-registry.ts";

type ChatHubDeps = SapServerDeps;

function depsOf(deps: unknown): ChatHubDeps {
  return deps as ChatHubDeps;
}

function ctxOf(ctx: unknown): SapRequestContext {
  return ctx as SapRequestContext;
}

async function loadServiceSessions() {
  return import("@freeanima/platform/runtime/service-conversations");
}

async function loadServiceAcpDock() {
  return import("@freeanima/platform/runtime/service-acp-dock");
}

async function loadServiceStatus() {
  return import("@freeanima/platform/runtime/service-status");
}

export const chatHubRoutes = bindHubRouteHandlers(chatMethodDefs, {
  "conversation.create": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const platform = input.platform ?? formatSapPlatform(sapCtx.app_id, sapCtx.instance_id);
    const platformExtra: Record<string, unknown> = {};
    if (sapCtx.app_id.trim() && sapCtx.instance_id.trim()) {
      platformExtra.satellite_app_id = normalizeAppSlug(sapCtx.app_id);
      platformExtra.satellite_instance_id = sapCtx.instance_id;
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
    const sid = await depsOf(deps).runtime.conversation.newConversation(
      platform,
      undefined,
      platformExtra,
    );
    if (input.title?.trim()) {
      await depsOf(deps).runtime.setConversationTitle(sid, input.title.trim(), platform);
    }
    return { conversation_id: sid };
  },
  "conversation.list": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const platform = resolveDefaultSapPlatform(input.platform, sapCtx.app_id, sapCtx.instance_id);
    const serviceSessions = await loadServiceSessions();
    const result = await serviceSessions.listConversations(
      depsOf(deps).runtime.runtimeDeps(),
      platform ?? null,
      omitUndefined({
        includeArchived: input.include_archived,
        offset: input.offset,
        limit: input.limit,
      }),
    );
    return {
      conversations: result.conversations.map((s) => ({
        conversation_id: s.id,
        title: s.title,
        platform: s.platform,
        updated_at: s.updated_at.toISOString(),
        archived_at: s.archived_at?.toISOString() ?? null,
      })),
    };
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
    return messages as SapRouterOutputs["conversation.messages"];
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
    return { ok: true as const };
  },
  "conversation.unarchive": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.unarchiveConversation(input.conversation_id, platform);
    return { ok: true as const };
  },
  "conversation.delete": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    await depsOf(deps).runtime.deleteConversation(input.conversation_id, platform);
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
  "conversation.acpDock": async (deps, input) => {
    const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
    const serviceAcpDock = await loadServiceAcpDock();
    return serviceAcpDock.getConversationAcpDock(
      depsOf(deps).runtime.runtimeDeps(),
      input.conversation_id,
      platform,
    );
  },
  "conversation.commands": async (_deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);
    const platform = resolveDefaultSapPlatform(input.platform, sapCtx.app_id, sapCtx.instance_id);
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
  "message.send": async (deps, input, ctx) => {
    const sapCtx = ctxOf(ctx);

    // 弱网重复投递：已有进行中 stream 则复用 stream_id，不新开 pump
    if (input.client_op_id) {
      const existing = streamSessionRegistry.findByClientOpId(input.client_op_id);
      if (existing && existing.status === "active") {
        return { stream_id: existing.stream_id };
      }
    }

    const streamId = randomUUID();
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
      }),
    );
    return { stream_id: streamId };
  },
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
