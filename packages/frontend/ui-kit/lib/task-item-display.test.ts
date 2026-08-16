import { describe, expect, test } from "bun:test";

import {
  isTaskItemDisplayEqual,
  PRIORITY_LABEL,
  priorityDot,
  priorityToneBg,
  priorityToneText,
  resolveTaskTagTitles,
  splitTaskTagTitlesForDisplay,
  TASK_ROW_TAG_MAX_VISIBLE,
  type TaskItemDisplay,
} from "./task-item-display.ts";

describe("priority tones", () => {
  test("PRIORITY_LABEL covers all priorities", () => {
    expect(PRIORITY_LABEL.high).toBe("高");
    expect(PRIORITY_LABEL.medium).toBe("中");
    expect(PRIORITY_LABEL.low).toBe("低");
    expect(PRIORITY_LABEL.none).toBe("无");
  });

  test("tone helpers use shadcn-aligned classes", () => {
    expect(priorityToneText("high")).toContain("destructive");
    expect(priorityToneText("medium")).toContain("amber");
    expect(priorityToneText("low")).toContain("sky");
    expect(priorityToneText("none")).toContain("muted");
    expect(priorityToneBg("high")).toContain("destructive");
    expect(priorityToneBg("medium")).toContain("amber");
    expect(priorityToneBg("low")).toContain("sky");
    expect(priorityToneBg("none")).toContain("muted");
  });

  test("priorityDot aliases priorityToneText", () => {
    expect(priorityDot("high")).toBe(priorityToneText("high"));
    expect(priorityDot("none")).toBe(priorityToneText("none"));
  });
});

describe("resolveTaskTagTitles", () => {
  test("returns empty without lookup or ids", () => {
    expect(resolveTaskTagTitles([1], null)).toEqual([]);
    expect(resolveTaskTagTitles([], new Map([[1, "a"]]))).toEqual([]);
  });

  test("returns empty when tagIds is nullish even with lookup map", () => {
    const map = new Map([[1, "a"]]);
    expect(resolveTaskTagTitles(undefined, map)).toEqual([]);
    expect(resolveTaskTagTitles(null, map)).toEqual([]);
  });

  test("skips missing ids and preserves order", () => {
    const map = new Map([
      [2, "beta"],
      [1, "alpha"],
    ]);
    expect(resolveTaskTagTitles([1, 9, 2], map)).toEqual(["alpha", "beta"]);
  });
});

describe("isTaskItemDisplayEqual", () => {
  const base: TaskItemDisplay = {
    id: 1,
    title: "t",
    content: "",
    tag_ids: [1],
    status: "pending",
    priority: "none",
    due_at: null,
    remind_at: null,
  };

  test("treats missing tag_ids as empty without throwing", () => {
    const missingTags = { ...base, tag_ids: undefined as unknown as number[] };
    expect(isTaskItemDisplayEqual(missingTags, { ...base, tag_ids: [] })).toBe(true);
    expect(isTaskItemDisplayEqual(missingTags, base)).toBe(false);
  });
});

describe("splitTaskTagTitlesForDisplay", () => {
  test("shows all when within limit", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b"])).toEqual({
      visible: ["a", "b"],
      overflowCount: 0,
    });
  });

  test("caps visible and reports overflow", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b", "c", "d"])).toEqual({
      visible: ["a", "b"],
      overflowCount: 2,
    });
    expect(TASK_ROW_TAG_MAX_VISIBLE).toBe(2);
  });

  test("respects custom maxVisible", () => {
    expect(splitTaskTagTitlesForDisplay(["a", "b", "c"], 1)).toEqual({
      visible: ["a"],
      overflowCount: 2,
    });
  });
});
