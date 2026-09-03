import { describe, expect, test } from "bun:test";

import { habitBodySchema } from "@freeanima/habitat/core/db/schema/entity/components/habit.ts";
import { addHostDays, eachDayInclusive, isHabitDueOnDay, listDaysInMonth } from "./frequency.ts";
import { listHabitPresets } from "./presets.ts";

describe("habitBodySchema", () => {
  test("defaults boolean habit", () => {
    const parsed = habitBodySchema.parse({});
    expect(parsed.polarity).toBe("build");
    expect(parsed.record_mode).toBe("boolean");
    expect(parsed.target).toBe(1);
    expect(parsed.day_section).toBe("other");
  });

  test("rejects auto without auto_amount", () => {
    const parsed = habitBodySchema.safeParse({
      record_mode: "auto",
      target: 8,
      auto_amount: null,
    });
    expect(parsed.success).toBe(false);
  });

  test("accepts auto with auto_amount", () => {
    const parsed = habitBodySchema.safeParse({
      record_mode: "auto",
      target: 8,
      auto_amount: 1,
      unit: "杯",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("isHabitDueOnDay", () => {
  test("daily every day", () => {
    expect(isHabitDueOnDay({ freq: "daily", interval: 1 }, "2026-09-02")).toBe(true);
  });

  test("daily interval 2 from anchor", () => {
    expect(
      isHabitDueOnDay({ freq: "daily", interval: 2, anchor_day: "2026-09-01" }, "2026-09-01"),
    ).toBe(true);
    expect(
      isHabitDueOnDay({ freq: "daily", interval: 2, anchor_day: "2026-09-01" }, "2026-09-02"),
    ).toBe(false);
    expect(
      isHabitDueOnDay({ freq: "daily", interval: 2, anchor_day: "2026-09-01" }, "2026-09-03"),
    ).toBe(true);
  });

  test("weekly weekdays", () => {
    // 2026-09-02 is Wednesday
    expect(isHabitDueOnDay({ freq: "weekly", interval: 1, weekdays: [3] }, "2026-09-02")).toBe(
      true,
    );
    expect(isHabitDueOnDay({ freq: "weekly", interval: 1, weekdays: [1] }, "2026-09-02")).toBe(
      false,
    );
  });
});

describe("day helpers", () => {
  test("addHostDays and eachDayInclusive", () => {
    expect(addHostDays("2026-09-01", 1)).toBe("2026-09-02");
    expect(eachDayInclusive("2026-09-01", "2026-09-03")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  test("listDaysInMonth", () => {
    expect(listDaysInMonth("2026-02").length).toBe(28);
  });
});

describe("presets", () => {
  test("has build and break habits", () => {
    const items = listHabitPresets();
    expect(items.length).toBeGreaterThan(5);
    expect(items.some((p) => p.polarity === "break")).toBe(true);
  });
});
