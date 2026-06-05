type SessionMessage = Record<string, unknown>;

const lastToolAtBySession = new Map<string, number>();

/** 伙伴新消息到达，结束工具循环抑制 */
export function clearToolLoopSuppression(sessionId: string): void {
  lastToolAtBySession.delete(sessionId);
}

/** engine 追加 tool / assistant+tool_calls 时调用 */
export function markToolLoopActivity(sessionId: string): void {
  lastToolAtBySession.set(sessionId, Date.now());
}

export function isToolLoopSuppressionActive(sessionId: string, timeoutSec: number): boolean {
  const at = lastToolAtBySession.get(sessionId);
  if (at == null) return false;
  return Date.now() - at < timeoutSec * 1000;
}

/** 自最后一条 user 起是否处于工具调用链中 */
export function isInToolLoop(messages: SessionMessage[]): boolean {
  const rest = messages.filter((m) => m.role !== "system" && m.role !== "session_meta");
  let lastUser = -1;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i]?.role === "user") {
      lastUser = i;
      break;
    }
  }
  if (lastUser < 0 || lastUser >= rest.length - 1) return false;

  const tail = rest.slice(lastUser + 1);
  if (!tail.length) return false;

  const last = tail[tail.length - 1]!;
  if (last.role === "tool") return true;

  if (last.role === "assistant") {
    const calls = last.tool_calls;
    return Array.isArray(calls) && calls.length > 0;
  }

  return false;
}
