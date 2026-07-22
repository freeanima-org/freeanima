import type { StoredMessage } from "@freeanima/core/db/domain";
import { getL4 } from "./compressor.ts";
import { isInToolLoop } from "./compression-tool-loop.ts";

function messagePos(msg: StoredMessage): number {
  if (msg.role === "conversation_meta") return 0;
  return msg.pos ?? 0;
}

function restMessages(messages: StoredMessage[]): StoredMessage[] {
  return messages.filter((m) => m.role !== "system" && m.role !== "conversation_meta");
}

export type SummarizeCutOk = { ok: true; cut: number; idle: boolean; l4: number };
export type SummarizeCutErr = {
  ok: false;
  error: "empty" | "in_progress";
};
export type SummarizeCutResult = SummarizeCutOk | SummarizeCutErr;

/**
 * Resolve where `/summarize` should set l2=l3.
 * Idle (closed turn): cut = l4 (last assistant = max pos).
 * Mid-turn / tool-loop: cut = last completed assistant (no pending tool_calls); incomplete tail stays in raw.
 */
export function resolveSummarizeCut(messages: StoredMessage[]): SummarizeCutResult {
  const rest = restMessages(messages);
  const l4 = getL4(messages);
  if (l4 <= 0 || rest.length === 0) {
    return { ok: false, error: "empty" };
  }

  const last = rest.at(-1);
  const inLoop = isInToolLoop(messages);

  if (!inLoop && last?.role === "assistant") {
    return { ok: true, cut: messagePos(last), idle: true, l4 };
  }

  let cut: number | null = null;
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    if (m?.role !== "assistant") continue;
    const calls = m.tool_calls;
    const hasCalls = Array.isArray(calls) && calls.length > 0;
    if (hasCalls) continue;
    cut = messagePos(m);
    break;
  }

  if (cut == null || cut <= 0) {
    return { ok: false, error: "in_progress" };
  }
  return { ok: true, cut, idle: false, l4 };
}
