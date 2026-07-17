import { expect, test } from "bun:test";

import {
  MILESTONE_COMPONENT,
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
} from "@freeanima/core/db/schema";

import {
  buildCjkOrderedCharRegexPattern,
  buildComponentFilterConditions,
  normalizeEntitySearchQuery,
} from "./conditions.ts";

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

test("buildComponentFilterConditions accepts client_op_id for project entities", () => {
  for (const component of [MILESTONE_COMPONENT, PROJECT_COMPONENT, PROJECT_FOLDER_COMPONENT]) {
    const conditions = buildComponentFilterConditions({
      component,
      filters: { client_op_id: "op-1" },
    });
    expect(conditions).toHaveLength(1);
  }
});
