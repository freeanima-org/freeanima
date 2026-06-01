import type { StreamEvent } from "@freeanima/engine";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "./clarify/index.js";

/** 网关消费流式事件并拼接为平台可见的最终回复（含工具/clarify 格式化）。 */
export async function collectGatewayStreamReply(
  events: AsyncIterable<StreamEvent>,
  platform: "discord" | "weixin" | "parlor" = "parlor",
): Promise<string> {
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
      case "awaiting_clarify": {
        const payload = parseClarifyStreamEvent(event.data);
        if (payload) {
          parts.push(`\n${formatClarifyForPlatform(platform, payload)}`);
        }
        break;
      }
      case "tool_begin": {
        const tool = event.data.name;
        if (tool !== "clarify") {
          parts.push(`\n🔧 ${tool}(...)`);
        }
        break;
      }
      case "tool_result": {
        if (event.data.name === "clarify") break;
        parts.push(` → ${event.data.content.slice(0, 200)}`);
        break;
      }
      case "tool_error":
        parts.push(`\n❌ ${event.data.content}`);
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
