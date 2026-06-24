import { describe, expect, it } from "bun:test";

import { ToolRoundBuffer, formatStructuredToolRound } from "./stream-tool-format.ts";

describe("formatStructuredToolRound", () => {
  it("merges a round with name mode", () => {
    const buffer = new ToolRoundBuffer();
    buffer.addBegin("grep", { pattern: "foo" });
    buffer.addResult("grep", "matched");
    expect(formatStructuredToolRound(buffer.take(), "name")).toBe("🔧 grep");
  });

  it("hidden mode yields null", () => {
    const buffer = new ToolRoundBuffer();
    buffer.addBegin("grep", {});
    buffer.addResult("grep", "x");
    expect(formatStructuredToolRound(buffer.take(), "hidden")).toBeNull();
  });

  it("count mode summarizes tools", () => {
    const buffer = new ToolRoundBuffer();
    buffer.addBegin("a", {});
    buffer.addBegin("b", {});
    buffer.addResult("a", "1");
    buffer.addResult("b", "2");
    expect(formatStructuredToolRound(buffer.take(), "count")).toBe("🔧 调用了 2 个工具");
  });
});
