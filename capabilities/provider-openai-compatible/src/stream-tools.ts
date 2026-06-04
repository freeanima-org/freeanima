import type { ToolCall } from "@freeanima/engine-provider-llm";

/** 流式 tool_calls 按 index 合并（与 legacy llm.py 一致，禁止 concat 碎片） */
export function mergeStreamingToolCalls(
  acc: Record<number, ToolCall>,
  deltas: ToolCall[],
): Record<number, ToolCall> {
  for (const tc of deltas) {
    const idx = (tc as ToolCall & { index?: number }).index ?? 0;
    const fn = tc.function ?? { name: "", arguments: "" };
    if (!(idx in acc)) {
      acc[idx] = {
        id: tc.id ?? "",
        type: tc.type ?? "function",
        function: {
          name: fn.name ?? "",
          arguments: fn.arguments ?? "",
        },
      };
      continue;
    }
    const cur = acc[idx]!;
    if (fn.arguments) {
      cur.function.arguments = (cur.function.arguments ?? "") + fn.arguments;
    }
    if (fn.name) {
      cur.function.name = (cur.function.name ?? "") + fn.name;
    }
    if (tc.id) cur.id = tc.id;
    if (tc.type) cur.type = tc.type;
  }
  return acc;
}

export function finalizeStreamingToolCalls(acc: Record<number, ToolCall>): ToolCall[] {
  return Object.keys(acc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => acc[i]!)
    .filter((tc) => tc.id && tc.function?.name);
}

export function cleanToolCallsForApi(toolCalls: ToolCall[]): ToolCall[] {
  return toolCalls
    .map((tc) => ({
      id: tc.id ?? "",
      type: tc.type ?? "function",
      function: {
        name: (tc.function?.name ?? "").trim(),
        arguments: tc.function?.arguments ?? "{}",
      },
    }))
    .filter((tc) => tc.id && tc.function.name);
}
