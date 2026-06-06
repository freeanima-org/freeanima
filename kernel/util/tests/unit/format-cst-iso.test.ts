import { describe, expect, test } from "bun:test";

import { CST_OFFSET_MS, formatCstIso } from "../../src/util.ts";

describe("formatCstIso", () => {
  test("偏移 +08:00 后缀", () => {
    const iso = formatCstIso(new Date("2024-01-01T00:00:00.000Z"));
    expect(iso.endsWith("+08:00")).toBe(true);
    expect(iso).toBe("2024-01-01T08:00:00.000+08:00");
  });

  test("CST_OFFSET_MS 为 8 小时", () => {
    expect(CST_OFFSET_MS).toBe(8 * 60 * 60 * 1000);
  });
});
