import type {
  BackendContext,
  ChatCompletion,
  ChatRequest,
  ChatStreamEvent,
  ToolCall,
} from "@freeanima/habitat/core/provider";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import { createOpenAiClient } from "./client.ts";
import { parseOpenAiCompatibleContext, resolveChatTimeouts } from "./context.ts";
import { buildChatCompletionParams, buildStreamingChatCompletionParams } from "./request-params.ts";
import {
  createLlmTimeoutController,
  extractLlmTimeoutError,
  isLlmTimeoutError,
} from "./request-timeouts.ts";
import { finalizeStreamingToolCalls, mergeStreamingToolCalls } from "./stream-tools.ts";
import { normalizeUsage } from "./usage.ts";

function rethrowTimeout(err: unknown): never {
  const llm = extractLlmTimeoutError(err);
  if (llm) throw llm;
  throw err;
}

export async function runOpenAiChat(
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
    const completion = await client.chat.completions.create(
      buildChatCompletionParams(model, request),
      { signal: timeouts.signal },
    );
    timeouts.onFirstByte();

    const latency_ms = Math.round(performance.now() - started);
    const choice = completion.choices[0];
    const msg = choice?.message;
    if (!msg) {
      throw new Error("Empty response");
    }

    const base: ChatCompletion = {
      content: msg.content,
      reasoning: (msg as { reasoning_content?: string }).reasoning_content ?? null,
      finish_reason: choice.finish_reason,
      usage: normalizeUsage(completion.usage as unknown as Record<string, unknown>),
      latency_ms,
      model,
    };

    if (msg.tool_calls?.length) {
      const functionCalls = msg.tool_calls.filter(
        (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function",
      );
      return {
        ...base,
        tool_calls: functionCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }

    return { ...base, content: msg.content ?? "", tool_calls: null };
  } catch (err) {
    if (timeouts.signal.aborted && isLlmTimeoutError(timeouts.signal.reason)) {
      throw timeouts.signal.reason;
    }
    return rethrowTimeout(err);
  } finally {
    timeouts.dispose();
  }
}

export async function* runOpenAiChatStream(
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

  let toolCallsAcc: Record<number, ToolCall> = {};
  const reasoningParts: string[] = [];
  let finishReason: string | null = null;
  let modelName = model;
  let lastUsage: Record<string, number> | null = null;

  try {
    const stream = await client.chat.completions.create(
      buildStreamingChatCompletionParams(model, request),
      { signal: timeouts.signal },
    );

    for await (const chunk of stream) {
      timeouts.onChunk();
      if (chunk.model) modelName = chunk.model;
      if (chunk.usage) {
        lastUsage = normalizeUsage(chunk.usage as unknown as Record<string, unknown>);
      }
      const choice = chunk.choices[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta as
        | (Record<string, unknown> & { content?: string; tool_calls?: ToolCall[] })
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
    const reasoning = reasoningParts.length > 0 ? reasoningParts.join("") : null;
    if (toolCalls.length > 0) yield { type: "tool_calls", tool_calls: toolCalls };
    yield {
      type: "done",
      reasoning,
      usage: lastUsage,
      finish_reason: finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
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
