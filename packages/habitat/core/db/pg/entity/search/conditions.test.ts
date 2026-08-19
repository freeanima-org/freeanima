import { expect, test } from "bun:test";

import type { SQL } from "drizzle-orm";

import {
  NOTE_COMPONENT,
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  TAG_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_OCCURRENCE_COMPONENT,
} from "@freeanima/habitat/core/db/schema";

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

test("buildComponentFilterConditions accepts client_op_id for note", () => {
  const conditions = buildComponentFilterConditions({
    component: NOTE_COMPONENT,
    filters: { client_op_id: "op-note" },
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

function sqlBlob(cond: SQL): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  const walk = (value: unknown): void => {
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(String(value));
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const obj = value as { queryChunks?: unknown; value?: unknown };
    if ("queryChunks" in obj) walk(obj.queryChunks);
    if ("value" in obj) walk(obj.value);
  };
  walk(cond.queryChunks);
  return parts.join("");
}

test("task_item due_today / due_on 使用 Asia/Shanghai 日历日", () => {
  const today = buildComponentFilterConditions({
    component: TASK_ITEM_COMPONENT,
    filters: { due_today: true },
  });
  expect(sqlBlob(today[0]!)).toContain("Asia/Shanghai");
  expect(sqlBlob(today[0]!)).toContain("due_at");

  for (const day of ["today", "tomorrow", "yesterday"] as const) {
    const conds = buildComponentFilterConditions({
      component: TASK_ITEM_COMPONENT,
      filters: { due_on: day },
    });
    expect(sqlBlob(conds[0]!)).toContain("Asia/Shanghai");
    expect(sqlBlob(conds[0]!)).toContain("due_at");
  }
});

test("task_item due_on_or_before_days: 0 为今天及已过期", () => {
  const conds = buildComponentFilterConditions({
    component: TASK_ITEM_COMPONENT,
    filters: { due_on_or_before_days: 0 },
  });
  const blob = sqlBlob(conds[0]!);
  expect(blob).toContain("due_at");
  expect(blob).toContain("Asia/Shanghai");
  expect(blob).toContain("0");
});

test("task_item completed_on / completed_on_or_after_days 走 completed_at", () => {
  const onToday = buildComponentFilterConditions({
    component: TASK_ITEM_COMPONENT,
    filters: { completed_on: "today" },
  });
  expect(sqlBlob(onToday[0]!)).toContain("completed_at");
  expect(sqlBlob(onToday[0]!)).toContain("Asia/Shanghai");

  const last7d = buildComponentFilterConditions({
    component: TASK_ITEM_COMPONENT,
    filters: { completed_on_or_after_days: 6 },
  });
  expect(sqlBlob(last7d[0]!)).toContain("completed_at");
  expect(sqlBlob(last7d[0]!)).toContain("6");
});

test("task_occurrence completed_on* 同样走 CST 日历日", () => {
  const onToday = buildComponentFilterConditions({
    component: TASK_OCCURRENCE_COMPONENT,
    filters: { completed_on: "yesterday" },
  });
  expect(sqlBlob(onToday[0]!)).toContain("completed_at");
  expect(sqlBlob(onToday[0]!)).toContain("Asia/Shanghai");

  const last7d = buildComponentFilterConditions({
    component: TASK_OCCURRENCE_COMPONENT,
    filters: { completed_on_or_after_days: 6 },
  });
  expect(sqlBlob(last7d[0]!)).toContain("completed_at");
  expect(sqlBlob(last7d[0]!)).toContain("6");
});
