import { describe, expect, test } from "bun:test";

import { CST_OFFSET_MS, formatCstIso } from "./util.ts";

describe("formatCstIso", () => {
  test("offset +08:00 suffix", () => {
    const iso = formatCstIso(new Date("2024-01-01T00:00:00.000Z"));
    expect(iso.endsWith("+08:00")).toBe(true);
    expect(iso).toBe("2024-01-01T08:00:00.000+08:00");
  });

  test("CST_OFFSET_MS is 8 hours", () => {
    expect(CST_OFFSET_MS).toBe(8 * 60 * 60 * 1000);
  });
});
