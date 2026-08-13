import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import {
  LlmBackend,
  type BackendContext,
  type ChatCompletion,
  type ChatRequest,
  type ChatStreamEvent,
  type LlmTurnMessage,
  type ModelInfo,
  type ProviderError,
  type ToolCall,
  ProviderError as ProviderErrorClass,
  providerErrorFromHttpStatus,
} from "@freeanima/host/core/provider";
import { LLM_FORMAT_ANTHROPIC_MESSAGES } from "@freeanima/host/core/config";
import { omitUndefined } from "@freeanima/host/core/util";
import { cleanToolCallsForApi } from "@freeanima/host/core/provider/stream-tools";
import { defaultModelInfoEnriched } from "../catalog.ts";
import {
  parseOpenAiCompatibleContext,
  resolveChatTimeouts,
  type OpenAiCompatibleContext,
} from "../context.ts";
import {
  createLlmTimeoutController,
  extractLlmTimeoutError,
  isLlmTimeoutError,
} from "../request-timeouts.ts";
import { normalizeUsage } from "../usage.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export const ANTHROPIC_MESSAGES_FORMAT_ID = LLM_FORMAT_ANTHROPIC_MESSAGES;

const DEFAULT_MAX_OUTPUT_TOKENS = 100 * 1024;

function rethrowTimeout(err: unknown): never {
  const llm = extractLlmTimeoutError(err);
  if (llm) throw llm;
  throw err;
}

function createAnthropicClient(context: OpenAiCompatibleContext): Anthropic {
  return new Anthropic({
    apiKey: context.apiKey,
    baseURL: context.baseUrl,
    timeout: context.timeoutMs,
  });
}

function toAnthropicMessages(messages: LlmTurnMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const msg of messages) {
    switch (msg.role) {
      case "user":
        out.push({ role: "user", content: msg.content });
        break;
      case "system":
        // system handled separately
        break;
      case "assistant": {
        const cleaned = msg.tool_calls?.length ? cleanToolCallsForApi(msg.tool_calls) : [];
        const contentBlocks: Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        > = [];
        if (msg.content) contentBlocks.push({ type: "text", text: msg.content });
        for (const tc of cleaned) {
          let input: Record<string, unknown> = {};
          try {
            const parsed: unknown = JSON.parse(tc.function.arguments || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              input = parsed as Record<string, unknown>;
            }
          } catch {
            input = {};
          }
          contentBlocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
        if (contentBlocks.length === 0) contentBlocks.push({ type: "text", text: "" });
        out.push({ role: "assistant", content: contentBlocks });
        break;
      }
      case "tool": {
        const block: ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        };
        const last = out[out.length - 1];
        if (last?.role === "user" && Array.isArray(last.content)) {
          (last.content as ToolResultBlockParam[]).push(block);
        } else {
          out.push({ role: "user", content: [block] });
        }
        break;
      }
      default: {
        const _exhaustive: never = msg;
        throw new Error(`Unknown message role: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  return out;
}

function toAnthropicTools(request: ChatRequest): Tool[] | undefined {
  if (!request.tools?.length) return undefined;
  return request.tools.map((t) =>
    omitUndefined({
      name: t.function.name,
      description: t.function.description,
      input_schema: (t.function.parameters ?? {
        type: "object",
        properties: {},
      }) as Tool["input_schema"],
    }),
  );
}

function mapAnthropicError(err: unknown, meta?: { providerId?: string }): ProviderError {
  if (err instanceof ProviderErrorClass) return err;
  const llmTimeout = isLlmTimeoutError(err) ? err : extractLlmTimeoutError(err);
  if (llmTimeout) {
    return new ProviderErrorClass(
      llmTimeout.message,
      "timeout",
      true,
      omitUndefined({ providerId: meta?.providerId, cause: llmTimeout }),
    );
  }
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status ?? 0;
    const message = err instanceof Error ? err.message : coerceString(err);
    return providerErrorFromHttpStatus(
      status,
      message,
      omitUndefined({
        providerId: meta?.providerId,
        cause: err instanceof Error ? err : undefined,
      }),
    );
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return new ProviderErrorClass(
        err.message,
        "timeout",
        true,
        omitUndefined({ providerId: meta?.providerId, cause: err }),
      );
    }
    if (msg.includes("abort") || err.name === "AbortError") {
      return new ProviderErrorClass(
        err.message,
        "cancelled",
        false,
        omitUndefined({ providerId: meta?.providerId, cause: err }),
      );
    }
  }
  return new ProviderErrorClass(
    err instanceof Error ? err.message : String(err),
    "unknown",
    false,
    omitUndefined({ providerId: meta?.providerId, cause: err instanceof Error ? err : undefined }),
  );
}

export async function runAnthropicMessages(
  model: string,
  request: ChatRequest,
  context: BackendContext,
): Promise<ChatCompletion> {
  const parsed = parseOpenAiCompatibleContext(context);
  const { overallMs, firstByteMs } = resolveChatTimeouts(parsed);
  const timeouts = createLlmTimeoutController({
    overallMs,
    firstByteMs,
    idleMs: null,
  });
  const client = createAnthropicClient(parsed);
  const started = performance.now();
  try {
    const system =
      request.systemPrompt?.trim() ||
      request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
    const response = await client.messages.create(
      omitUndefined({
        model,
        max_tokens: request.params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        system: system || undefined,
        messages: toAnthropicMessages(request.messages),
        tools: toAnthropicTools(request),
        temperature: request.params.temperature,
        top_p: request.params.topP,
        ...request.params.extra,
      }),
      { signal: timeouts.signal },
    );
    timeouts.onFirstByte();
    const latency_ms = Math.round(performance.now() - started);
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];
    for (const block of response.content) {
      if (block.type === "text") textParts.push(block.text);
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        });
      }
    }
    return omitUndefined({
      content: textParts.join("") || (toolCalls.length > 0 ? null : ""),
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
      finish_reason: response.stop_reason ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
      usage: normalizeUsage({
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      }),
      latency_ms,
      model: response.model ?? model,
    });
  } catch (err) {
    if (timeouts.signal.aborted && isLlmTimeoutError(timeouts.signal.reason)) {
      throw timeouts.signal.reason;
    }
    return rethrowTimeout(err);
  } finally {
    timeouts.dispose();
  }
}

export async function* runAnthropicMessagesStream(
  model: string,
  request: ChatRequest,
  context: BackendContext,
): AsyncGenerator<ChatStreamEvent> {
  const parsed = parseOpenAiCompatibleContext(context);
  const { overallMs, firstByteMs, idleMs } = resolveChatTimeouts(parsed);
  const timeouts = createLlmTimeoutController({
    overallMs,
    firstByteMs,
    idleMs,
  });
  const client = createAnthropicClient(parsed);
  const toolCallsAcc = new Map<number, { id: string; name: string; arguments: string }>();
  let modelName = model;
  let lastUsage: Record<string, number> | null = null;
  let finishReason: string | null = null;

  try {
    const system =
      request.systemPrompt?.trim() ||
      request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
    const stream = client.messages.stream(
      omitUndefined({
        model,
        max_tokens: request.params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        system: system || undefined,
        messages: toAnthropicMessages(request.messages),
        tools: toAnthropicTools(request),
        temperature: request.params.temperature,
        top_p: request.params.topP,
        ...request.params.extra,
      }),
      { signal: timeouts.signal },
    );

    for await (const event of stream) {
      timeouts.onChunk();
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "content", content: event.delta.text };
      }
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        toolCallsAcc.set(event.index, {
          id: event.content_block.id,
          name: event.content_block.name,
          arguments: "",
        });
      }
      if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        const acc = toolCallsAcc.get(event.index);
        if (acc) acc.arguments += event.delta.partial_json;
      }
      if (event.type === "message_delta") {
        if (event.delta.stop_reason) finishReason = event.delta.stop_reason;
        if (event.usage) {
          lastUsage = normalizeUsage({
            prompt_tokens: 0,
            completion_tokens: event.usage.output_tokens,
            total_tokens: event.usage.output_tokens,
          });
        }
      }
      if (event.type === "message_start" && event.message.model) {
        modelName = event.message.model;
        lastUsage = normalizeUsage({
          prompt_tokens: event.message.usage.input_tokens,
          completion_tokens: event.message.usage.output_tokens,
          total_tokens: event.message.usage.input_tokens + event.message.usage.output_tokens,
        });
      }
    }

    const tool_calls: ToolCall[] = [...toolCallsAcc.values()].map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments || "{}" },
    }));
    if (tool_calls.length > 0) yield { type: "tool_calls", tool_calls };
    yield {
      type: "done",
      usage: lastUsage,
      finish_reason: finishReason ?? (tool_calls.length > 0 ? "tool_calls" : "stop"),
      model: modelName,
    };
    return;
  } catch (err) {
    if (timeouts.signal.aborted && isLlmTimeoutError(timeouts.signal.reason)) {
      throw timeouts.signal.reason;
    }
    rethrowTimeout(err);
  } finally {
    timeouts.dispose();
  }
}

/** Anthropic Messages API format adapter. */
export class AnthropicMessagesBackend extends LlmBackend {
  async listModels(_context: BackendContext): Promise<ModelInfo[]> {
    return [];
  }

  async getModel(model: string, _context: BackendContext): Promise<ModelInfo | null> {
    return defaultModelInfoEnriched(model);
  }

  mapError(err: unknown, _context: BackendContext, meta?: { providerId?: string }): ProviderError {
    return mapAnthropicError(err, meta);
  }

  chat(model: string, request: ChatRequest, context: BackendContext): Promise<ChatCompletion> {
    return runAnthropicMessages(model, request, context);
  }

  chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): AsyncIterable<ChatStreamEvent> {
    return runAnthropicMessagesStream(model, request, context);
  }
}
