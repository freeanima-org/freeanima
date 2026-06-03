import type { Kernel } from "@freeanima/kernel";
import {
  messageIncoming,
  toolAfterCall,
  turnAfterComplete,
} from "@freeanima/legacy-kernel";
import {
  findAwaitingClarifyInMessages,
  formatClarifyText,
  guardAwaitingClarify,
  parseClarifyToolResult,
  resolveUserContent,
  setAwaitingClarify,
} from "./clarify";

export function registerClarifyHooks(kernel: Kernel): void {
  const registry = kernel.hookRegistry;

  registry.on(messageIncoming, async (ctx) => {
    const guard = await guardAwaitingClarify(ctx.sessionId, ctx.message);
    if (!guard.ok) {
      ctx.blocked = { reason: guard.reason };
      return;
    }
    if (guard.expired) {
      ctx.expiredHint = guard.hint;
    }
    ctx.transformedMessage = await resolveUserContent(ctx.sessionId, ctx.message);
  });

  registry.on(toolAfterCall, (ctx) => {
    if (ctx.toolName !== "clarify") return;
    const parsed = parseClarifyToolResult(ctx.result);
    if (!parsed || !("status" in parsed) || parsed.status !== "awaiting") return;
    ctx.turnControl = {
      pause: true,
      streamEvents: [
        {
          event: "awaiting_clarify",
          data: { items: parsed.items, timeout_sec: parsed.timeout_sec },
        },
        { event: "done", data: { reason: "awaiting_clarify" } },
      ],
    };
  });

  registry.on(turnAfterComplete, async (ctx) => {
    const pending = findAwaitingClarifyInMessages(ctx.messages);
    if (!pending) return;
    await setAwaitingClarify(ctx.sessionId, {
      items: pending.items,
      timeout_sec: pending.timeout_sec,
    });
    ctx.displayContent = formatClarifyText(pending.items);
  });
}

/** stream 路径：收到 awaiting_clarify 事件时写入 session meta */
export async function applyClarifyStreamAwaiting(
  sessionId: string,
  items: { question: string; choices?: string[]; default?: string }[],
  timeoutSec: number,
): Promise<void> {
  await setAwaitingClarify(sessionId, { items, timeout_sec: timeoutSec });
}
