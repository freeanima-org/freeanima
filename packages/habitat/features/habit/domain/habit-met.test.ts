import { describe, expect, test } from "bun:test";

import { habitBodySchema } from "@freeanima/habitat/core/db/schema/entity";

import { booleanCheckInAmount, defaultBooleanTarget, isHabitDayMet } from "./habit-met.ts";

describe("isHabitDayMet", () => {
  test("养成：无记录未达标，达到目标达标", () => {
    expect(isHabitDayMet("build", 0, 1)).toBe(false);
    expect(isHabitDayMet("build", 1, 1)).toBe(true);
    expect(isHabitDayMet("build", 3, 8)).toBe(false);
    expect(isHabitDayMet("build", 8, 8)).toBe(true);
  });

  test("戒除：无记录达标，等于上限达标，超过失败", () => {
    expect(isHabitDayMet("break", 0, 0)).toBe(true);
    expect(isHabitDayMet("break", 0, 2)).toBe(true);
    expect(isHabitDayMet("break", 2, 2)).toBe(true);
    expect(isHabitDayMet("break", 3, 2)).toBe(false);
    expect(isHabitDayMet("break", 1, 0)).toBe(false);
  });
});

describe("boolean helpers", () => {
  test("defaultBooleanTarget", () => {
    expect(defaultBooleanTarget("build")).toBe(1);
    expect(defaultBooleanTarget("break")).toBe(0);
  });

  test("booleanCheckInAmount 戒除刚超上限", () => {
    expect(booleanCheckInAmount("build", 1)).toBe(1);
    expect(booleanCheckInAmount("break", 0)).toBe(1);
    expect(booleanCheckInAmount("break", 2)).toBe(3);
  });
});

describe("habitBodySchema boolean target", () => {
  test("养成 boolean target=1", () => {
    const parsed = habitBodySchema.parse({
      polarity: "build",
      record_mode: "boolean",
      target: 1,
    });
    expect(parsed.target).toBe(1);
  });

  test("戒除 boolean target=0", () => {
    const parsed = habitBodySchema.parse({
      polarity: "break",
      record_mode: "boolean",
      target: 0,
    });
    expect(parsed.target).toBe(0);
  });

  test("戒除 boolean target=1 拒绝", () => {
    expect(() =>
      habitBodySchema.parse({
        polarity: "break",
        record_mode: "boolean",
        target: 1,
      }),
    ).toThrow();
  });
});
