import {
  findUnhandledAcpTasks,
  readAcpTasks,
  readAcpTasksHandledAt,
  setAcpTasksHandledAt,
} from "@freeanima/capabilities-acp";
import { isSessionMeta } from "@freeanima/engine-conversation";
import type { ConversationService } from "@freeanima/engine-conversation";
import { logComponent } from "@freeanima/service-logging";
import type { AnimaService } from "./runtime/anima-service.ts";
import { PARLOR_PLATFORM } from "./runtime/platforms.ts";

export function buildAcpCallbackPrompt(tasks: ReturnType<typeof findUnhandledAcpTasks>): string {
  const lines = tasks.map((t) => {
    const label = t.status === "awaiting_decision" ? "需要决策（请立即处理）" : "已完成";
    return `- task ${t.task_id} (${t.agent_name}, ${label})`;
  });
  return [
    "[ACP 回调] Cursor 异步任务已更新，请查看上方 [ACP result] assistant 消息中的 JSON 结果。",
    "若需继续同一 Cursor 会话，使用 acp_cursor(continue_session=true)。",
    "",
    ...lines,
  ].join("\n");
}

export function createAcpSessionUpdatedHandler(opts: {
  conversation: ConversationService;
  getService: () => AnimaService | null;
}): (sessionId: string) => void {
  const inflight = new Set<string>();

  return (sessionId: string) => {
    void (async () => {
      if (inflight.has(sessionId)) return;
      inflight.add(sessionId);
      try {
        const tasks = await readAcpTasks(opts.conversation, sessionId);
        const handledAt = await readAcpTasksHandledAt(opts.conversation, sessionId);
        const unhandled = findUnhandledAcpTasks(tasks, handledAt);
        if (!unhandled.length) return;

        const latestAt = unhandled[unhandled.length - 1]!.updated_at;
        await setAcpTasksHandledAt(opts.conversation, sessionId, latestAt);

        const service = opts.getService();
        if (!service) return;

        const meta = await opts.conversation.loadSessionMeta(sessionId);
        const platform = isSessionMeta(meta) && meta.platform ? meta.platform : PARLOR_PLATFORM;
        const prompt = buildAcpCallbackPrompt(unhandled);

        logComponent("acp-callback").info("Triggering ACP callback turn", {
          sessionId,
          taskCount: unhandled.length,
        });

        await service.sendMessage(sessionId, prompt, platform);
      } catch (e) {
        logComponent("acp-callback").warn("ACP callback turn failed", { sessionId, err: e });
      } finally {
        inflight.delete(sessionId);
      }
    })();
  };
}
