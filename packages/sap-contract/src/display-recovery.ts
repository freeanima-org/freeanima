export type DisplayRecoveryItem = {
  type: string;
  role?: string;
};

export function hasNewAssistantReply(
  display: DisplayRecoveryItem[],
  baselineCount: number,
): boolean {
  const newItems = display.slice(baselineCount);
  return newItems.some((item) => item.type === "message" && item.role === "assistant");
}

export const RECOVERY_INITIAL_DELAY_MS = 500;
export const RECOVERY_MAX_DELAY_MS = 4_000;
export const RECOVERY_MAX_DURATION_MS = 60_000;

export async function pollUntilAssistantReply(
  sessionId: string,
  recoverDisplay: (sessionId: string) => Promise<boolean>,
  options?: { maxDurationMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + (options?.maxDurationMs ?? RECOVERY_MAX_DURATION_MS);
  let delay = RECOVERY_INITIAL_DELAY_MS;
  while (Date.now() < deadline) {
    if (await recoverDisplay(sessionId)) return true;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, RECOVERY_MAX_DELAY_MS);
  }
  return false;
}
