import { expect, test } from "bun:test";

import {
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  TAG_COMPONENT,
  TASK_ITEM_COMPONENT,
} from "@freeanima/host/core/db/schema";

import {
  buildCjkOrderedCharRegexPattern,
  buildComponentFilterConditions,
  buildEntitySearchConditions,
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
  for (const component of [PROJECT_COMPONENT, PROJECT_FOLDER_COMPONENT]) {
    const conditions = buildComponentFilterConditions({
      component,
      filters: { client_op_id: "op-1" },
    });
    expect(conditions).toHaveLength(1);
  }
});

test("buildComponentFilterConditions accepts client_op_id for tag", () => {
  const conditions = buildComponentFilterConditions({
    component: TAG_COMPONENT,
    filters: { client_op_id: "op-tag" },
  });
  expect(conditions).toHaveLength(1);
});

test("buildEntitySearchConditions includes top-level tag_ids", () => {
  const conditions = buildEntitySearchConditions({
    world_id: 1,
    primary_component: TASK_ITEM_COMPONENT,
    tag_ids: [10, 20],
  });
  expect(conditions.length).toBeGreaterThanOrEqual(2);
});

test("buildComponentFilterConditions accepts task_item tag_ids", () => {
  const conditions = buildComponentFilterConditions({
    component: TASK_ITEM_COMPONENT,
    filters: { tag_ids: [3] },
  });
  expect(conditions).toHaveLength(1);
});
