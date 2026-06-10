import { describe, expect, it } from "bun:test";

import {
  ToolRoundCollector,
  formatToolBeginLine,
  formatToolResultLine,
  formatToolRoundMessage,
} from "@freeanima/connectors-gateway";

describe("formatToolBeginLine", () => {
  it("includes serialized params", () => {
    const line = formatToolBeginLine("web_extract", { url: "https://example.com" });
    expect(line).toContain("web_extract");
    expect(line).toContain("https://example.com");
    expect(line).not.toContain("(...)");
  });

  it("truncates overlong single line", () => {
    const line = formatToolBeginLine("grep", { pattern: "a".repeat(200) }, 80);
    expect(line.length).toBeLessThanOrEqual(80);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("formatToolResultLine", () => {
  it("truncates result summary", () => {
    const line = formatToolResultLine("grep", "x".repeat(300), 50);
    expect(line.startsWith(" → ")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(50);
  });
});

describe("ToolRoundCollector", () => {
  it("merges one round begin + result", () => {
    const c = new ToolRoundCollector();
    c.addBegin("read", { path: "/tmp/a" });
    c.addResult("read", '{"ok":true}');
    const msg = c.take();
    expect(msg).toContain("🔧 read");
    expect(msg).toContain("/tmp/a");
    expect(msg).toContain("→");
    expect(c.take()).toBeNull();
  });

  it("clarify tool skipped", () => {
    const c = new ToolRoundCollector();
    c.addBegin("clarify", { q: 1 });
    c.addResult("clarify", "secret");
    expect(c.hasContent).toBe(false);
  });
});

describe("formatToolRoundMessage", () => {
  it("multiline joined with newlines", () => {
    expect(formatToolRoundMessage(["line1", "line2"])).toBe("line1\nline2");
  });
});
