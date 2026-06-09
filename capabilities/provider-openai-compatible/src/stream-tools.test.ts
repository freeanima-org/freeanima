import { describe, expect, it } from "bun:test";
import type { ToolCall } from "@freeanima/engine-provider-llm";
import {
  cleanToolCallsForApi,
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "./stream-tools.ts";

/** OpenAI 流式 delta 在 ToolCall 上附带 index，且 function 字段可部分出现 */
type StreamToolDelta = ToolCall & {
  index?: number;
  function?: Partial<{ name: string; arguments: string }>;
};

describe("mergeStreamingToolCalls", () => {
  it("按 index 合并 arguments 碎片", () => {
    const acc: Record<number, ToolCall> = {};
    mergeStreamingToolCalls(acc, [
      { index: 0, id: "c1", type: "function", function: { name: "read", arguments: '{"a":' } },
    ] as StreamToolDelta[]);
    mergeStreamingToolCalls(acc, [
      { index: 0, function: { arguments: "1}" } },
    ] as StreamToolDelta[]);
    expect(acc[0]?.function.arguments).toBe('{"a":1}');
    expect(acc[0]?.function.name).toBe("read");
    expect(acc[0]?.id).toBe("c1");
  });
});

describe("finalizeStreamingToolCalls", () => {
  it("按 index 排序并丢弃无 id 或 name 的项", () => {
    const acc: Record<number, ToolCall> = {
      1: { id: "b", type: "function", function: { name: "b", arguments: "{}" } },
      0: { id: "a", type: "function", function: { name: "a", arguments: "{}" } },
      2: { id: "", type: "function", function: { name: "x", arguments: "{}" } },
    };
    expect(finalizeStreamingToolCalls(acc).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("cleanToolCallsForApi", () => {
  it("trim name 并过滤空 id/name", () => {
    const out = cleanToolCallsForApi([
      { id: "", function: { name: " skip ", arguments: "{}" } },
      { id: "x", function: { name: " run ", arguments: "" } },
      { id: "y", function: { name: "", arguments: "{}" } },
    ] as ToolCall[]);
    expect(out).toEqual([{ id: "x", type: "function", function: { name: "run", arguments: "" } }]);
  });
});
