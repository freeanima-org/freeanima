import type { LlmTurnMessage, OpenAiToolSchema, ToolCall } from "./messages.ts";
import type { LlmCallParams } from "./model.ts";

/** Backend invoke input: model from Profile binding, not in this DTO */
export type ChatRequest = {
  messages: LlmTurnMessage[];
  systemPrompt?: string;
  params: LlmCallParams;
  tools?: OpenAiToolSchema[];
  /** 调用方墙钟 / 取消；backend 与自身超时 signal 合并后传给 fetch */
  signal?: AbortSignal;
};

export type ChatCompletion = {
  content: string | null;
  reasoning?: string | null;
  tool_calls?: ToolCall[] | null;
  finish_reason?: string | null;
  usage?: Record<string, number> | null;
  latency_ms?: number;
  model?: string;
};

export type ChatStreamEvent =
  | { type: "content"; content: string }
  | { type: "tool_calls"; tool_calls: ToolCall[] }
  | {
      type: "done";
      reasoning?: string | null;
      usage?: Record<string, number> | null;
      finish_reason?: string | null;
      model?: string;
    };
