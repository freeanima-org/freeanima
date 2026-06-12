import type { AssistantMessage } from "./message.ts";

/** Read assistant reasoning text (handles legacy `reasoning` / `reasoning_content` field names). */
export function assistantReasoningText(msg: AssistantMessage): string {
  return String(msg.reasoning ?? msg.reasoning_content ?? "").trim();
}

/** Resolve max tool-loop turns from wire (`max_turns`) or runtime (`maxTurns`) opts. */
export function resolveMaxTurns(
  opts?: { max_turns?: number; maxTurns?: number },
  fallback = 98,
): number {
  const raw = opts?.max_turns ?? opts?.maxTurns ?? fallback;
  return Number.isFinite(raw) ? raw : fallback;
}
