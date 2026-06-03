import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { loadConfig } from "@freeanima/legacy-kernel";
import { logComponent } from "@freeanima/legacy-kernel";
import type { SessionMessage, ToolMessage } from "@freeanima/legacy-kernel";
import type { OpenAiToolSchema } from "@freeanima/legacy-kernel";
import { repairToolLoopMessages } from "./tool-loop-integrity";

export class LLMError extends Error {
  constructor(
    message: string,
    readonly statusCode = 0,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export type FinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "function_call"
  | string;

export type LlmResponse = {
  content: string | null;
  reasoning?: string | null;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | null;
  finish_reason?: FinishReason | null;
  usage?: Record<string, number> | null;
  latency_ms?: number;
  model?: string;
};

/** 将各厂商 usage 归一化为稳定字段（与 Python llm.normalize_usage 对齐） */
export function normalizeUsage(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;

  const prompt = raw.prompt_tokens ?? raw.input_tokens;
  const completion = raw.completion_tokens ?? raw.output_tokens;
  let cached = raw.cached_tokens ?? raw.cache_read_input_tokens;
  if (cached == null) {
    for (const key of ["prompt_tokens_details", "input_tokens_details"] as const) {
      const details = raw[key];
      if (details && typeof details === "object" && (details as Record<string, unknown>).cached_tokens != null) {
        cached = (details as Record<string, unknown>).cached_tokens;
        break;
      }
    }
  }

  const out: Record<string, number> = {};
  if (prompt != null) out.prompt_tokens = Number(prompt);
  if (completion != null) out.completion_tokens = Number(completion);
  if (cached != null && typeof cached === "number") out.cached_tokens = cached;
  if (raw.total_tokens != null) out.total_tokens = Number(raw.total_tokens);
  return Object.keys(out).length ? out : null;
}

export type StreamToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

/** 流式 tool_calls 按 index 合并（与 Python llm.py 一致，禁止 concat 碎片） */
export function mergeStreamingToolCalls(
  acc: Record<number, StreamToolCall>,
  deltas: StreamToolCall[],
): Record<number, StreamToolCall> {
  for (const tc of deltas) {
    const idx = (tc as StreamToolCall & { index?: number }).index ?? 0;
    const fn = tc.function ?? { name: "", arguments: "" };
    if (!(idx in acc)) {
      acc[idx] = {
        id: tc.id ?? "",
        type: tc.type ?? "function",
        function: {
          name: fn.name ?? "",
          arguments: fn.arguments ?? "",
        },
      };
      continue;
    }
    const cur = acc[idx]!;
    if (fn.arguments) {
      cur.function.arguments = (cur.function.arguments ?? "") + fn.arguments;
    }
    if (fn.name) {
      cur.function.name = (cur.function.name ?? "") + fn.name;
    }
    if (tc.id) cur.id = tc.id;
    if (tc.type) cur.type = tc.type;
  }
  return acc;
}

export function finalizeStreamingToolCalls(
  acc: Record<number, StreamToolCall>,
): StreamToolCall[] {
  return Object.keys(acc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => acc[i]!)
    .filter((tc) => tc.id && tc.function?.name);
}

export function cleanToolCallsForApi(toolCalls: StreamToolCall[]): StreamToolCall[] {
  return toolCalls
    .map((tc) => ({
      id: tc.id ?? "",
      type: tc.type ?? "function",
      function: {
        name: (tc.function?.name ?? "").trim(),
        arguments: tc.function?.arguments ?? "{}",
      },
    }))
    .filter((tc) => tc.id && tc.function.name);
}

function resolveToolName(
  messages: SessionMessage[],
  index: number,
  msg: ToolMessage,
): string | undefined {
  const existing = msg.name;
  if (existing) return existing;
  const callId = msg.tool_call_id;
  if (!callId) return undefined;
  for (let i = index - 1; i >= 0; i--) {
    const prev = messages[i];
    if (!prev || prev.role !== "assistant") continue;
    const calls = prev.tool_calls;
    if (!calls?.length) continue;
    for (const tc of calls) {
      if (tc.id !== callId) continue;
      const name = tc.function.name;
      if (name) return name;
    }
    break;
  }
  return undefined;
}

function sanitizeMessageForApi(
  messages: SessionMessage[],
  index: number,
  msg: SessionMessage,
): ChatCompletionMessageParam {
  switch (msg.role) {
    case "system":
      return { role: "system", content: msg.content };
    case "user": {
      const out: ChatCompletionMessageParam = { role: "user", content: msg.content };
      if (msg.name) (out as { name?: string }).name = msg.name;
      return out;
    }
    case "assistant": {
      const out: ChatCompletionMessageParam & { reasoning_content?: string } = {
        role: "assistant",
        content: msg.content ?? null,
      };
      const reasoningText = msg.reasoning_content || msg.reasoning || "";
      if (reasoningText) out.reasoning_content = reasoningText;
      if (msg.tool_calls?.length) {
        out.tool_calls = cleanToolCallsForApi(msg.tool_calls as StreamToolCall[]);
      }
      return out;
    }
    case "tool": {
      const name = resolveToolName(messages, index, msg) ?? msg.name ?? "unknown";
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id,
        content: msg.content,
        name,
      } as ChatCompletionMessageParam;
    }
    case "session_meta": {
      logComponent("llm").error("session_meta 消息不应进入 LLM 上下文");
      return { role: "system", content: "" };
    }
    default: {
      const _exhaustive: never = msg;
      logComponent("llm").error(`未知消息 role，已跳过: ${JSON.stringify(_exhaustive)}`);
      throw new LLMError(`未知消息 role，无法发送给 LLM`);
    }
  }
}

function prepareMessages(messages: SessionMessage[]): ChatCompletionMessageParam[] {
  const repaired = repairToolLoopMessages(messages);
  return repaired.map((msg, index) => sanitizeMessageForApi(repaired, index, msg));
}

/** @internal 单测：API 出站消息清洗 */
export function messagesForApi(messages: SessionMessage[]): ChatCompletionMessageParam[] {
  return prepareMessages(messages);
}

function getClient(apiBase?: string, apiKey?: string): OpenAI {
  const cfg = loadConfig();
  const baseURL = (apiBase ?? cfg.api_base ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const key = apiKey ?? cfg.api_key ?? "";
  if (!key) throw new LLMError(`未找到 API 密钥（${baseURL}）`);
  return new OpenAI({ apiKey: key, baseURL, timeout: 60_000 });
}

export async function chat(
  messages: SessionMessage[],
  opts?: {
    tools?: OpenAiToolSchema[];
    model?: string;
    api_base?: string;
    api_key?: string;
  },
): Promise<LlmResponse> {
  /** @deprecated 对话引擎已统一走 chatStream；保留供 compression-summary 等非流式场景 */
  const cfg = loadConfig();
  const model = opts?.model ?? cfg.model ?? "deepseek-v4-flash";
  const client = getClient(opts?.api_base, opts?.api_key);
  const started = performance.now();

  const tools = opts?.tools as ChatCompletionTool[] | undefined;
  const completion = await client.chat.completions.create({
    model,
    messages: prepareMessages(messages),
    max_tokens: 100 * 1024,
    tools: tools?.length ? tools : undefined,
  });

  const latency_ms = Math.round(performance.now() - started);
  const choice = completion.choices[0];
  const msg = choice?.message;
  if (!msg) throw new LLMError("空响应");

  const base: LlmResponse = {
    content: msg.content,
    reasoning: (msg as { reasoning_content?: string }).reasoning_content ?? null,
    finish_reason: choice.finish_reason,
    usage: normalizeUsage(completion.usage as unknown as Record<string, unknown>),
    latency_ms,
    model,
  };

  if (msg.tool_calls?.length) {
    return { ...base, tool_calls: msg.tool_calls };
  }
  return { ...base, content: msg.content ?? "", tool_calls: null };
}

export async function* chatStream(
  messages: SessionMessage[],
  opts?: {
    tools?: OpenAiToolSchema[];
    model?: string;
  },
): AsyncGenerator<
  | { type: "content"; content: string }
  | { type: "tool_calls"; tool_calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] }
  | {
      type: "done";
      reasoning?: string | null;
      usage?: Record<string, number> | null;
      finish_reason?: string | null;
      model?: string;
    }
> {
  const cfg = loadConfig();
  const model = opts?.model ?? cfg.model ?? "deepseek-v4-flash";
  const client = getClient();
  const tools = opts?.tools as ChatCompletionTool[] | undefined;

  const stream = await client.chat.completions.create({
    model,
    messages: prepareMessages(messages),
    max_tokens: 100 * 1024,
    tools: tools?.length ? tools : undefined,
    stream: true,
    stream_options: { include_usage: true },
  });

  let toolCallsAcc: Record<number, StreamToolCall> = {};
  const reasoningParts: string[] = [];
  let finishReason: string | null = null;
  let modelName = model;
  let lastUsage: Record<string, number> | null = null;

  for await (const chunk of stream) {
    if (chunk.model) modelName = chunk.model;
    if (chunk.usage) {
      lastUsage = normalizeUsage(chunk.usage as unknown as Record<string, unknown>);
    }
    const choice = chunk.choices[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const delta = choice?.delta as
      | (Record<string, unknown> & { content?: string; tool_calls?: StreamToolCall[] })
      | undefined;
    if (delta?.content) yield { type: "content", content: delta.content };
    const reasoningDelta =
      (typeof delta?.reasoning_content === "string" && delta.reasoning_content) ||
      (typeof delta?.reasoning === "string" && delta.reasoning) ||
      "";
    if (reasoningDelta) reasoningParts.push(reasoningDelta);
    if (delta?.tool_calls?.length) {
      toolCallsAcc = mergeStreamingToolCalls(toolCallsAcc, delta.tool_calls);
    }
  }
  const toolCalls = finalizeStreamingToolCalls(toolCallsAcc);
  const reasoning = reasoningParts.length ? reasoningParts.join("") : null;
  if (toolCalls.length) yield { type: "tool_calls", tool_calls: toolCalls };
  yield {
    type: "done",
    reasoning,
    usage: lastUsage,
    finish_reason: finishReason ?? (toolCalls.length ? "tool_calls" : "stop"),
    model: modelName,
  };
}
