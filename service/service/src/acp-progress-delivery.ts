import type {
  AcpAsyncTaskSnapshot,
  AcpProgressDeliveryPort,
  AcpPromptResult,
} from "@freeanima/capabilities-acp";
import { deliverToTargets, type CronDeliverTarget } from "@freeanima/connectors-cron";
import { isSessionMeta } from "@freeanima/engine-conversation";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SessionMetaLoadResult } from "@freeanima/engine-db/domain";
import type { EventBus } from "@freeanima/kernel-eventbus";
import { sessionUpdated } from "@freeanima/life-memory";
import { logComponent } from "@freeanima/service-logging";

const RESULT_MAX_LEN = 1500;

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

function formatResultBody(task: AcpAsyncTaskSnapshot, result: AcpPromptResult): string {
  const lines = [`Cursor 任务完成 (task: ${task.taskId})`];
  const output = result.output.trim();
  if (output) {
    const clipped = output.length > RESULT_MAX_LEN ? `${output.slice(0, RESULT_MAX_LEN)}…` : output;
    lines.push(clipped);
  }
  if (result.pending?.length) {
    lines.push("");
    lines.push("待决策：请用 continue_session=true 继续同一 ACP session。");
  }
  return lines.join("\n");
}

function formatErrorBody(task: AcpAsyncTaskSnapshot, message: string): string {
  return `Cursor 任务结束 (task: ${task.taskId}, ${task.status})\n${message}`;
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

  const loadTargets = async (nestSessionId: string): Promise<CronDeliverTarget[]> => {
    const meta = await opts.conversation.loadSessionMeta(nestSessionId);
    return resolveSessionDeliverTargets(meta);
  };

  return {
    async deliverProgress(task, body) {
      const targets = await loadTargets(task.nestSessionId);
      if (targets.length) {
        await deliverToTargets(targets, body);
      } else if (task.nestSessionId) {
        notifySession(task.nestSessionId);
      }
    },

    async deliverResult(task, result) {
      const body = formatResultBody(task, result);
      const targets = await loadTargets(task.nestSessionId);
      if (targets.length) {
        await deliverToTargets(targets, body);
      } else {
        logComponent("acp-deliver").debug("无外部投递目标，仅通知 session 更新", {
          sessionId: task.nestSessionId,
          taskId: task.taskId,
        });
      }
      notifySession(task.nestSessionId);
    },

    async deliverError(task, message) {
      const body = formatErrorBody(task, message);
      const targets = await loadTargets(task.nestSessionId);
      if (targets.length) {
        await deliverToTargets(targets, body);
      }
      notifySession(task.nestSessionId);
    },
  };
}
