import { toolResult } from "@freeanima/legacy-kernel";
import type { SessionMessage, ToolMessage } from "@freeanima/legacy-kernel";
import { cleanToolCallsForApi, type StreamToolCall } from "./llm";

export const REPAIR_REASON_LOST = "tool response lost (session repair)";
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

/** 扫描持久化/完整历史中的 tool_calls 配对缺失 */
export function detectToolLoopCorruption(messages: SessionMessage[]): ToolLoopCorruption[] {
  const out: ToolLoopCorruption[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.role !== "assistant" || !msg.tool_calls?.length) continue;

    const cleaned = cleanToolCallsForApi(msg.tool_calls as StreamToolCall[]);
    if (!cleaned.length) continue;

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
    if (missingCalls.length) {
      out.push({
        assistantIndex: i,
        assistantPos: msg.pos,
        missingCalls,
      });
    }
  }
  return out;
}

export type ToolLoopInsertPlan = {
  assistantPos: number;
  insertAtPos: number;
  missingCalls: MissingToolCall[];
};

/** assistant 之后连续 tool 消息条数（遇非 tool 即停） */
export function countFollowingToolMessages(
  messages: SessionMessage[],
  assistantIndex: number,
): number {
  let n = 0;
  for (let j = assistantIndex + 1; j < messages.length; j++) {
    if (messages[j]?.role === "tool") n++;
    else break;
  }
  return n;
}

/** 计算 synthetic tool 应插入的 pos（按 assistantPos 降序处理，与 PG repair 一致） */
export function planToolLoopInserts(messages: SessionMessage[]): ToolLoopInsertPlan[] {
  const corruptions = detectToolLoopCorruption(messages);
  const ordered = [...corruptions].sort(
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

/** 内存层修复：补 synthetic tool、剔除 orphan tool、strip 无效 tool_calls */
export function repairToolLoopMessages(
  messages: SessionMessage[],
  reason = REPAIR_REASON_LOST,
): SessionMessage[] {
  const out: SessionMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i]!;
    if (msg.role !== "assistant" || !msg.tool_calls?.length) {
      out.push(msg);
      i++;
      continue;
    }

    const cleaned = cleanToolCallsForApi(msg.tool_calls as StreamToolCall[]);
    if (!cleaned.length) {
      const { tool_calls: _removed, ...rest } = msg;
      out.push(rest as SessionMessage);
      i++;
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
