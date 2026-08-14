import { chunkText } from "../chunk-text.ts";
import type { ChannelAction } from "./types.ts";

export type ChunkSplitOptions = {
  limit?: number;
  maxChunkLength?: number;
};

export function chunkChannelActions(
  actions: ChannelAction[],
  opts?: ChunkSplitOptions,
): ChannelAction[] {
  const limit = opts?.limit ?? 2000;
  const maxChunkLength = opts?.maxChunkLength ?? limit;
  const out: ChannelAction[] = [];

  for (const action of actions) {
    if (action.op === "noop") {
      out.push(action);
      continue;
    }
    if (action.op === "emit") {
      out.push(action);
      continue;
    }
    const text = action.text;
    const chunks = chunkText(text, limit, { maxChunkLength });
    if (chunks.length === 0) continue;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk === undefined) continue;
      if (action.op === "send") {
        out.push({ op: "send", text: chunk });
      } else {
        out.push(i === 0 ? { op: "edit", text: chunk } : { op: "send", text: chunk });
      }
    }
  }
  return out;
}
