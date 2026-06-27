import { expect, test } from "bun:test";

import { entitySearchHitToTaskItem } from "./search-hit-mapper.ts";

test("entitySearchHitToTaskItem maps task_item body", () => {
  const row = entitySearchHitToTaskItem({
    id: 17,
    title: "知识卡片",
    content: "详情",
    body: {
      list_id: 50,
      status: "pending",
      priority: "high",
      tags: ["a"],
      sort_order: 2,
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  });
  expect(row).toEqual({
    id: 17,
    title: "知识卡片",
    content: "详情",
    tags: ["a"],
    status: "pending",
    priority: "high",
    due_at: null,
    list_id: 50,
    sort_order: 2,
    completed_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  });
});

test("entitySearchHitToTaskItem rejects missing list_id", () => {
  expect(entitySearchHitToTaskItem({ id: 1, title: "x", body: {} })).toBeNull();
});
