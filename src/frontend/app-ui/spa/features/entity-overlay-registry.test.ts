import { describe, expect, test, beforeEach } from "bun:test";

import {
  getEntityOverlay,
  listEntityOverlayComponents,
  registerEntityOverlay,
  resetEntityOverlaysForTests,
  type EntityOverlayProps,
} from "./entity-overlay-registry.ts";

function DummyOverlay(_props: EntityOverlayProps) {
  return null;
}

describe("entity-overlay-registry", () => {
  beforeEach(() => {
    resetEntityOverlaysForTests();
  });

  test("register and get by component", () => {
    registerEntityOverlay("task_item", DummyOverlay);
    expect(getEntityOverlay("task_item")).toBe(DummyOverlay);
    expect(getEntityOverlay("diary_entry")).toBeUndefined();
    expect(listEntityOverlayComponents()).toEqual(["task_item"]);
  });

  test("same id different component use different slots", () => {
    registerEntityOverlay("task_item", DummyOverlay);
    registerEntityOverlay("task_list", DummyOverlay);
    expect(getEntityOverlay("task_item")).toBe(DummyOverlay);
    expect(getEntityOverlay("task_list")).toBe(DummyOverlay);
    expect(listEntityOverlayComponents().toSorted()).toEqual(["task_item", "task_list"]);
  });
});
