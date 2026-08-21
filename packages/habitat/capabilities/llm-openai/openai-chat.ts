import type {
  BackendContext,
  ChatRequest,
  ChatStreamEvent,
  ToolCall,
} from "@freeanima/habitat/core/provider";
import { createOpenAiClient } from "./client.ts";
import { parseOpenAiCompatibleContext, resolveChatTimeouts } from "./context.ts";
import { buildStreamingChatCompletionParams } from "./request-params.ts";
import {
  createLlmTimeoutController,
  extractLlmTimeoutError,
  isLlmTimeoutError,
  mergeAbortSignals,
} from "./request-timeouts.ts";
import { finalizeStreamingToolCalls, mergeStreamingToolCalls } from "./stream-tools.ts";
import { normalizeUsage } from "./usage.ts";
import { asRecord } from "@freeanima/shared/util";

function rethrowTimeout(err: unknown): never {
  const llm = extractLlmTimeoutError(err);
  if (llm) throw llm;
  throw err;
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
      { signal: mergeAbortSignals(timeouts.signal, request.signal) },
    );

    for await (const chunk of stream) {
      timeouts.onChunk();
      if (chunk.model) modelName = chunk.model;
      if (chunk.usage) {
        lastUsage = normalizeUsage(asRecord(chunk.usage) ?? {});
      }
      const choice = chunk.choices[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = asRecord(choice?.delta);
      if (typeof delta?.content === "string" && delta.content) {
        yield { type: "content", content: delta.content };
      }
      const reasoningDelta =
        (typeof delta?.reasoning_content === "string" && delta.reasoning_content) ||
        (typeof delta?.reasoning === "string" && delta.reasoning) ||
        "";
      if (reasoningDelta) reasoningParts.push(reasoningDelta);
      if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenAI stream tool_calls 增量边界
        toolCallsAcc = mergeStreamingToolCalls(toolCallsAcc, delta.tool_calls as ToolCall[]);
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
