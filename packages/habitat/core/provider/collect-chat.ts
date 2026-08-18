import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ChatCompletion, ChatStreamEvent } from "./invoke.ts";
import type { ToolCall } from "./messages.ts";

/** 把 chatStream 收成完整 ChatCompletion（侧车 Promise API） */
export async function collectChatCompletion(
  stream: AsyncIterable<ChatStreamEvent>,
): Promise<ChatCompletion> {
  const started = performance.now();
  const contentParts: string[] = [];
  let tool_calls: ToolCall[] | null = null;
  let reasoning: string | null = null;
  let usage: Record<string, number> | null = null;
  let finish_reason: string | null = null;
  let model: string | undefined;
  for await (const ev of stream) {
    switch (ev.type) {
      case "content":
        contentParts.push(ev.content);
        break;
      case "tool_calls":
        tool_calls = ev.tool_calls;
        break;
      case "done":
        reasoning = ev.reasoning ?? null;
        usage = ev.usage ?? null;
        finish_reason = ev.finish_reason ?? null;
        model = ev.model;
        break;
    }
  }
  const joined = contentParts.join("");
  const hasTools = Boolean(tool_calls && tool_calls.length > 0);
  return omitUndefined({
    content: joined || (hasTools ? null : ""),
    reasoning,
    tool_calls,
    finish_reason: finish_reason ?? (hasTools ? "tool_calls" : "stop"),
    usage,
    latency_ms: Math.round(performance.now() - started),
    model,
  });
}
