import type { Kernel } from "@freeanima/kernel";
import type { ConversationService } from "@freeanima/engine-conversation";
import type {
  MessageIncomingEffect,
  ToolAfterCallEffect,
  TurnAfterCompleteEffect,
} from "@freeanima/kernel-hooks";
import { messageIncoming, toolAfterCall, turnAfterComplete } from "@freeanima/kernel-hooks";
import {
  findAwaitingClarifyInMessages,
  formatClarifyText,
  guardAwaitingClarify,
  parseClarifyToolResult,
  resolveUserContent,
  setAwaitingClarify,
} from "./clarify.ts";

export function registerClarifyHooks(opts: {
  kernel: Kernel;
  conversation: ConversationService;
}): void {
  const { kernel, conversation } = opts;
  const registry = kernel.hookRegistry;

  registry.on(messageIncoming, async (ctx) => {
    const guard = await guardAwaitingClarify(conversation, ctx.sessionId, ctx.message);
    if (!guard.ok) {
      return { status: "ok", blocked: true, message: guard.reason };
    }
    const data: MessageIncomingEffect = {
      transformedMessage: await resolveUserContent(conversation, ctx.sessionId, ctx.message),
    };
    if (guard.expired) {
      data.expiredHint = guard.hint;
    }
    return { status: "ok", data };
  });

  registry.on(toolAfterCall, (ctx) => {
    if (ctx.toolName !== "clarify") return;
    const parsed = parseClarifyToolResult(ctx.result);
    if (!parsed || !("status" in parsed) || parsed.status !== "awaiting") return;
    const data: ToolAfterCallEffect = {
      turnControl: {
        pause: true,
        streamEvents: [
          {
            event: "awaiting_clarify",
            data: { items: parsed.items, timeout_sec: parsed.timeout_sec },
          },
          { event: "done", data: { reason: "awaiting_clarify" } },
        ],
      },
    };
    return { status: "ok", data };
  });

  registry.on(turnAfterComplete, async (ctx) => {
    const pending = findAwaitingClarifyInMessages(ctx.messages);
    if (!pending) return;
    await setAwaitingClarify(conversation, ctx.sessionId, {
      items: pending.items,
      timeout_sec: pending.timeout_sec,
    });
    const data: TurnAfterCompleteEffect = {
      displayContent: formatClarifyText(pending.items),
    };
    return { status: "ok", data };
  });
}

/** Stream path: write to session meta on awaiting_clarify event */
export async function applyClarifyStreamAwaiting(
  conversation: ConversationService,
  sessionId: string,
  items: { question: string; choices?: string[]; default?: string }[],
  timeoutSec: number,
): Promise<void> {
  await setAwaitingClarify(conversation, sessionId, { items, timeout_sec: timeoutSec });
}
