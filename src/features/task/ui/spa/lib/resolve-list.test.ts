import { describe, expect, test } from "bun:test";

import type { TaskListRow } from "./api.ts";
import { resolveDefaultListId, resolveSelectedListId } from "./resolve-list.ts";

const lists: TaskListRow[] = [
  {
    id: 1,
    name: "A",
    sort_order: 0,
    closed: false,
    color: null,
    is_default: false,
    is_folder: false,
    parent_id: null,
    item_count: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: 2,
    name: "收件箱",
    sort_order: 1,
    closed: false,
    color: null,
    is_default: true,
    is_folder: false,
    parent_id: null,
    item_count: 3,
    created_at: "",
    updated_at: "",
  },
];

describe("resolve-list", () => {
  test("resolveDefaultListId prefers is_default", () => {
    expect(resolveDefaultListId(lists)).toBe(2);
  });

  test("web uses valid url list id", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: null,
        storedListId: null,
        urlListId: 1,
        preferUrl: true,
      }),
    ).toBe(1);
  });

  test("web falls back to default when url invalid", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: null,
        storedListId: null,
        urlListId: 99,
        preferUrl: true,
      }),
    ).toBe(2);
  });

  test("non-web ignores url and uses default", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: null,
        storedListId: null,
        urlListId: 1,
        preferUrl: false,
      }),
    ).toBe(2);
  });

  test("stored list id used when current invalid", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: null,
        storedListId: 1,
        urlListId: null,
        preferUrl: false,
      }),
    ).toBe(1);
  });

  test("stored list id preferred over url when current invalid", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: null,
        storedListId: 1,
        urlListId: 2,
        preferUrl: true,
      }),
    ).toBe(1);
  });

  test("current id kept when still valid", () => {
    expect(
      resolveSelectedListId(lists, {
        currentId: 1,
        storedListId: 2,
        urlListId: 2,
        preferUrl: true,
      }),
    ).toBe(1);
  });
});
