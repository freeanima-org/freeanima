import type { SessionMessage } from "@freeanima/engine-db/domain";

const lastToolAtBySession = new Map<string, number>();

/** Partner new message arrives; end tool-loop suppression */
export function clearToolLoopSuppression(sessionId: string): void {
  lastToolAtBySession.delete(sessionId);
}

/** Called when engine appends tool / assistant+tool_calls */
export function markToolLoopActivity(sessionId: string): void {
  lastToolAtBySession.set(sessionId, Date.now());
}

export function isToolLoopSuppressionActive(sessionId: string, timeoutSec: number): boolean {
  const at = lastToolAtBySession.get(sessionId);
  if (at == null) return false;
  return Date.now() - at < timeoutSec * 1000;
}

/** Whether in tool-call chain since last user message */
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
