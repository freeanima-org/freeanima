import { describe, expect, test } from "bun:test";

import {
  CST_OFFSET_MS,
  formatCstDisplay,
  formatCstDisplayFromEpoch,
  formatCstDisplayFromMs,
  formatCstIso,
  formatCstWeekdayZh,
  isCstMonday,
} from "./time.ts";

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

describe("formatCstDisplay", () => {
  test("UTC instant → CST minute display", () => {
    expect(formatCstDisplay(new Date("2024-01-01T00:00:00.000Z"))).toBe("2024/01/01 08:00");
  });

  test("with seconds", () => {
    expect(formatCstDisplay(new Date("2024-01-01T00:00:00.000Z"), { seconds: true })).toBe(
      "2024/01/01 08:00:00",
    );
  });

  test("epoch seconds and milliseconds", () => {
    const epochSec = Date.parse("2024-01-01T00:00:00.000Z") / 1000;
    expect(formatCstDisplayFromEpoch(epochSec)).toBe("2024/01/01 08:00");
    expect(formatCstDisplayFromMs(epochSec * 1000)).toBe("2024/01/01 08:00");
  });

  test("null and invalid return empty", () => {
    expect(formatCstDisplay(null)).toBe("");
    expect(formatCstDisplay(undefined)).toBe("");
    expect(formatCstDisplay(0)).toBe("");
    expect(formatCstDisplayFromEpoch(0)).toBe("");
  });
});

describe("formatCstWeekdayZh", () => {
  test("returns Chinese weekday in CST", () => {
    expect(formatCstWeekdayZh(new Date("2026-05-20T08:02:00+08:00"))).toBe("周三");
    expect(formatCstWeekdayZh(new Date("2026-05-21T09:15:00+08:00"))).toBe("周四");
    expect(formatCstWeekdayZh(new Date("2026-06-07T17:45:00+08:00"))).toBe("周日");
  });
});

describe("isCstMonday", () => {
  test("detects Monday in CST", () => {
    expect(isCstMonday("2026-06-15")).toBe(true);
    expect(isCstMonday("2026-06-16")).toBe(false);
  });

  test("invalid day returns false", () => {
    expect(isCstMonday("not-a-day")).toBe(false);
  });
});
