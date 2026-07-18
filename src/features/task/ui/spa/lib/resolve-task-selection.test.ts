import { describe, expect, test } from "bun:test";

import type { SmartListRow, TaskListRow } from "./api.ts";
import { resolveTaskSelection } from "./resolve-task-selection.ts";

const smartLists: SmartListRow[] = [
  {
    preset: "due_today",
    title: "今天",
    sort_order: 0,
    filters: { status: "pending", has_due_at: true, due_on_or_before_days: 0 },
  },
  {
    id: 9,
    title: "自定义",
    sort_order: 10,
    filters: { status: "pending" },
  },
];

const lists: TaskListRow[] = [
  {
    id: 1,
    name: "收件箱",
    sort_order: 0,
    closed: false,
    color: null,
    is_default: true,
    is_folder: false,
    parent_id: null,
    item_count: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: 2,
    name: "工作",
    sort_order: 1,
    closed: false,
    color: null,
    is_default: false,
    is_folder: false,
    parent_id: null,
    item_count: 0,
    created_at: "",
    updated_at: "",
  },
];

describe("resolveTaskSelection", () => {
  test("无存储时回退今天", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: null,
      urlSelection: null,
      preferUrl: false,
    });
    expect(sel).toEqual({ kind: "smart_list", key: "due_today" });
  });

  test("恢复 smart_list key", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: { kind: "smart_list", key: "id:9" },
      urlSelection: null,
      preferUrl: false,
    });
    expect(sel).toEqual({ kind: "smart_list", key: "id:9" });
  });

  test("无效 smart_list key 回退今天", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: { kind: "smart_list", key: "missing" },
      urlSelection: null,
      preferUrl: false,
    });
    expect(sel).toEqual({ kind: "smart_list", key: "due_today" });
  });

  test("无效 list 回退今天", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: { kind: "list", id: 999 },
      urlSelection: null,
      preferUrl: false,
    });
    expect(sel).toEqual({ kind: "smart_list", key: "due_today" });
  });

  test("preferUrl 时恢复 search", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: { kind: "list", id: 2 },
      urlSelection: { kind: "search" },
      preferUrl: true,
    });
    expect(sel).toEqual({ kind: "search" });
  });

  test("stored 为 search 时忽略并回退", () => {
    const sel = resolveTaskSelection(lists, smartLists, {
      stored: { kind: "search" },
      urlSelection: null,
      preferUrl: false,
    });
    expect(sel).toEqual({ kind: "smart_list", key: "due_today" });
  });
});
