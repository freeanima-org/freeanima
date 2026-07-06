import { describe, expect, it } from "bun:test";

import { focusPassiveRecallQuery, stripTimePrefixFromUserContent } from "./query.ts";

describe("focusPassiveRecallQuery", () => {
  it("returns short content unchanged", () => {
    expect(focusPassiveRecallQuery("hello world")).toBe("hello world");
  });

  it("keeps trailing slice for long content", () => {
    const tail = "最终问题：咖啡偏好";
    const long = `${"x".repeat(400)}${tail}`;
    const focused = focusPassiveRecallQuery(long, 320);
    expect(focused.endsWith(tail)).toBe(true);
    expect(focused.length).toBeLessThanOrEqual(320);
  });

  it("strips time prefix before focus", () => {
    const body = "a".repeat(400);
    const raw = `time: 2026-06-07T17:45\n${body}`;
    const focused = focusPassiveRecallQuery(stripTimePrefixFromUserContent(raw), 100);
    expect(focused.length).toBeLessThanOrEqual(100);
  });
});
