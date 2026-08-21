/**
 * Coding 中栏线程：对齐 Chat display 模型（message + tool_block）。
 * Habitat 经 bridgeMessageStream 推 display_append（含 tool_block），不依赖裸 tool_begin。
 */

import type { DisplayItem, DisplayToolCall } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { upsertDisplayItem } from "@freeanima/features/chat/ui/spa/lib/upsert-tool-block.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import type { StreamApiLikeEvent } from "@freeanima/shared/rpc-contract/frames/message.ts";
import { asRecord } from "@freeanima/shared/util";

export type CodingThreadState = {
  display: DisplayItem[];
  /** 流式中尚未 commit 的助手文本（Chat streamText） */
  streamText: string;
  streaming: boolean;
  /** 向上分页：最旧一页的 from_pos */
  fromPos: number | null;
  hasMoreBefore: boolean;
};

export function emptyCodingThread(): CodingThreadState {
  return {
    display: [],
    streamText: "",
    streaming: false,
    fromPos: null,
    hasMoreBefore: false,
  };
}

export function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function asDisplayItem(raw: unknown): DisplayItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { type?: string };
  if (item.type === "message") {
    const m = raw as {
      role?: string;
      content?: unknown;
      attachments?: Array<{ filename: string; mime_type: string; size: number }>;
    };
    if (m.role !== "user" && m.role !== "assistant") return null;
    return {
      type: "message",
      role: m.role,
      content: typeof m.content === "string" ? m.content : coerceString(m.content),
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    };
  }
  if (item.type === "tool_block") {
    const block = raw as { calls?: unknown };
    if (!Array.isArray(block.calls)) return { type: "tool_block", calls: [] };
    const calls: DisplayToolCall[] = [];
    for (const c of block.calls) {
      if (!c || typeof c !== "object") continue;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
      const row = c as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name : "?";
      const tool_call_id =
        typeof row.tool_call_id === "string" ? row.tool_call_id : newMsgId("call");
      calls.push({
        name,
        argsPreview: typeof row.argsPreview === "string" ? row.argsPreview : "",
        tool_call_id,
        status: typeof row.status === "string" ? row.status : "done",
        ...(row.args && typeof row.args === "object" && !Array.isArray(row.args)
          ? { args: asRecord(row.args) ?? {} }
          : {}),
        ...(typeof row.result === "string" ? { result: row.result } : {}),
      });
    }
    return { type: "tool_block", calls };
  }
  return null;
}

/** 应用单条流式事件；返回下一状态 */
export function applyCodingStreamEvent(
  state: CodingThreadState,
  ev: StreamApiLikeEvent,
): CodingThreadState {
  switch (ev.event) {
    case "accepted":
      return { ...state, streaming: true };
    case "token":
      return {
        ...state,
        streaming: true,
        streamText: state.streamText + (ev.data.content || ""),
      };
    case "content_replace":
      return {
        ...state,
        streaming: true,
        streamText: ev.data.content || "",
      };
    case "display_append": {
      const item = asDisplayItem(ev.data.item);
      if (!item) return state;
      const display = upsertDisplayItem(state.display, item);
      if (item.type === "message" && item.role === "assistant") {
        return { ...state, display, streamText: "" };
      }
      return { ...state, display };
    }
    case "done":
    case "interrupted":
      return { ...state, streaming: false };
    case "error":
      return {
        ...state,
        streaming: false,
        streamText: state.streamText || ev.data.error,
      };
    // Habitat bridge 不转发裸 tool_*；保留兼容兜底
    case "tool_begin": {
      const tool = ev.data.tool || "?";
      const args = ev.data.args ?? {};
      const item: DisplayItem = {
        type: "tool_block",
        calls: [
          {
            name: tool,
            argsPreview: "",
            tool_call_id: newMsgId("call"),
            status: "running",
            args,
          },
        ],
      };
      return { ...state, display: upsertDisplayItem(state.display, item) };
    }
    case "tool_result":
    case "tool_error": {
      const tool = ev.data.tool || "?";
      const item: DisplayItem = {
        type: "tool_block",
        calls: [
          {
            name: tool,
            argsPreview: "",
            tool_call_id: newMsgId("call"),
            status: ev.event === "tool_error" ? "error" : "done",
            result: ev.data.content,
          },
        ],
      };
      return { ...state, display: upsertDisplayItem(state.display, item) };
    }
    default:
      return state;
  }
}

export function appendUserMessage(
  state: CodingThreadState,
  content: string,
  attachments?: Array<{
    filename: string;
    mime_type: string;
    size: number;
    previewUrl?: string;
  }>,
): CodingThreadState {
  return {
    ...state,
    display: upsertDisplayItem(state.display, {
      type: "message",
      role: "user",
      content,
      ...(attachments?.length ? { attachments } : {}),
    }),
    streamText: "",
    streaming: true,
  };
}

/** 流结束后若仍有未 commit 的 streamText，落成 assistant message */
export function commitStreamTextIfAny(state: CodingThreadState): CodingThreadState {
  const text = state.streamText.trim();
  if (!text) return { ...state, streamText: "", streaming: false };
  return {
    ...state,
    display: upsertDisplayItem(state.display, {
      type: "message",
      role: "assistant",
      content: state.streamText,
    }),
    streamText: "",
    streaming: false,
  };
}
