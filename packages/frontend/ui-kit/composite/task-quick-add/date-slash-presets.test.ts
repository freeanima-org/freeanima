import { describe, expect, test } from "bun:test";

import { matchDateSlashPresets } from "./date-slash-presets.ts";

describe("matchDateSlashPresets", () => {
  test("空 query 返回全部快捷项", () => {
    expect(matchDateSlashPresets("")).toHaveLength(4);
  });

  test("前缀过滤", () => {
    expect(matchDateSlashPresets("tom").map((p) => p.id)).toEqual(["tomorrow"]);
  });
});
