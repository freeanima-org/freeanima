import type { LlmTurnMessage, OpenAiToolSchema, ToolCall } from "./messages.ts";
import type { LlmCallParams } from "./model.ts";

/** Backend invoke 入参：model 由 Profile 绑定配置提供，不在此 DTO */
export type ChatRequest = {
  messages: LlmTurnMessage[];
  systemPrompt?: string;
  params: LlmCallParams;
  tools?: OpenAiToolSchema[];
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
