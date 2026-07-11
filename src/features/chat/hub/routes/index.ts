import { randomUUID } from "node:crypto";
import { z } from "zod";

import { omitUndefined } from "@freeanima/core/util";
import { getLastMessageRole, getMaxMessagePos } from "@freeanima/core/db/pg/conversation";
import { getConversationUpdatedAt } from "@freeanima/core/db/pg/conversation/repos/conversation-repo.ts";
import type { SapServerDeps } from "@freeanima/platform/sap/types";
import { dualTransportMeta, wsOnlyMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
} from "@freeanima/shared/sap-contract/frames/acp";
import {
  conversationArchiveInputSchema,
  conversationCommandsInputSchema,
  conversationCommandsOutputSchema,
  conversationCreateInputSchema,
  conversationCreateOutputSchema,
  conversationDeleteInputSchema,
  conversationListInputSchema,
  conversationListOutputSchema,
  conversationMessagesInputSchema,
  conversationMutateOutputSchema,
  conversationPatchTitleInputSchema,
  conversationSubscribeInputSchema,
  conversationTailInputSchema,
  conversationTailOutputSchema,
  conversationUnarchiveInputSchema,
} from "@freeanima/shared/sap-contract/frames/conversation";
import {
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageSendInputSchema,
  messageSendOutputSchema,
} from "@freeanima/shared/sap-contract/frames/message";
import type { SapRouterOutputs } from "@freeanima/shared/sap-contract";
import {
  formatSapPlatform,
  normalizeAppSlug,
  type SapRequestContext,
} from "../../protocol/index.ts";
import { chatSessionPumps } from "../session-pumps.ts";
import { pumpMessageStream, pumpSessionUpdates, resolveConversationPlatform } from "../stream.ts";

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

const conversationMessagesOutputSchema = z.record(z.string(), z.unknown());
const conversationPatchTitleOutputSchema = z.object({ ok: z.literal(true) });
const conversationSubscribeOutputSchema = z.object({ ok: z.literal(true) });

const routes = [
  defineHubRoute({
    method: "conversation.create",
    input: conversationCreateInputSchema,
    output: conversationCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) => {
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
  }),
  defineHubRoute({
    method: "conversation.list",
    input: conversationListInputSchema,
    output: conversationListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const platform = input.platform ?? formatSapPlatform(sapCtx.app_id, sapCtx.instance_id);
      const serviceSessions = await loadServiceSessions();
      const result = await serviceSessions.listConversations(
        depsOf(deps).runtime.runtimeDeps(),
        platform ?? null,
        omitUndefined({ includeArchived: input.include_archived }),
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
  }),
  defineHubRoute({
    method: "conversation.messages",
    input: conversationMessagesInputSchema,
    output: conversationMessagesOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      const messages = await depsOf(deps).runtime.getMessages(
        input.conversation_id,
        platform,
        omitUndefined({
          offset: input.offset,
          limit: input.limit,
        }),
      );
      return messages as SapRouterOutputs["conversation.messages"];
    },
  }),
  defineHubRoute({
    method: "conversation.tail",
    input: conversationTailInputSchema,
    output: conversationTailOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) => {
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
  }),
  defineHubRoute({
    method: "conversation.patchTitle",
    input: conversationPatchTitleInputSchema,
    output: conversationPatchTitleOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      await depsOf(deps).runtime.setConversationTitle(input.conversation_id, input.title, platform);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "conversation.archive",
    input: conversationArchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      await depsOf(deps).runtime.archiveConversation(input.conversation_id, platform);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "conversation.unarchive",
    input: conversationUnarchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      await depsOf(deps).runtime.unarchiveConversation(input.conversation_id, platform);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "conversation.delete",
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      await depsOf(deps).runtime.deleteConversation(input.conversation_id, platform);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "conversation.rollbackBeforeLastUser",
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      await depsOf(deps).runtime.rollbackBeforeLastUser(input.conversation_id, platform);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "conversation.subscribe",
    input: conversationSubscribeInputSchema,
    output: conversationSubscribeOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
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
  }),
  defineHubRoute({
    method: "conversation.acpDock",
    input: sessionAcpDockInputSchema,
    output: sessionAcpDockOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) => {
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
      const serviceAcpDock = await loadServiceAcpDock();
      return serviceAcpDock.getConversationAcpDock(
        depsOf(deps).runtime.runtimeDeps(),
        input.conversation_id,
        platform,
      );
    },
  }),
  defineHubRoute({
    method: "conversation.commands",
    input: conversationCommandsInputSchema,
    output: conversationCommandsOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (_deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const platform = input.platform ?? formatSapPlatform(sapCtx.app_id, sapCtx.instance_id);
      const serviceStatus = await loadServiceStatus();
      return serviceStatus.listCommands(
        omitUndefined({
          platform: input.all ? undefined : platform,
          all: input.all,
        }),
      );
    },
  }),
  defineHubRoute({
    method: "message.send",
    input: messageSendInputSchema,
    output: messageSendOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const streamId = randomUUID();
      const platform = await resolveConversationPlatform(depsOf(deps), input.conversation_id);
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
  }),
  defineHubRoute({
    method: "message.interrupt",
    input: messageInterruptInputSchema,
    output: messageInterruptOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      depsOf(deps).runtime.interruptSessionStream(input.conversation_id);
      return { ok: true as const };
    },
  }),
] as const;

export const chatHubRoutes = mergeFeatureRoutes(routes);
