import { describe, expect, it } from "bun:test";

import { validateFtsQueryInput } from "@freeanima/habitat/core/util";

import {
  focusPassiveRecallQuery,
  sanitizeFreeTextForFtsQuery,
  stripTimePrefixFromUserContent,
} from "./query.ts";

describe("sanitizeFreeTextForFtsQuery", () => {
  it("strips unpaired double quotes", () => {
    expect(sanitizeFreeTextForFtsQuery('他说"你好')).toBe("他说你好");
    expect(sanitizeFreeTextForFtsQuery('"完整短语"')).toBe('"完整短语"');
  });

  it("folds lowercase or/and when no uppercase operators", () => {
    expect(sanitizeFreeTextForFtsQuery("tea or coffee")).toBe("tea coffee");
    expect(sanitizeFreeTextForFtsQuery("tea OR coffee")).toBe("tea OR coffee");
  });

  it("output passes validateFtsQueryInput for former failure cases", () => {
    expect(() => validateFtsQueryInput(sanitizeFreeTextForFtsQuery('他说"你好'))).not.toThrow();
    expect(() => validateFtsQueryInput(sanitizeFreeTextForFtsQuery("tea or coffee"))).not.toThrow();
  });
});

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
    const raw = `<time>2026-06-07T17:45</time>\n${body}`;
    const focused = focusPassiveRecallQuery(stripTimePrefixFromUserContent(raw), 100);
    expect(focused.length).toBeLessThanOrEqual(100);
  });

  it("sanitizes unpaired quotes inside focus", () => {
    expect(focusPassiveRecallQuery('记住他说"明天见面')).toBe("记住他说明天见面");
  });
});
