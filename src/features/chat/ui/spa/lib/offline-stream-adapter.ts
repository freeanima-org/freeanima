import { omitUndefined } from "@freeanima/core/util";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/frontend/portal-sdk/offline-module-registry";
import type {
  StreamFlushContext,
  StreamModuleAdapter,
} from "@freeanima/frontend/portal-sdk/offline-module-types";
import { flushOfflineModule } from "@freeanima/frontend/portal-sdk/offline-sync";
import {
  resolveOutboxScope,
  type ChatSendOutboxPayload,
  type OfflineOutboxOp,
} from "@freeanima/frontend/portal-sdk/offline-outbox";

import { getConversationTail, subscribeMessageStream } from "./api.ts";
import type { StreamApiEvent } from "./types.ts";
import { isChatSendClaimed, updateChatSendPayload } from "./offline-send-store.ts";

export const CHAT_OFFLINE_MODULE_ID = "chat" as const;

function readPayload(op: OfflineOutboxOp): ChatSendOutboxPayload | null {
  const payload = op.payload as ChatSendOutboxPayload;
  if (
    typeof payload.conversation_id !== "string" ||
    typeof payload.message !== "string" ||
    typeof payload.client_op_id !== "string"
  ) {
    return null;
  }
  return payload;
}

export const chatStreamAdapter: StreamModuleAdapter = {
  kind: "stream",
  moduleId: CHAT_OFFLINE_MODULE_ID,
  method: "message.send",
  ordering: "fifo",
  breakOnStale: true,
  groupKey: (op) => readPayload(op)?.conversation_id ?? op.id,
  async preflight(op, ctx) {
    const payload = readPayload(op);
    if (!payload) return "abort";
    // 在线 dispatchSend 已持有 claim 时跳过，避免与 flush 双通路并发 message.send
    if (isChatSendClaimed(payload.client_op_id)) return "abort";
    if (ctx.forceTail) return "proceed";
    try {
      const tail = await getConversationTail(payload.conversation_id);
      if (tail.tail_pos !== payload.expected_tail_pos) return "stale";
      return "proceed";
    } catch {
      return "abort";
    }
  },
  async persistForceTail(opId, scope) {
    await updateChatSendPayload(opId, { force_tail: true }, scope);
  },
  async flushOp(op, ctx) {
    const payload = readPayload(op);
    if (!payload) return { status: "failed", error: "invalid chat send payload" };

    const forceTail = ctx.forceTail || payload.force_tail === true;

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (status: "done" | "stale" | "failed", error?: string) => {
        if (settled) return;
        settled = true;
        resolve(error ? { status, error } : { status });
      };

      const { unsubscribe } = subscribeMessageStream(
        omitUndefined({
          conversationId: payload.conversation_id,
          message: payload.message,
          clientOpId: payload.client_op_id,
          expectedTailPos: payload.expected_tail_pos,
          forceTail: forceTail || undefined,
          llmDebug: ctx.stream.llmDebug,
        }),
        {
          onData: (ev) => {
            ctx.stream.onEvent(payload.conversation_id, ev as StreamApiEvent);
            if (ev.event === "error") {
              const code = (ev.data as { code?: string }).code;
              if (code === "tail_conflict") {
                finish("stale");
                unsubscribe();
                return;
              }
              ctx.stream.onError(payload.conversation_id, ev.data.error);
              finish("failed", ev.data.error);
              unsubscribe();
              return;
            }
            if (ev.event === "done") {
              ctx.stream.onDone(payload.conversation_id);
              finish("done");
              unsubscribe();
            }
          },
          onError: (err) => {
            ctx.stream.onError(payload.conversation_id, err.message);
            finish("failed", err.message);
          },
          onComplete: () => {
            if (!settled) finish("done");
          },
        },
      );
    });
  },
};

export function registerChatOfflineModule(): void {
  registerOfflineModule(chatStreamAdapter);
  registerOfflineModuleCap(CHAT_OFFLINE_MODULE_ID, { offlineWritable: true });
}

export type ChatStreamFlushHandlers = {
  onStreamEvent: (conversationId: string, ev: unknown) => void;
  onDone: (conversationId: string) => void;
  onError: (conversationId: string, message: string) => void;
  llmDebug?: boolean;
  forceTail?: boolean;
};

export function buildChatStreamFlushContext(handlers: ChatStreamFlushHandlers): StreamFlushContext {
  return {
    scope: resolveOutboxScope(),
    stream: omitUndefined({
      onEvent: handlers.onStreamEvent,
      onDone: handlers.onDone,
      onError: handlers.onError,
      llmDebug: handlers.llmDebug,
    }),
    ...(handlers.forceTail ? { forceTail: true } : {}),
  };
}

/** 不依赖 ChatApp 挂载：全局 bar 离页时仍可 flush chat outbox。 */
export function buildHeadlessChatStreamFlushContext(forceTail = false): StreamFlushContext {
  return buildChatStreamFlushContext({
    onStreamEvent: () => {},
    onDone: () => {},
    onError: () => {},
    forceTail,
  });
}

export function scheduleChatFlush(handlers: ChatStreamFlushHandlers): void {
  void flushOfflineModule(CHAT_OFFLINE_MODULE_ID, resolveOutboxScope(), {
    streamContext: buildChatStreamFlushContext(handlers),
  }).catch(() => {});
}
