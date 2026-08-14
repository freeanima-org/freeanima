import { omitUndefined } from "@freeanima/habitat/core/util";
import { toolResult } from "@freeanima/habitat/core/tool";
import type { StoredMessage, ToolMessage } from "@freeanima/habitat/core/db/domain";
import { cleanToolCallsForApi } from "@freeanima/habitat/core/provider/stream-tools";

export const REPAIR_REASON_LOST = "tool response lost (conversation repair)";
export const REPAIR_REASON_INTERRUPT = "interrupted by user";

export type MissingToolCall = {
  id: string;
  name: string;
};

export type ToolLoopCorruption = {
  assistantIndex: number;
  assistantPos?: number;
  missingCalls: MissingToolCall[];
};

export function syntheticToolContent(reason: string): string {
  return toolResult({ error: reason });
}

export function isInsufficientToolMessagesError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("insufficient tool messages") ||
    (lower.includes("tool_calls") && lower.includes("tool_call_id"))
  );
}

/** Scan persisted/full history for missing tool_calls pairing */
export function detectToolLoopCorruption(messages: StoredMessage[]): ToolLoopCorruption[] {
  const out: ToolLoopCorruption[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.role !== "assistant" || !msg.tool_calls?.length) continue;

    const cleaned = cleanToolCallsForApi(msg.tool_calls);
    if (cleaned.length === 0) continue;

    const responded = new Set<string>();
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (next?.role === "tool") {
        responded.add(next.tool_call_id);
        continue;
      }
      break;
    }

    const missingCalls: MissingToolCall[] = [];
    for (const tc of cleaned) {
      if (!responded.has(tc.id)) {
        missingCalls.push({ id: tc.id, name: tc.function.name });
      }
    }
    if (missingCalls.length > 0) {
      out.push(
        omitUndefined({
          assistantIndex: i,
          assistantPos: msg.pos,
          missingCalls,
        }),
      );
    }
  }
  return out;
}

export type ToolLoopInsertPlan = {
  assistantPos: number;
  insertAtPos: number;
  missingCalls: MissingToolCall[];
};

/** Count consecutive tool messages after assistant (stops at non-tool) */
export function countFollowingToolMessages(
  messages: StoredMessage[],
  assistantIndex: number,
): number {
  let n = 0;
  for (let j = assistantIndex + 1; j < messages.length; j++) {
    if (messages[j]?.role === "tool") n++;
    else break;
  }
  return n;
}

/** Compute synthetic tool insert pos (assistantPos descending; matches PG repair) */
export function planToolLoopInserts(messages: StoredMessage[]): ToolLoopInsertPlan[] {
  const corruptions = detectToolLoopCorruption(messages);
  const ordered = [...corruptions].toSorted(
    (a, b) => (b.assistantPos ?? 0) - (a.assistantPos ?? 0),
  );
  const plans: ToolLoopInsertPlan[] = [];
  for (const c of ordered) {
    if (c.assistantPos === undefined) continue;
    const idx = messages.findIndex((m) => m.pos === c.assistantPos);
    if (idx < 0) continue;
    const following = countFollowingToolMessages(messages, idx);
    plans.push({
      assistantPos: c.assistantPos,
      insertAtPos: c.assistantPos + 1 + following,
      missingCalls: c.missingCalls,
    });
  }
  return plans;
}

/** In-memory repair: add synthetic tool, drop orphan tool, strip invalid tool_calls */
export function repairToolLoopMessages(
  messages: StoredMessage[],
  reason = REPAIR_REASON_LOST,
): StoredMessage[] {
  const out: StoredMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg === undefined) break;
    if (msg.role !== "assistant" || !msg.tool_calls?.length) {
      out.push(msg);
      i++;
      continue;
    }

    const cleaned = cleanToolCallsForApi(msg.tool_calls);
    if (cleaned.length === 0) {
      const text = (msg.content ?? "").trim() || (msg.reasoning ?? "").trim();
      if (text) {
        const { tool_calls: _removed, ...rest } = msg;
        out.push({ ...rest, role: "assistant", content: text });
      }
      let j = i + 1;
      while (j < messages.length && messages[j]?.role === "tool") j++;
      i = j;
      continue;
    }

    out.push({ ...msg, tool_calls: cleaned });

    const responded = new Map<string, ToolMessage>();
    let j = i + 1;
    while (j < messages.length && messages[j]?.role === "tool") {
      const t = messages[j] as ToolMessage;
      if (cleaned.some((tc) => tc.id === t.tool_call_id)) {
        responded.set(t.tool_call_id, t);
      }
      j++;
    }

    for (const tc of cleaned) {
      const existing = responded.get(tc.id);
      if (existing) {
        out.push(existing);
      } else {
        out.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: syntheticToolContent(reason),
        });
      }
    }

    i = j;
  }
  return out;
}
