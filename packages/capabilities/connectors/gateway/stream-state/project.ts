import type { StreamReplyState } from "./types.ts";

/** 将终态投影为平台可见完整文本（替代 collect-gateway-stream-reply 拼接逻辑） */
export function projectVisibleText(state: StreamReplyState): string {
  const blocks = [...state.visibleBlocks];
  const answer = (state.finalAnswer ?? state.currentAnswer).trim();
  if (answer) blocks.push(answer);
  return blocks.join("\n\n").trim();
}
