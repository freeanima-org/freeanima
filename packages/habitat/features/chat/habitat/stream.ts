import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { canonicalizeConversationPlatform } from "@freeanima/shared/pg-shapes/jsonb/platform-info";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types";

import { rememberLlmDebugFromStreamPayload } from "./llm-debug-cache.ts";
import { streamSessionRegistry } from "./stream-session-registry.ts";

async function loadStreamBridge() {
  return import("@freeanima/habitat/capabilities/outpost/transport/stream-bridge");
}

export async function resolveConversationPlatform(
  deps: RemoteToolsServerDeps,
  conversationId: string,
): Promise<string> {
  const meta = await deps.runtime.conversation.loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  return canonicalizeConversationPlatform(p);
}

function publishStreamEvent(
  fallback: RemoteToolsRequestContext,
  method: string,
  payload: Record<string, unknown>,
): void {
  if (!streamSessionRegistry.applyAndPublish(method, payload)) {
    fallback.sendEvent(method, payload);
  }
}

export async function pumpMessageStream(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
  streamId: string,
  conversationId: string,
  message: string,
  platform: string,
  sendExtra?: {
    llm_debug?: boolean;
    client_op_id?: string;
    expected_tail_pos?: number;
    force_tail?: boolean;
    attachment_temp_ids?: string[];
    attachments?: Array<{ filename: string; mime_type: string; size: number }>;
  },
): Promise<void> {
  const { bridgeMessageStream } = await loadStreamBridge();
  const originExtra = sendExtra && Object.keys(sendExtra).length > 0 ? sendExtra : undefined;

  // 发起连接订阅 fan-out（attach 的连接另订）
  const unsubscribe = streamSessionRegistry.subscribe(streamId, (method, payload) => {
    ctx.sendEvent(method, payload);
  });

  try {
    for await (const mapped of bridgeMessageStream(
      streamId,
      deps.runtime.sendMessageStream(conversationId, message, platform, originExtra),
    )) {
      // 快照入 Redis，不推给客户端（打开调试面板时再 llm_debug.get）
      if (mapped.method === "stream.llm_debug") {
        await rememberLlmDebugFromStreamPayload(conversationId, mapped.payload);
        continue;
      }
      publishStreamEvent(ctx, mapped.method, mapped.payload);
    }
  } catch (e) {
    publishStreamEvent(ctx, "stream.error", {
      stream_id: streamId,
      error: String(e),
    });
    publishStreamEvent(ctx, "stream.done", { stream_id: streamId });
  } finally {
    unsubscribe?.();
  }
}

export async function pumpContinueStream(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
  streamId: string,
  conversationId: string,
  platform: string,
  sendExtra?: { llm_debug?: boolean },
): Promise<void> {
  const { bridgeMessageStream } = await loadStreamBridge();
  const originExtra = sendExtra && Object.keys(sendExtra).length > 0 ? sendExtra : undefined;

  const unsubscribe = streamSessionRegistry.subscribe(streamId, (method, payload) => {
    ctx.sendEvent(method, payload);
  });

  try {
    for await (const mapped of bridgeMessageStream(
      streamId,
      deps.runtime.continueMessageStream(conversationId, platform, originExtra),
    )) {
      if (mapped.method === "stream.llm_debug") {
        await rememberLlmDebugFromStreamPayload(conversationId, mapped.payload);
        continue;
      }
      publishStreamEvent(ctx, mapped.method, mapped.payload);
    }
  } catch (e) {
    publishStreamEvent(ctx, "stream.error", {
      stream_id: streamId,
      error: String(e),
    });
    publishStreamEvent(ctx, "stream.done", { stream_id: streamId });
  } finally {
    unsubscribe?.();
  }
}

export async function pumpSessionUpdates(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
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

export async function pumpInboxUpdates(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
  signal: AbortSignal,
): Promise<void> {
  const { bridgeInboxUpdates } = await loadStreamBridge();
  for await (const mapped of bridgeInboxUpdates((cb) => deps.runtime.watchInbox(cb), signal)) {
    if (signal.aborted) break;
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}

/** stream.attach：本连接独占 fan-out 并重放 buffer dump（替换发起连接旧订阅，避免同 WS 双发） */
export function attachStreamSession(
  ctx: RemoteToolsRequestContext,
  streamId: string,
): { status: "active" | "done" | "error" | "interrupted"; replayed: boolean } {
  const session = streamSessionRegistry.getSession(streamId);
  if (!session) {
    throw new Error(`stream not found: ${streamId}`);
  }

  let unsubscribe: (() => void) | null = null;
  const emit = (method: string, payload: Record<string, unknown>): void => {
    ctx.sendEvent(method, payload);
    if (method === "stream.done" || method === "stream.error") {
      unsubscribe?.();
      unsubscribe = null;
    }
  };

  unsubscribe = streamSessionRegistry.subscribeExclusive(streamId, emit);
  if (!unsubscribe) {
    throw new Error(`stream not found: ${streamId}`);
  }

  // 客户端须在 attach 请求前注册 onEvent，才能收到同步重放
  streamSessionRegistry.replaySnapshot(streamId, emit);

  if (session.status !== "active") {
    unsubscribe?.();
    unsubscribe = null;
  }

  return { status: session.status, replayed: true };
}
