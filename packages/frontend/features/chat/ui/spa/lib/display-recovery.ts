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

/**
 * 对话页底部「等待结果…／正在撰写回复…」是否显示。
 * recovering 必须属于当前会话，避免 A 生成时 B/C 误显等待。
 */
export function shouldShowAwaitingPlaceholder(opts: {
  currentId: string | null;
  stalledReply: boolean;
  streamVisible: boolean;
  recovering: boolean;
  recoveringConversationId: string | null;
  messagesLoading: boolean;
  displayAwaiting: boolean;
  habitatConnected: boolean;
  userStopped: boolean;
}): boolean {
  if (!opts.currentId || opts.stalledReply || opts.userStopped) return false;
  if (opts.streamVisible) return true;
  if (opts.recovering && opts.recoveringConversationId === opts.currentId) return true;
  return !opts.messagesLoading && opts.displayAwaiting && opts.habitatConnected;
}

/**
 * 展示未完成，但本端未在流式且服务端无 active 流 → stalled（应出【继续】，勿伪装等待）。
 */
export function isStalledReply(opts: {
  awaitingReply: boolean;
  streaming: boolean;
  hasActiveStream: boolean;
}): boolean {
  return opts.awaitingReply && !opts.streaming && !opts.hasActiveStream;
}

/**
 * lookup 无 active 流后：用「已与服务端同步」的 awaiting 判定是否出【继续】。
 * 本地 display 滞后（切模块 / 断流）时须先 reload，再传入 awaitingAfterSync。
 */
export function resolveStalledAfterLookup(opts: {
  awaitingAfterSync: boolean;
  streaming: boolean;
  hasActiveStream: boolean;
}): boolean {
  return isStalledReply({
    awaitingReply: opts.awaitingAfterSync,
    streaming: opts.streaming,
    hasActiveStream: opts.hasActiveStream,
  });
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
