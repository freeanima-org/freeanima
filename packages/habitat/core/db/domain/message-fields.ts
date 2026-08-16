import type { AssistantMessage } from "./message.ts";

/** Read assistant reasoning text from stored payload. */
export function assistantReasoningText(msg: AssistantMessage): string {
  return (msg.reasoning ?? "").trim();
}

/** Resolve max loop iterations from protocol (`max_loop_iterations`) or runtime (`maxLoopIterations`) opts. */
export function resolveMaxLoopIterations(
  opts?: { max_loop_iterations?: number; maxLoopIterations?: number },
  fallback = 98,
): number {
  const raw = opts?.max_loop_iterations ?? opts?.maxLoopIterations ?? fallback;
  return Number.isFinite(raw) ? raw : fallback;
}
