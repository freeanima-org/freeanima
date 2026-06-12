import type {
  AcpAsyncTaskSnapshot,
  AcpProgressDeliveryPort,
  AcpPromptResult,
} from "@freeanima/capabilities-acp";
import { deliverToTargets, type CronDeliverTarget } from "@freeanima/connectors-cron/deliver";
import { isSessionMeta } from "@freeanima/orchestration-conversation";
import type { ConversationService } from "@freeanima/orchestration-conversation";
import type { SessionMetaLoadResult } from "@freeanima/storage-db/domain";
import type { EventBus } from "@freeanima/kernel-eventbus";
import { sessionUpdated } from "@freeanima/capabilities-memory";
import { logComponent } from "@freeanima/service-logging";

const DISCORD_PROGRESS_PREFIX = "discord:";

function parseDiscordProgressId(stored?: string): string | undefined {
  if (!stored?.startsWith(DISCORD_PROGRESS_PREFIX)) return undefined;
  const id = stored.slice(DISCORD_PROGRESS_PREFIX.length).trim();
  return id || undefined;
}

function formatDiscordProgressId(messageId: string): string {
  return `${DISCORD_PROGRESS_PREFIX}${messageId}`;
}

function isParlorProgressId(stored?: string): boolean {
  return Boolean(stored && !stored.includes(":"));
}

const RESULT_MAX_LEN = 4000;

export function resolveSessionDeliverTargets(
  meta: SessionMetaLoadResult | null | undefined,
): CronDeliverTarget[] {
  if (!meta || !isSessionMeta(meta)) return [];
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
      acp_session_id: task.acpSessionId,
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
  bus: EventBus | null;
  onSessionUpdated?: ((sid: string) => void) | null;
}): AcpProgressDeliveryPort {
  const notifySession = (sessionId: string): void => {
    opts.bus?.emit(sessionUpdated, { session_id: sessionId });
    opts.onSessionUpdated?.(sessionId);
  };

  const loadTargets = async (animaSessionId: string): Promise<CronDeliverTarget[]> => {
    const meta = await opts.conversation.loadSessionMeta(animaSessionId);
    return resolveSessionDeliverTargets(meta);
  };

  return {
    async deliverProgress(task, body, deliverOpts) {
      const targets = await loadTargets(task.animaSessionId);
      if (targets.length) {
        const externalTargets = deliverOpts?.weixinBatch
          ? targets
          : targets.filter((t) => t.platform !== "weixin");
        if (!externalTargets.length) return;

        const discordEditId = parseDiscordProgressId(task.progressMessageId);
        const res = await deliverToTargets(externalTargets, body, {
          editMessageId: discordEditId,
        });
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
      if (existingId && isParlorProgressId(existingId)) {
        await opts.conversation.repos.session.updateMessageContent(
          task.animaSessionId,
          existingId,
          body,
        );
        notifySession(task.animaSessionId);
        return { progressMessageId: existingId };
      }

      const { messageId } = await opts.conversation.repos.session.appendMessageReturningId(
        task.animaSessionId,
        { role: "assistant", content: body },
      );
      notifySession(task.animaSessionId);
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
      if (targets.length) {
        await deliverToTargets(targets, body);
      } else {
        logComponent("acp-deliver").debug("ACP result appended to conversation", {
          sessionId: task.animaSessionId,
          taskId: task.taskId,
        });
      }
      notifySession(task.animaSessionId);
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
            acp_session_id: task.acpSessionId,
            message,
          },
          null,
          2,
        )}`,
      );
      const body = formatErrorBody(task, message);
      const targets = await loadTargets(task.animaSessionId);
      if (targets.length) {
        await deliverToTargets(targets, body);
      }
      notifySession(task.animaSessionId);
    },
  };
}
