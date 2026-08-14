import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LlmTurnMessage } from "@freeanima/habitat/core/provider";
import { cleanToolCallsForApi } from "@freeanima/habitat/core/provider/stream-tools";

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
      const cleanedCalls = msg.tool_calls?.length ? cleanToolCallsForApi(msg.tool_calls) : [];
      const out: ChatCompletionMessageParam & { reasoning_content?: string } = {
        role: "assistant",
        content: msg.content ?? (cleanedCalls.length > 0 ? null : ""),
      };
      const reasoningText = msg.reasoning || "";
      if (reasoningText) out.reasoning_content = reasoningText;
      if (msg.name) (out as { name?: string }).name = msg.name;
      if (cleanedCalls.length > 0) {
        out.tool_calls = cleanedCalls.map((tc) => ({
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
    case "system": {
      const out: ChatCompletionMessageParam = { role: "system", content: msg.content };
      if (msg.name) (out as { name?: string }).name = msg.name;
      return out;
    }
    default: {
      const _exhaustive: never = msg;
      throw new Error(`Unknown message role: ${JSON.stringify(_exhaustive)}`);
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
    const msg = messages[i];
    if (msg === undefined) continue;
    apiMessages.push(sanitizeTurnForApi(messages, i, msg));
  }
  return apiMessages;
}
