import type {
  AcpAsyncTaskSnapshot,
  AcpProgressDeliveryPort,
  AcpPromptResult,
} from "@freeanima/host/capabilities/acp";
import {
  deliverToTargets,
  type CronDeliverTarget,
} from "@freeanima/host/capabilities/connectors/cron/deliver";
import { isConversationMeta } from "@freeanima/host/engine/conversation";
import type { ConversationService } from "@freeanima/host/engine/conversation";
import type { ConversationMetaLoadResult } from "@freeanima/host/core/db/domain";
import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import { conversationUpdated } from "@freeanima/host/capabilities/memory";
import {
  appendMessageReturningId,
  updateMessageContent,
} from "@freeanima/host/core/db/pg/conversation";
import { omitUndefined } from "@freeanima/host/core/util";
import { logComponent } from "@freeanima/host/platform/logging";

const DISCORD_PROGRESS_PREFIX = "discord:";

function parseDiscordProgressId(stored?: string): string | undefined {
  if (!stored?.startsWith(DISCORD_PROGRESS_PREFIX)) return undefined;
  const id = stored.slice(DISCORD_PROGRESS_PREFIX.length).trim();
  return id || undefined;
}

function formatDiscordProgressId(messageId: string): string {
  return `${DISCORD_PROGRESS_PREFIX}${messageId}`;
}

function isInSessionProgressId(stored?: string): boolean {
  return Boolean(stored && !stored.includes(":"));
}

const RESULT_MAX_LEN = 4000;

export function resolveSessionDeliverTargets(
  meta: ConversationMetaLoadResult | null | undefined,
): CronDeliverTarget[] {
  if (!meta || !isConversationMeta(meta)) return [];
  const platform = meta.platform;
  const extra = meta.platform_extra ?? {};

  if (platform === "discord") {
    const channelId = typeof extra.channel_id === "string" ? extra.channel_id : "";
    if (!channelId) return [];
    const threadId = typeof extra.thread_id === "string" ? extra.thread_id : undefined;
    return [
      { platform: "discord", chat_id: channelId, ...(threadId ? { thread_id: threadId } : {}) },
    ];
  }

  if (platform === "weixin") {
    const chatId =
      (typeof extra.weixin_peer_id === "string" && extra.weixin_peer_id) ||
      (typeof extra.chat_id === "string" && extra.chat_id) ||
      (typeof extra.channel_id === "string" && extra.channel_id) ||
      "";
    if (!chatId) return [];
    return [{ platform: "weixin", chat_id: chatId }];
  }

  return [];
}

function formatConversationResult(task: AcpAsyncTaskSnapshot, result: AcpPromptResult): string {
  return `[ACP result]\n${JSON.stringify(
    {
      kind: "result",
      agent: task.agentName,
      task_id: task.taskId,
      acp_conversation_id: task.acpSessionId,
      mode: task.mode,
      output: result.output,
      pending: result.pending ?? [],
    },
    null,
    2,
  )}`;
}

function formatExternalResultBody(task: AcpAsyncTaskSnapshot, result: AcpPromptResult): string {
  const lines = [`Cursor task completed (task: ${task.taskId})`];
  const output = result.output.trim();
  if (output) {
    const clipped = output.length > RESULT_MAX_LEN ? `${output.slice(0, RESULT_MAX_LEN)}…` : output;
    lines.push(clipped);
  }
  if (result.pending?.length) {
    lines.push("");
    lines.push("Decision pending:");
    lines.push(JSON.stringify(result.pending, null, 2));
  }
  return lines.join("\n");
}

function formatErrorBody(task: AcpAsyncTaskSnapshot, message: string): string {
  return `Cursor task ended (task: ${task.taskId}, ${task.status})\n${message}`;
}

async function appendAcpAssistantMessage(
  conversation: ConversationService,
  animaSessionId: string,
  content: string,
): Promise<void> {
  await conversation.appendMessage({ role: "assistant", content }, animaSessionId);
}

export function createAcpProgressDelivery(opts: {
  conversation: ConversationService;
  hookRegistry: HookRegistry;
  onConversationUpdated?: ((sid: string) => void) | null;
}): AcpProgressDeliveryPort {
  const notifyConversation = (conversationId: string): void => {
    opts.hookRegistry.emit(conversationUpdated, { conversation_id: conversationId });
    opts.onConversationUpdated?.(conversationId);
  };

  const loadTargets = async (animaSessionId: string): Promise<CronDeliverTarget[]> => {
    const meta = await opts.conversation.loadConversationMeta(animaSessionId);
    return resolveSessionDeliverTargets(meta);
  };

  return {
    async deliverProgress(task, body, deliverOpts) {
      const targets = await loadTargets(task.animaSessionId);
      if (targets.length > 0) {
        const externalTargets = deliverOpts?.weixinBatch
          ? targets
          : targets.filter((t) => t.platform !== "weixin");
        if (externalTargets.length === 0) return;

        const discordEditId = parseDiscordProgressId(task.progressMessageId);
        const res = await deliverToTargets(
          externalTargets,
          body,
          omitUndefined({ editMessageId: discordEditId }),
        );
        if (res?.messageId) {
          return { progressMessageId: formatDiscordProgressId(res.messageId) };
        }
        if (task.progressMessageId?.startsWith(DISCORD_PROGRESS_PREFIX)) {
          return { progressMessageId: task.progressMessageId };
        }
        return;
      }

      if (!task.animaSessionId) return;

      const existingId = task.progressMessageId;
      if (existingId && isInSessionProgressId(existingId)) {
        await updateMessageContent(task.animaSessionId, existingId, body);
        notifyConversation(task.animaSessionId);
        return { progressMessageId: existingId };
      }

      const { messageId } = await appendMessageReturningId(task.animaSessionId, {
        role: "assistant",
        content: body,
      });
      notifyConversation(task.animaSessionId);
      return { progressMessageId: messageId };
    },

    async deliverResult(task, result) {
      await appendAcpAssistantMessage(
        opts.conversation,
        task.animaSessionId,
        formatConversationResult(task, result),
      );
      const body = formatExternalResultBody(task, result);
      const targets = await loadTargets(task.animaSessionId);
      if (targets.length > 0) {
        await deliverToTargets(targets, body);
      } else {
        logComponent("acp-deliver").debug("ACP result appended to conversation", {
          conversationId: task.animaSessionId,
          taskId: task.taskId,
        });
      }
      notifyConversation(task.animaSessionId);
    },

    async deliverError(task, message) {
      await appendAcpAssistantMessage(
        opts.conversation,
        task.animaSessionId,
        `[ACP error]\n${JSON.stringify(
          {
            kind: "error",
            agent: task.agentName,
            task_id: task.taskId,
            acp_conversation_id: task.acpSessionId,
            message,
          },
          null,
          2,
        )}`,
      );
      const body = formatErrorBody(task, message);
      const targets = await loadTargets(task.animaSessionId);
      if (targets.length > 0) {
        await deliverToTargets(targets, body);
      }
      notifyConversation(task.animaSessionId);
    },
  };
}
