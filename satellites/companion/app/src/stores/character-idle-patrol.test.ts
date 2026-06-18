import { describe, expect, test } from "bun:test";
import { DEFAULT_BEHAVIOR } from "@shared/companion-schema.ts";
import {
  interpolateJourneyPoint,
  journeyDurationMs,
  shouldEnablePatrol,
} from "./character-patrol.ts";

describe("shouldEnablePatrol", () => {
  test("waits until idle delay elapsed", () => {
    const start = 1000;
    const delay = DEFAULT_BEHAVIOR.idle_patrol_delay_sec * 1000;
    expect(shouldEnablePatrol(start, start + delay - 1, false, true, DEFAULT_BEHAVIOR)).toBe(false);
    expect(shouldEnablePatrol(start, start + delay, false, true, DEFAULT_BEHAVIOR)).toBe(true);
  });

  test("skips when already patrolling or model not ready", () => {
    const delay = DEFAULT_BEHAVIOR.idle_patrol_delay_sec * 1000;
    expect(shouldEnablePatrol(0, delay, true, true, DEFAULT_BEHAVIOR)).toBe(false);
    expect(shouldEnablePatrol(0, delay, false, false, DEFAULT_BEHAVIOR)).toBe(false);
  });

  test("skips when patrol disabled", () => {
    const delay = DEFAULT_BEHAVIOR.idle_patrol_delay_sec * 1000;
    expect(
      shouldEnablePatrol(0, delay, false, true, { ...DEFAULT_BEHAVIOR, patrol_enabled: false }),
    ).toBe(false);
  });
});

describe("interpolateJourneyPoint", () => {
  test("linear midpoint", () => {
    expect(interpolateJourneyPoint({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.5)).toEqual({
      x: 50,
      y: 100,
    });
  });
});

describe("journeyDurationMs", () => {
  test("scales with distance at constant speed", () => {
    expect(journeyDurationMs(190)).toBe(2000);
    expect(journeyDurationMs(4)).toBe(1200);
  });
});
