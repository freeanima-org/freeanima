import type { ToolCall } from "./messages.ts";

/** Merge streaming tool_calls by index (matches legacy llm.py; no fragment concat) */
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
    .toSorted((a, b) => a - b)
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
