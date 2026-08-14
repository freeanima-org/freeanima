import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import {
  projectVisibleText,
  reduceStreamEvents,
  type StreamReducePlatform,
} from "./stream-state/index.ts";

/** Gateway consumes stream events and assembles platform-visible final reply (incl. tool/clarify formatting). */
export async function collectGatewayStreamReply(
  events: AsyncIterable<StreamEvent>,
  platform: StreamReducePlatform = "chat",
): Promise<string> {
  const { state } = await reduceStreamEvents(events, platform);
  return projectVisibleText(state);
}
