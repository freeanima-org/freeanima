import type { StreamEvent } from "@freeanima/engine-loop";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "./clarify/index.ts";
import { ToolRoundCollector, isClarifyTool } from "./stream-tool-format.ts";

/** 网关消费流式事件并拼接为平台可见的最终回复（含工具/clarify 格式化）。 */
export async function collectGatewayStreamReply(
  events: AsyncIterable<StreamEvent>,
  platform: "discord" | "weixin" | "parlor" = "parlor",
): Promise<string> {
  const toolSegments: string[] = [];
  const answerParts: string[] = [];
  const toolRound = new ToolRoundCollector();

  const flushToolRound = (): void => {
    const text = toolRound.take();
    if (text) toolSegments.push(text);
  };

  for await (const event of events) {
    switch (event.event) {
      case "token":
        flushToolRound();
        answerParts.push(event.data.content);
        break;
      case "content_replace":
        flushToolRound();
        answerParts.length = 0;
        answerParts.push(event.data.content);
        break;
      case "awaiting_clarify": {
        flushToolRound();
        const payload = parseClarifyStreamEvent(event.data);
        if (payload) {
          toolSegments.push(formatClarifyForPlatform(platform, payload));
        }
        break;
      }
      case "tool_begin":
        flushToolRound();
        answerParts.length = 0;
        if (!isClarifyTool(event.data.name)) {
          toolRound.addBegin(event.data.name, event.data.args);
        }
        break;
      case "tool_result":
        if (!isClarifyTool(event.data.name)) {
          toolRound.addResult(event.data.name, event.data.content);
        }
        break;
      case "tool_error":
        toolRound.addError(event.data.content);
        break;
      case "error":
        throw new Error(event.data.error);
      case "interrupted":
        throw new Error(event.data.reason);
      case "done":
        break;
    }
  }

  flushToolRound();
  const answer = answerParts.join("").trim();
  const blocks = [...toolSegments];
  if (answer) blocks.push(answer);
  return blocks.join("\n\n").trim();
}
