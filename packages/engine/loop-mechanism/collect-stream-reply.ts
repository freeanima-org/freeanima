import type { StreamEvent } from "./loop-engine.ts";

/** Collect engine/runtime stream events into final reply text (for non-SSE consumers). */
export async function collectStreamReply(events: AsyncIterable<StreamEvent>): Promise<string> {
  const parts: string[] = [];
  for await (const event of events) {
    switch (event.event) {
      case "accepted":
        break;
      case "token":
        parts.push(event.data.content);
        break;
      case "content_replace":
        parts.length = 0;
        parts.push(event.data.content);
        break;
      case "awaiting_clarify":
        break;
      case "tool_begin":
      case "tool_progress":
      case "tool_result":
      case "tool_error":
        break;
      case "error":
        throw new Error(event.data.error);
      case "interrupted":
        throw new Error(event.data.reason);
      case "done":
        break;
    }
  }
  return parts.join("").trim();
}
