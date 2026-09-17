import type { Kernel } from "@freeanima/kernel";
import type { Config } from "@freeanima/habitat/core/config";
import { bindClarifyConfig } from "./clarify.ts";
import type { ConversationPort } from "@freeanima/habitat/core/tool/conversation-port.ts";
import {
  onMessageIncoming,
  onToolAfterCall,
  onTurnAfterComplete,
  type MessageIncomingOutcome,
} from "@freeanima/habitat/core/hooks/cordis";
import type { ToolAfterCallEffect } from "@freeanima/habitat/core/hooks/loop";
import type { TurnAfterCompleteEffect } from "@freeanima/habitat/core/hooks/conversation";
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
  const { ctx } = kernel;

  onMessageIncoming(ctx, async (event) => {
    const guard = await guardAwaitingClarify(conversation, event.conversationId, event.message);
    if (!guard.ok) {
      return { blocked: guard.reason };
    }
    const data: MessageIncomingOutcome = {
      transformedMessage: await resolveUserContent(
        conversation,
        event.conversationId,
        event.message,
      ),
    };
    if (guard.expired) {
      data.expiredHint = guard.hint;
    }
    return data;
  });

  onToolAfterCall(ctx, (event) => {
    if (event.toolName !== "clarify") return undefined;
    const parsed = parseClarifyToolResult(event.result);
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
    return data;
  });

  onTurnAfterComplete(ctx, async (event) => {
    const pending = findAwaitingClarifyInMessages(event.messages);
    if (!pending) return undefined;
    await setAwaitingClarify(conversation, event.conversationId, {
      items: pending.items,
      timeout_sec: pending.timeout_sec,
    });
    const data: TurnAfterCompleteEffect = {
      displayContent: formatClarifyText(pending.items),
    };
    return data;
  });
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
