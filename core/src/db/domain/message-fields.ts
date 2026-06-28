import type { AssistantMessage } from "./message.ts";

/** Read assistant reasoning text from stored payload. */
export function assistantReasoningText(msg: AssistantMessage): string {
  return String(msg.reasoning ?? "").trim();
}

/** Resolve max tool-loop turns from wire (`max_turns`) or runtime (`maxTurns`) opts. */
export function resolveMaxTurns(
  opts?: { max_turns?: number; maxTurns?: number },
  fallback = 98,
): number {
  const raw = opts?.max_turns ?? opts?.maxTurns ?? fallback;
  return Number.isFinite(raw) ? raw : fallback;
}
