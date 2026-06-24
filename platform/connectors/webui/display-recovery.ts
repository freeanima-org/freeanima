import type { DisplayItem } from "./api/index.ts";

/** 断流恢复：仅 assistant 消息视为回合完成（tool_block 可能早于 assistant 落库） */
export function hasNewAssistantReply(display: DisplayItem[], baselineCount: number): boolean {
  const newItems = display.slice(baselineCount);
  return newItems.some((item) => item.type === "message" && item.role === "assistant");
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
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, RECOVERY_MAX_DELAY_MS);
  }
  return false;
}
