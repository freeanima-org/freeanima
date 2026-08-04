/**
 * 流式事件 → token / display / llm_debug 回调（Chat / Coding 共用，无 React）。
 */

import type { DisplayItem, LlmDebugSnapshotPayload, StreamApiEvent } from "./types.ts";

export type StreamEventCallbacks = {
  onToken?: (text: string) => void;
  onDisplayAppend?: (item: DisplayItem) => void;
  onAwaitingClarify?: (data: Record<string, unknown>) => void;
  onLlmDebug?: (snapshot: LlmDebugSnapshotPayload) => void;
};

export type StreamEventPatch = {
  streaming?: boolean;
  streamText?: string;
};

/**
 * 处理单条流式事件，累加 streamText；返回是否收到 done/error。
 */
export function handleStreamEvent(
  ev: StreamApiEvent,
  streamText: string,
  callbacks: StreamEventCallbacks,
  patch: (partial: StreamEventPatch) => void,
): { streamText: string; receivedDone: boolean; receivedError: boolean } {
  let receivedDone = false;
  let receivedError = false;
  let nextText = streamText;

  switch (ev.event) {
    case "accepted":
      patch({ streaming: true });
      break;
    case "token":
      nextText += ev.data.content || "";
      patch({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "content_replace":
      nextText = ev.data.content || "";
      patch({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "display_append":
      if (ev.data.item.type === "message" && ev.data.item.role === "assistant") {
        nextText = "";
        patch({ streamText: "" });
        callbacks.onToken?.("");
      }
      callbacks.onDisplayAppend?.(ev.data.item);
      break;
    case "tool_begin":
    case "tool_result":
    case "tool_error":
      break;
    case "awaiting_clarify":
      callbacks.onAwaitingClarify?.(ev.data as Record<string, unknown>);
      break;
    case "interrupted":
      receivedDone = true;
      break;
    case "error":
      receivedError = true;
      break;
    case "done":
      receivedDone = true;
      break;
    case "ping":
      break;
    case "llm_debug":
      callbacks.onLlmDebug?.(ev.data);
      break;
  }

  return { streamText: nextText, receivedDone, receivedError };
}

/** 合并流式 llm_debug 快照（initial / final） */
export function mergeLlmDebugSnapshot(
  prev: { initial?: LlmDebugSnapshotPayload; final?: LlmDebugSnapshotPayload } | null,
  snapshot: LlmDebugSnapshotPayload,
): { initial?: LlmDebugSnapshotPayload; final?: LlmDebugSnapshotPayload } {
  const base = prev ?? {};
  if (snapshot.phase === "initial") return { ...base, initial: snapshot };
  return { ...base, final: snapshot };
}
