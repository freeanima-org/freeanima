import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LlmTurnMessage } from "@freeanima/engine-provider-llm";
import { cleanToolCallsForApi } from "./stream-tools.js";

function resolveToolName(
  messages: LlmTurnMessage[],
  index: number,
  msg: Extract<LlmTurnMessage, { role: "tool" }>,
): string | undefined {
  if (msg.name) return msg.name;
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

function sanitizeTurnForApi(
  messages: LlmTurnMessage[],
  index: number,
  msg: LlmTurnMessage,
): ChatCompletionMessageParam {
  switch (msg.role) {
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
        out.tool_calls = cleanToolCallsForApi(msg.tool_calls).map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: tc.function,
        }));
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
    default: {
      const _exhaustive: never = msg;
      throw new Error(`未知消息 role: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function messagesForApi(
  messages: LlmTurnMessage[],
  systemPrompt?: string,
): ChatCompletionMessageParam[] {
  const apiMessages: ChatCompletionMessageParam[] = [];
  if (systemPrompt?.trim()) {
    apiMessages.push({ role: "system", content: systemPrompt });
  }
  for (let i = 0; i < messages.length; i++) {
    apiMessages.push(sanitizeTurnForApi(messages, i, messages[i]!));
  }
  return apiMessages;
}
