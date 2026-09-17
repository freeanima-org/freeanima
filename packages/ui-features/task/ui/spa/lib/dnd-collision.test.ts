import { describe, expect, test } from "bun:test";

import { isPointInRect, pickListDragCollisions, pickTaskDragCollisions } from "./dnd-collision.ts";

describe("pickTaskDragCollisions", () => {
  test("prefers list target when pointer hits task and list", () => {
    const collisions = [{ id: "task:1" }, { id: "list:2" }];
    expect(pickTaskDragCollisions(collisions)).toEqual([{ id: "list:2" }]);
  });

  test("keeps task collisions when no list under pointer", () => {
    const collisions = [{ id: "task:1" }, { id: "task:3" }];
    expect(pickTaskDragCollisions(collisions)).toBe(collisions);
  });

  test("returns empty when nothing under pointer", () => {
    expect(pickTaskDragCollisions([])).toEqual([]);
  });
});

describe("pickListDragCollisions", () => {
  test("prefers list over list-root when both under pointer", () => {
    const collisions = [{ id: "list:2" }, { id: "list-root" }];
    expect(pickListDragCollisions(collisions)).toEqual([{ id: "list:2" }]);
  });

  test("prefers list-root when only root under pointer", () => {
    const collisions = [{ id: "list-root" }];
    expect(pickListDragCollisions(collisions)).toEqual([{ id: "list-root" }]);
  });

  test("keeps first list collision when no root under pointer", () => {
    const collisions = [{ id: "list:1" }, { id: "list:2" }];
    expect(pickListDragCollisions(collisions)).toEqual([{ id: "list:1" }]);
  });
});

describe("isPointInRect", () => {
  test("detects pointer inside root rect", () => {
    const rect = { left: 0, right: 100, top: 0, bottom: 32 };
    expect(isPointInRect({ x: 50, y: 16 }, rect)).toBe(true);
    expect(isPointInRect({ x: 50, y: 40 }, rect)).toBe(false);
  });
});
