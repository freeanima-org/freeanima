import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ChatRequest } from "@freeanima/core/provider";
import { messagesForApi } from "./messages.ts";

const DEFAULT_MAX_OUTPUT_TOKENS = 100 * 1024;

function baseBody(model: string, request: ChatRequest): Omit<ChatCompletionCreateParams, "stream"> {
  const { params, messages, systemPrompt, tools } = request;
  const body: Omit<ChatCompletionCreateParams, "stream"> = {
    model,
    messages: messagesForApi(messages, systemPrompt),
    max_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    tools: tools?.length ? (tools as ChatCompletionTool[]) : undefined,
  };

  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.topP !== undefined) body.top_p = params.topP;
  if (params.stop !== undefined) body.stop = params.stop;
  if (params.extra) {
    Object.assign(body, params.extra);
  }

  return body;
}

export function buildChatCompletionParams(
  model: string,
  request: ChatRequest,
): ChatCompletionCreateParams & { stream?: false } {
  return { ...baseBody(model, request), stream: false };
}

export function buildStreamingChatCompletionParams(
  model: string,
  request: ChatRequest,
): ChatCompletionCreateParamsStreaming {
  return {
    ...baseBody(model, request),
    stream: true,
    stream_options: { include_usage: true },
  };
}
