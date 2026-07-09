import { isConversationMeta } from "@freeanima/core/db/domain";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import type { SapServerDeps } from "@freeanima/platform/sap/types";

async function loadStreamBridge() {
  return import("@freeanima/platform/sap/stream-bridge");
}

export async function resolveConversationPlatform(
  deps: SapServerDeps,
  conversationId: string,
): Promise<string> {
  const meta = await deps.runtime.conversation.loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  const platform = typeof p === "string" ? p.trim() : "";
  if (!platform) {
    throw new Error(`conversation ${conversationId.slice(0, 16)} has no platform`);
  }
  return platform;
}

export async function pumpMessageStream(
  deps: SapServerDeps,
  ctx: SapRequestContext,
  streamId: string,
  conversationId: string,
  message: string,
  platform: string,
  sendExtra?: {
    llm_debug?: boolean;
    client_op_id?: string;
    expected_tail_pos?: number;
    force_tail?: boolean;
  },
): Promise<void> {
  const { bridgeMessageStream } = await loadStreamBridge();
  const originExtra = sendExtra && Object.keys(sendExtra).length > 0 ? sendExtra : undefined;
  try {
    for await (const mapped of bridgeMessageStream(
      streamId,
      deps.runtime.sendMessageStream(conversationId, message, platform, originExtra),
    )) {
      ctx.sendEvent(mapped.method, mapped.payload);
    }
  } catch (e) {
    ctx.sendEvent("stream.error", {
      stream_id: streamId,
      error: String(e),
    });
    ctx.sendEvent("stream.done", { stream_id: streamId });
  }
}

export async function pumpSessionUpdates(
  deps: SapServerDeps,
  ctx: SapRequestContext,
  conversationId: string,
  signal: AbortSignal,
): Promise<void> {
  const { bridgeSessionUpdates } = await loadStreamBridge();
  for await (const mapped of bridgeSessionUpdates(
    conversationId,
    (cb) => deps.runtime.watchConversation(conversationId, cb),
    signal,
  )) {
    if (signal.aborted) break;
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}
