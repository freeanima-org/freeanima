import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import {
  ToolRoundBuffer,
  applyStreamReplyEvent,
  initialStreamReplyState,
  type StreamReplyEffect,
} from "@freeanima/habitat/kernel/loop-mechanism/stream-reply";
import type { DisplayItem } from "@freeanima/habitat/platform/schemas/display";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { mapRuntimeStreamEventToSap } from "@freeanima/shared/rpc-contract";

export type RemoteToolsStreamEmitter = (method: string, payload: Record<string, unknown>) => void;

function structuredCallsToDisplay(
  calls: Extract<StreamReplyEffect, { kind: "tool_round" }>["calls"],
): DisplayItem {
  return {
    type: "tool_block",
    calls: calls.map((c) =>
      omitUndefined({
        name: c.name,
        argsPreview: c.argsPreview,
        tool_call_id: c.tool_call_id,
        status: c.status,
        args: c.args,
        result: c.result,
      }),
    ),
  };
}

function* mapReplyEffectsToSap(
  streamId: string,
  effects: StreamReplyEffect[],
): Generator<{ method: string; payload: Record<string, unknown> }> {
  for (const effect of effects) {
    switch (effect.kind) {
      case "tool_round":
      case "tool_round_live":
        if (effect.calls.length > 0) {
          yield {
            method: "stream.display_append",
            payload: {
              stream_id: streamId,
              item: structuredCallsToDisplay(effect.calls),
            },
          };
        }
        break;
      case "answer_commit":
        yield {
          method: "stream.display_append",
          payload: {
            stream_id: streamId,
            item: { type: "message", role: "assistant", content: effect.content },
          },
        };
        break;
      case "answer_finalize":
        if (effect.content.trim()) {
          yield {
            method: "stream.display_append",
            payload: {
              stream_id: streamId,
              item: { type: "message", role: "assistant", content: effect.content },
            },
          };
        }
        break;
      case "answer_delta":
        yield {
          method: "stream.token",
          payload: { stream_id: streamId, content: effect.delta },
        };
        break;
      case "answer_replace":
        yield {
          method: "stream.content_replace",
          payload: { stream_id: streamId, content: effect.content },
        };
        break;
      case "clarify":
        yield {
          method: "stream.awaiting_clarify",
          payload: {
            stream_id: streamId,
            items: effect.items,
            timeout_sec: effect.timeout_sec,
          },
        };
        break;
      case "turn_end":
        if (effect.reason === "done") {
          yield { method: "stream.done", payload: { stream_id: streamId } };
        } else if (effect.reason === "error") {
          yield {
            method: "stream.error",
            payload: { stream_id: streamId, error: effect.message ?? "error" },
          };
          yield { method: "stream.done", payload: { stream_id: streamId } };
        } else if (effect.reason === "interrupted") {
          yield {
            method: "stream.interrupted",
            payload: { stream_id: streamId, reason: effect.message ?? "interrupted" },
          };
          yield { method: "stream.done", payload: { stream_id: streamId, reason: "interrupted" } };
        }
        break;
      case "answer_open":
        break;
    }
  }
}

/** Map runtime stream events to SAP stream.* evt payloads (legacy passthrough) */
export function emitStreamEvent(
  emit: RemoteToolsStreamEmitter,
  streamId: string,
  ev: StreamEvent,
): void {
  const mapped = mapRuntimeStreamEventToSap(streamId, {
    event: ev.event,
    data: ev.data,
  });
  if (mapped) {
    emit(mapped.method, mapped.payload);
  }
}

/** Habitat 投影：runtime reducer → display_append + token；不转发原始 tool_begin/result */
export async function* bridgeMessageStream(
  streamId: string,
  source: AsyncIterable<StreamEvent>,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  yield {
    method: "stream.accepted",
    payload: { stream_id: streamId },
  };

  let state = initialStreamReplyState();
  const buffer = new ToolRoundBuffer();

  for await (const ev of source) {
    if (ev.event === "llm_debug") {
      yield {
        method: "stream.llm_debug",
        payload: {
          stream_id: streamId,
          ...(ev.data as Record<string, unknown>),
        },
      };
      continue;
    }

    if (ev.event === "accepted") continue;

    const { state: next, effects } = applyStreamReplyEvent(state, ev, buffer);
    state = next;
    yield* mapReplyEffectsToSap(streamId, effects);

    if (state.phase === "terminal") break;
  }

  if (state.phase !== "terminal") {
    const { effects } = applyStreamReplyEvent(state, { event: "done", data: {} }, buffer);
    yield* mapReplyEffectsToSap(streamId, effects);
  }
}

export async function* bridgeSessionUpdates(
  conversationId: string,
  watch: (cb: () => void) => () => void,
  signal: AbortSignal,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  let pending: (() => void) | null = null;
  const wake = (): void => {
    pending?.();
    pending = null;
  };
  const unwatch = watch(wake);
  try {
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        pending = resolve;
      });
      if (signal.aborted) break;
      yield {
        method: "conversation.updated",
        payload: { conversation_id: conversationId },
      };
    }
  } finally {
    unwatch();
  }
}

/** 任意会话更新 → conversation.updated（含真实 conversation_id） */
export async function* bridgeInboxUpdates(
  watch: (cb: (conversationId: string) => void) => () => void,
  signal: AbortSignal,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  let pendingId: string | null = null;
  let pending: (() => void) | null = null;
  const wake = (conversationId: string): void => {
    pendingId = conversationId;
    pending?.();
    pending = null;
  };
  const unwatch = watch(wake);
  try {
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        pending = resolve;
      });
      if (signal.aborted) break;
      const conversation_id = pendingId;
      pendingId = null;
      if (!conversation_id) continue;
      yield {
        method: "conversation.updated",
        payload: { conversation_id },
      };
    }
  } finally {
    unwatch();
  }
}

/** Bridge Habitat SSE-shaped events through the same mapper (for existing HTTP routes) */
export async function* bridgeApiStreamEvents(
  streamId: string,
  source: AsyncIterable<{ event: string; data: string }>,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  yield {
    method: "stream.accepted",
    payload: { stream_id: streamId },
  };
  for await (const chunk of source) {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(chunk.data) as Record<string, unknown>;
    } catch {
      data = {};
    }
    const mapped = mapRuntimeStreamEventToSap(streamId, {
      event: chunk.event,
      data,
    });
    if (mapped) {
      yield mapped;
    }
  }
}
