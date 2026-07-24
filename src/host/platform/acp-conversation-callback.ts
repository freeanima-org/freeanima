import {
  findUnhandledAcpTasks,
  readAcpTasks,
  readAcpTasksHandledAt,
  setAcpTasksHandledAt,
} from "@freeanima/host/capabilities/acp";
import { isConversationMeta } from "@freeanima/host/engine/conversation";
import type { ConversationService } from "@freeanima/host/engine/conversation";
import { logComponent } from "@freeanima/host/platform/logging";
import type { AppRuntime } from "./service/app-runtime.ts";

export function buildAcpCallbackPrompt(tasks: ReturnType<typeof findUnhandledAcpTasks>): string {
  const lines = tasks.map((t) => {
    const label = t.status === "awaiting_decision" ? "需要决策（请立即处理）" : "已完成";
    return `- task ${t.task_id} (session ${t.acp_conversation_id}, ${t.agent_name}, ${label})`;
  });
  return [
    "[ACP 回调] Cursor 异步任务已更新，请查看上方 [ACP result] assistant 消息中的 JSON 结果。",
    "若需继续同一 Cursor 会话，使用 acp_cursor(acp_conversation_id=...) 指定结果中的 acp_conversation_id。",
    "",
    ...lines,
  ].join("\n");
}

const RECHECK_DELAY_MS = 500;

export function createAcpSessionUpdatedHandler(opts: {
  conversation: ConversationService;
  getRuntime: () => AppRuntime | null;
}): (conversationId: string) => void {
  const inflight = new Set<string>();
  const pendingRecheck = new Set<string>();
  const recheckTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const run = (conversationId: string): void => {
    void (async () => {
      if (inflight.has(conversationId)) {
        pendingRecheck.add(conversationId);
        return;
      }
      inflight.add(conversationId);
      try {
        const tasks = await readAcpTasks(opts.conversation, conversationId);
        const handledAt = await readAcpTasksHandledAt(opts.conversation, conversationId);
        const unhandled = findUnhandledAcpTasks(tasks, handledAt);
        if (unhandled.length === 0) return;

        const latest = unhandled.at(-1);
        if (!latest) return;
        const latestAt = latest.updated_at;
        await setAcpTasksHandledAt(opts.conversation, conversationId, latestAt);

        const app = opts.getRuntime();
        if (!app) return;

        const meta = await opts.conversation.loadConversationMeta(conversationId);
        const platform =
          isConversationMeta(meta) && meta.platform?.trim() ? meta.platform.trim() : null;
        if (!platform) {
          logComponent("acp-callback").warn("Skipping ACP callback: conversation has no platform", {
            conversationId,
          });
          return;
        }
        const prompt = buildAcpCallbackPrompt(unhandled);

        logComponent("acp-callback").info("Triggering ACP callback turn", {
          conversationId,
          taskCount: unhandled.length,
        });

        await app.sendMessage(conversationId, prompt, platform);
      } catch (e) {
        logComponent("acp-callback").warn("ACP callback turn failed", { conversationId, err: e });
      } finally {
        inflight.delete(conversationId);
        if (pendingRecheck.has(conversationId)) {
          pendingRecheck.delete(conversationId);
          const existing = recheckTimers.get(conversationId);
          if (existing) clearTimeout(existing);
          recheckTimers.set(
            conversationId,
            setTimeout(() => {
              recheckTimers.delete(conversationId);
              run(conversationId);
            }, RECHECK_DELAY_MS),
          );
        }
      }
    })();
  };

  return run;
}
