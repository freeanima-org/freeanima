import { describe, expect, test } from "bun:test";

import { isoToDateLocalValue, isoToTimeLocalValue, mergeDateTimeLocal } from "./format-task.ts";

describe("format-task due_at helpers", () => {
  test("isoToDateLocalValue uses local calendar date", () => {
    const iso = new Date(2026, 6, 9, 15, 30).toISOString();
    expect(isoToDateLocalValue(iso)).toBe("2026-07-09");
  });

  test("isoToTimeLocalValue uses local clock time", () => {
    const iso = new Date(2026, 6, 9, 15, 30).toISOString();
    expect(isoToTimeLocalValue(iso)).toBe("15:30");
  });

  test("mergeDateTimeLocal returns null when date cleared", () => {
    expect(mergeDateTimeLocal("", "12:00")).toBeNull();
  });

  test("mergeDateTimeLocal defaults missing time to midnight local", () => {
    const iso = mergeDateTimeLocal("2026-07-09", "");
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  test("mergeDateTimeLocal round-trips date and time", () => {
    const iso = mergeDateTimeLocal("2026-07-09", "15:30");
    expect(isoToDateLocalValue(iso)).toBe("2026-07-09");
    expect(isoToTimeLocalValue(iso)).toBe("15:30");
  });
});
