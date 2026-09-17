import { describe, expect, it } from "bun:test";

import { parseAnimaReferenceIds, snippetFromEntityFields } from "./useAnimaReferenceLabels.ts";

describe("parseAnimaReferenceIds", () => {
  it("dedupes and preserves order", () => {
    expect(parseAnimaReferenceIds("[[anima:42]] x [[anima:101]] [[anima:42]]")).toEqual([42, 101]);
  });

  it("ignores invalid ids", () => {
    expect(parseAnimaReferenceIds("[[anima:0]] [[anima:abc]]")).toEqual([]);
  });
});

describe("snippetFromEntityFields", () => {
  it("prefers title over content", () => {
    expect(snippetFromEntityFields("标题优先", "正文忽略")).toBe("标题优先");
  });

  it("falls back to content and truncates to 10 chars", () => {
    expect(snippetFromEntityFields("", "一二三四五六七八九十十一")).toBe("一二三四五六七八九十");
  });

  it("returns empty when both blank", () => {
    expect(snippetFromEntityFields("  ", "")).toBe("");
  });
});
