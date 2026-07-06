import { describe, expect, test } from "bun:test";

import {
  isListDndId,
  isTaskDndId,
  listDndId,
  parseListDndId,
  parseTaskDndId,
  taskDndId,
} from "./dnd-ids.ts";

describe("dnd-ids", () => {
  test("list id round-trip", () => {
    expect(listDndId(3)).toBe("list:3");
    expect(parseListDndId("list:3")).toBe(3);
    expect(isListDndId("list:3")).toBe(true);
    expect(isTaskDndId("list:3")).toBe(false);
  });

  test("task id round-trip", () => {
    expect(taskDndId(9)).toBe("task:9");
    expect(parseTaskDndId("task:9")).toBe(9);
    expect(isTaskDndId("task:9")).toBe(true);
  });
});
