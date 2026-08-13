import type { Kernel } from "@freeanima/host/kernel";
import type { Config } from "@freeanima/host/core/config";
import { bindClarifyConfig } from "./clarify.ts";
import type { ConversationPort } from "@freeanima/host/core/tool/conversation-port.ts";
import {
  messageIncoming,
  turnAfterComplete,
  type MessageIncomingEffect,
  type TurnAfterCompleteEffect,
} from "@freeanima/host/core/hooks/conversation";
import { toolAfterCall, type ToolAfterCallEffect } from "@freeanima/host/core/hooks/loop";
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
  conversation: ConversationPort;
  config: Config;
}): void {
  const { kernel, conversation, config } = opts;
  bindClarifyConfig(config);
  const registry = kernel.hookRegistry;

  registry.on(
    messageIncoming,
    async (ctx) => {
      const guard = await guardAwaitingClarify(conversation, ctx.conversationId, ctx.message);
      if (!guard.ok) {
        return { status: "ok", blocked: true, message: guard.reason };
      }
      const data: MessageIncomingEffect = {
        transformedMessage: await resolveUserContent(conversation, ctx.conversationId, ctx.message),
      };
      if (guard.expired) {
        data.expiredHint = guard.hint;
      }
      return { status: "ok", data };
    },
    { llm_kind: "conversation" },
  );

  registry.on(
    toolAfterCall,
    (ctx) => {
      if (ctx.toolName !== "clarify") return undefined;
      const parsed = parseClarifyToolResult(ctx.result);
      if (!parsed || !("status" in parsed) || parsed.status !== "awaiting") return undefined;
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
    },
    { llm_kind: "conversation" },
  );

  registry.on(
    turnAfterComplete,
    async (ctx) => {
      const pending = findAwaitingClarifyInMessages(ctx.messages);
      if (!pending) return undefined;
      await setAwaitingClarify(conversation, ctx.conversationId, {
        items: pending.items,
        timeout_sec: pending.timeout_sec,
      });
      const data: TurnAfterCompleteEffect = {
        displayContent: formatClarifyText(pending.items),
      };
      return { status: "ok", data };
    },
    { llm_kind: "conversation" },
  );
}

/** Stream path: write to conversation meta on awaiting_clarify event */
export async function applyClarifyStreamAwaiting(
  conversation: ConversationPort,
  conversationId: string,
  items: { question: string; choices?: string[]; default?: string }[],
  timeoutSec: number,
): Promise<void> {
  await setAwaitingClarify(conversation, conversationId, { items, timeout_sec: timeoutSec });
}
