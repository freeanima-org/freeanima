import { describe, expect, test } from "bun:test";

import { pickTaskDragCollisions } from "./dnd-collision.ts";

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
