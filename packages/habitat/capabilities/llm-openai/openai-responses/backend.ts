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
} from "@freeanima/habitat/core/provider";
import { LLM_FORMAT_OPENAI_RESPONSES } from "@freeanima/habitat/core/config";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { cleanToolCallsForApi } from "@freeanima/habitat/core/provider/stream-tools";
import { createOpenAiClient } from "../client.ts";
import { parseOpenAiCompatibleContext, resolveChatTimeouts } from "../context.ts";
import {
  createLlmTimeoutController,
  extractLlmTimeoutError,
  isLlmTimeoutError,
} from "../request-timeouts.ts";
import { mapOpenAiCompatibleError } from "../map-error.ts";
import { defaultModelInfo, defaultModelInfoEnriched } from "../catalog.ts";
import { enrichCatalogFromModelsDev } from "../models-dev/enrich.ts";
import { normalizeUsage } from "../usage.ts";

export const OPENAI_RESPONSES_FORMAT_ID = LLM_FORMAT_OPENAI_RESPONSES;

function rethrowTimeout(err: unknown): never {
  const llm = extractLlmTimeoutError(err);
  if (llm) throw llm;
  throw err;
}

/** Stateless Responses `input` from Habitat OpenAI-shaped turns. */
function turnsToResponseInput(
  messages: LlmTurnMessage[],
  systemPrompt?: string,
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  if (systemPrompt?.trim()) {
    items.push({ role: "system", content: systemPrompt });
  }
  for (const msg of messages) {
    switch (msg.role) {
      case "user": {
        const media = msg.content_media?.filter((m) => m.type === "image") ?? [];
        if (media.length === 0) {
          items.push({ role: "user", content: msg.content });
          break;
        }
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content.trim()) {
          parts.push({ type: "input_text", text: msg.content });
        }
        for (const m of media) {
          parts.push({
            type: "input_image",
            image_url: `data:${m.mime_type};base64,${m.data_base64}`,
          });
        }
        if (parts.length === 0) {
          parts.push({ type: "input_text", text: msg.content || "(附件)" });
        }
        items.push({ role: "user", content: parts });
        break;
      }
      case "system":
        items.push({ role: msg.role, content: msg.content });
        break;
      case "assistant": {
        const cleaned = msg.tool_calls?.length ? cleanToolCallsForApi(msg.tool_calls) : [];
        if (cleaned.length > 0) {
          for (const tc of cleaned) {
            items.push({
              type: "function_call",
              call_id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
          }
        }
        if (msg.content) {
          items.push({ role: "assistant", content: msg.content });
        } else if (cleaned.length === 0) {
          items.push({ role: "assistant", content: "" });
        }
        break;
      }
      case "tool":
        items.push({
          type: "function_call_output",
          call_id: msg.tool_call_id,
          output: msg.content,
        });
        break;
      default: {
        const _exhaustive: never = msg;
        throw new Error(`Unknown message role: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  return items;
}

function buildTools(request: ChatRequest): Array<Record<string, unknown>> | undefined {
  if (!request.tools?.length) return undefined;
  return request.tools.map((t) =>
    omitUndefined({
      type: "function" as const,
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }),
  );
}

function extractToolCallsFromResponse(output: unknown): ToolCall[] {
  if (!Array.isArray(output)) return [];
  const calls: ToolCall[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "function_call") continue;
    const id =
      typeof row.call_id === "string" ? row.call_id : typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name : "";
    const args = typeof row.arguments === "string" ? row.arguments : "{}";
    if (!id || !name) continue;
    calls.push({ id, type: "function", function: { name, arguments: args } });
  }
  return calls;
}

export async function runOpenAiResponses(
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
  const client = createOpenAiClient(context);
  const started = performance.now();
  try {
    const response = await client.responses.create(
      omitUndefined({
        model,
        input: turnsToResponseInput(request.messages, request.systemPrompt) as never,
        max_output_tokens: request.params.maxOutputTokens,
        tools: buildTools(request) as never,
        temperature: request.params.temperature,
        top_p: request.params.topP,
        ...request.params.extra,
      }),
      { signal: timeouts.signal },
    );
    timeouts.onFirstByte();
    const latency_ms = Math.round(performance.now() - started);
    const tool_calls = extractToolCallsFromResponse(response.output);
    const content = typeof response.output_text === "string" ? response.output_text : "";
    return {
      content: content || (tool_calls.length > 0 ? null : ""),
      tool_calls: tool_calls.length > 0 ? tool_calls : null,
      finish_reason: tool_calls.length > 0 ? "tool_calls" : "stop",
      usage: normalizeUsage(response.usage as unknown as Record<string, unknown>),
      latency_ms,
      model: response.model ?? model,
    };
  } catch (err) {
    if (timeouts.signal.aborted && isLlmTimeoutError(timeouts.signal.reason)) {
      throw timeouts.signal.reason;
    }
    return rethrowTimeout(err);
  } finally {
    timeouts.dispose();
  }
}

export async function* runOpenAiResponsesStream(
  model: string,
  request: ChatRequest,
  context: BackendContext,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const parsed = parseOpenAiCompatibleContext(context);
  const { overallMs, firstByteMs, idleMs } = resolveChatTimeouts(parsed);
  const timeouts = createLlmTimeoutController({
    overallMs,
    firstByteMs,
    idleMs,
    ...(signal ? { external: signal } : {}),
  });
  const client = createOpenAiClient(context);
  let modelName = model;
  let lastUsage: Record<string, number> | null = null;
  let toolCalls: ToolCall[] = [];

  try {
    const stream = await client.responses.create(
      omitUndefined({
        model,
        input: turnsToResponseInput(request.messages, request.systemPrompt) as never,
        max_output_tokens: request.params.maxOutputTokens,
        tools: buildTools(request) as never,
        stream: true as const,
        temperature: request.params.temperature,
        top_p: request.params.topP,
        ...request.params.extra,
      }),
      { signal: timeouts.signal },
    );

    for await (const event of stream as AsyncIterable<{
      type?: string;
      delta?: string;
      response?: {
        model?: string;
        usage?: Record<string, unknown>;
        output?: unknown;
      };
    }>) {
      timeouts.onChunk();
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        yield { type: "content", content: event.delta };
      }
      if (event.type === "response.completed" && event.response) {
        if (event.response.model) modelName = event.response.model;
        if (event.response.usage) {
          lastUsage = normalizeUsage(event.response.usage);
        }
        toolCalls = extractToolCallsFromResponse(event.response.output);
      }
    }

    if (toolCalls.length > 0) yield { type: "tool_calls", tool_calls: toolCalls };
    yield {
      type: "done",
      usage: lastUsage,
      finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
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

/** OpenAI Responses API format adapter. */
export class OpenAiResponsesBackend extends LlmBackend {
  async listModels(context: BackendContext): Promise<ModelInfo[]> {
    const client = createOpenAiClient(context);
    try {
      const page = await client.models.list();
      const out: ModelInfo[] = [];
      for await (const m of page) {
        out.push(defaultModelInfo(m.id));
      }
      return enrichCatalogFromModelsDev(out, { preferModelsDevLimits: true });
    } catch {
      return [];
    }
  }

  async getModel(model: string, _context: BackendContext): Promise<ModelInfo | null> {
    return defaultModelInfoEnriched(model);
  }

  mapError(err: unknown, _context: BackendContext, meta?: { providerId?: string }): ProviderError {
    return mapOpenAiCompatibleError(err, meta);
  }

  chat(model: string, request: ChatRequest, context: BackendContext): Promise<ChatCompletion> {
    return runOpenAiResponses(model, request, context);
  }

  chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    return runOpenAiResponsesStream(model, request, context, signal);
  }
}
