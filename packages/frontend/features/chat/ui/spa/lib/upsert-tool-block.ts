import type {
  DisplayItem,
  DisplayToolBlockItem,
  DisplayToolCall,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";

/** 按 tool_call_id 合并：已有则更新，新 id 则追加（保持原顺序） */
export function mergeToolCalls(
  existing: DisplayToolCall[],
  incoming: DisplayToolCall[],
): DisplayToolCall[] {
  const byId = new Map<string, number>();
  const out = existing.map((c, i) => {
    if (c.tool_call_id) byId.set(c.tool_call_id, i);
    return { ...c };
  });
  for (const call of incoming) {
    const idx = call.tool_call_id ? byId.get(call.tool_call_id) : undefined;
    if (idx != null) {
      out[idx] = { ...out[idx], ...call };
    } else {
      if (call.tool_call_id) byId.set(call.tool_call_id, out.length);
      out.push({ ...call });
    }
  }
  return out;
}

/**
 * 将 tool_block upsert 到展示列表末尾：
 * - 末条已是 tool_block → 按 id 合并 calls
 * - 否则 append 新 block
 * 非 tool_block 仍 append。
 */
export function upsertDisplayItem(display: DisplayItem[], item: DisplayItem): DisplayItem[] {
  if (item.type !== "tool_block") {
    return [...display, item];
  }
  const last = display.at(-1);
  if (last?.type === "tool_block") {
    const merged: DisplayToolBlockItem = {
      type: "tool_block",
      calls: mergeToolCalls(last.calls, item.calls),
    };
    return [...display.slice(0, -1), merged];
  }
  return [...display, item];
}
