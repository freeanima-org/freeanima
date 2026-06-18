import { describe, expect, it } from "bun:test";

import { ToolRoundCollector } from "./stream-tool-format.ts";

describe("ToolRoundCollector", () => {
  it("merges a round at take() with name mode", () => {
    const c = new ToolRoundCollector("name");
    c.addBegin("grep", { pattern: "foo" });
    c.addResult("grep", "matched");
    expect(c.take()).toBe("🔧 grep");
  });

  it("hidden mode yields null", () => {
    const c = new ToolRoundCollector("hidden");
    c.addBegin("grep", {});
    c.addResult("grep", "x");
    expect(c.take()).toBeNull();
  });

  it("count mode summarizes tools", () => {
    const c = new ToolRoundCollector("count");
    c.addBegin("a", {});
    c.addBegin("b", {});
    c.addResult("a", "1");
    c.addResult("b", "2");
    expect(c.take()).toBe("🔧 调用了 2 个工具");
  });
});
