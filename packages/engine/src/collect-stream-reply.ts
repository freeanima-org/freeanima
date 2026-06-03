import type { StreamEvent } from "./engine";

/** 将引擎/Rruntime 流式事件收集为最终回复文本（供非 SSE 消费方使用）。 */
export async function collectStreamReply(events: AsyncIterable<StreamEvent>): Promise<string> {
  const parts: string[] = [];
  for await (const event of events) {
    switch (event.event) {
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
