import {
  findUnhandledAcpTasks,
  readAcpTasks,
  readAcpTasksHandledAt,
  setAcpTasksHandledAt,
} from "@freeanima/capabilities-acp";
import { isSessionMeta } from "@freeanima/orchestration-conversation";
import type { ConversationService } from "@freeanima/orchestration-conversation";
import { logComponent } from "@freeanima/service-logging";
import type { AppRuntime } from "./runtime/app-runtime.ts";
import { PARLOR_PLATFORM } from "./runtime/platforms.ts";

export function buildAcpCallbackPrompt(tasks: ReturnType<typeof findUnhandledAcpTasks>): string {
  const lines = tasks.map((t) => {
    const label = t.status === "awaiting_decision" ? "需要决策（请立即处理）" : "已完成";
    return `- task ${t.task_id} (session ${t.acp_session_id}, ${t.agent_name}, ${label})`;
  });
  return [
    "[ACP 回调] Cursor 异步任务已更新，请查看上方 [ACP result] assistant 消息中的 JSON 结果。",
    "若需继续同一 Cursor 会话，使用 acp_cursor(acp_session_id=...) 指定结果中的 acp_session_id。",
    "",
    ...lines,
  ].join("\n");
}

const RECHECK_DELAY_MS = 500;

export function createAcpSessionUpdatedHandler(opts: {
  conversation: ConversationService;
  getRuntime: () => AppRuntime | null;
}): (sessionId: string) => void {
  const inflight = new Set<string>();
  const pendingRecheck = new Set<string>();
  const recheckTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const run = (sessionId: string): void => {
    void (async () => {
      if (inflight.has(sessionId)) {
        pendingRecheck.add(sessionId);
        return;
      }
      inflight.add(sessionId);
      try {
        const tasks = await readAcpTasks(opts.conversation, sessionId);
        const handledAt = await readAcpTasksHandledAt(opts.conversation, sessionId);
        const unhandled = findUnhandledAcpTasks(tasks, handledAt);
        if (!unhandled.length) return;

        const latestAt = unhandled[unhandled.length - 1]!.updated_at;
        await setAcpTasksHandledAt(opts.conversation, sessionId, latestAt);

        const app = opts.getRuntime();
        if (!app) return;

        const meta = await opts.conversation.loadSessionMeta(sessionId);
        const platform = isSessionMeta(meta) && meta.platform ? meta.platform : PARLOR_PLATFORM;
        const prompt = buildAcpCallbackPrompt(unhandled);

        logComponent("acp-callback").info("Triggering ACP callback turn", {
          sessionId,
          taskCount: unhandled.length,
        });

        await app.sendMessage(sessionId, prompt, platform);
      } catch (e) {
        logComponent("acp-callback").warn("ACP callback turn failed", { sessionId, err: e });
      } finally {
        inflight.delete(sessionId);
        if (pendingRecheck.has(sessionId)) {
          pendingRecheck.delete(sessionId);
          const existing = recheckTimers.get(sessionId);
          if (existing) clearTimeout(existing);
          recheckTimers.set(
            sessionId,
            setTimeout(() => {
              recheckTimers.delete(sessionId);
              run(sessionId);
            }, RECHECK_DELAY_MS),
          );
        }
      }
    })();
  };

  return run;
}
