import { expect, test } from "bun:test";

import { buildCjkOrderedCharRegexPattern, normalizeEntitySearchQuery } from "./conditions.ts";

test("normalizeEntitySearchQuery strips decorative brackets", () => {
  expect(normalizeEntitySearchQuery("【客户端】")).toBe("客户端");
  expect(normalizeEntitySearchQuery("  [test] （foo） ")).toBe("test foo");
});

test("buildCjkOrderedCharRegexPattern matches skipped middle chars", () => {
  expect(buildCjkOrderedCharRegexPattern("知识片")).toBe("知.*识.*片");
  expect(
    "知识卡片聚类".match(new RegExp(buildCjkOrderedCharRegexPattern("知识片")!)),
  ).not.toBeNull();
  expect(buildCjkOrderedCharRegexPattern("知")).toBeNull();
});
