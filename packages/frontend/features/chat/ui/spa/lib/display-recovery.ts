import type { DisplayItem } from "./types.ts";

export function hasNewAssistantReply(display: DisplayItem[], baselineCount: number): boolean {
  const newItems = display.slice(baselineCount);
  return newItems.some((item) => item.type === "message" && item.role === "assistant");
}

/**
 * 末条 user 之后尚无 assistant（中间可有 tool_block 等）。
 * 刷新后续传依赖此判断；勿要求「最后一项必须是 user」。
 */
export function displayAwaitingReply(display: DisplayItem[]): boolean {
  let lastUserIdx = -1;
  for (let i = display.length - 1; i >= 0; i--) {
    const item = display[i];
    if (item?.type === "message" && item.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return false;
  for (let j = lastUserIdx + 1; j < display.length; j++) {
    const after = display[j];
    if (after?.type === "message" && after.role === "assistant") return false;
  }
  return true;
}

export const RECOVERY_INITIAL_DELAY_MS = 500;
export const RECOVERY_MAX_DELAY_MS = 4_000;
export const RECOVERY_MAX_DURATION_MS = 60_000;

export async function pollUntilAssistantReply(
  conversationId: string,
  recoverDisplay: (conversationId: string) => Promise<boolean>,
  options?: { maxDurationMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + (options?.maxDurationMs ?? RECOVERY_MAX_DURATION_MS);
  let delay = RECOVERY_INITIAL_DELAY_MS;
  while (Date.now() < deadline) {
    if (await recoverDisplay(conversationId)) return true;
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
    delay = Math.min(delay * 2, RECOVERY_MAX_DELAY_MS);
  }
  return false;
}
