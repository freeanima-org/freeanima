import { describe, expect, test } from "bun:test";
import {
  IDLE_PATROL_DELAY_MS,
  interpolateJourneyPoint,
  journeyDurationMs,
  shouldEnablePatrol,
} from "./character-patrol.ts";

describe("shouldEnablePatrol", () => {
  test("waits until idle delay elapsed", () => {
    const start = 1000;
    expect(shouldEnablePatrol(start, start + IDLE_PATROL_DELAY_MS - 1, false, true)).toBe(false);
    expect(shouldEnablePatrol(start, start + IDLE_PATROL_DELAY_MS, false, true)).toBe(true);
  });

  test("skips when already patrolling or model not ready", () => {
    expect(shouldEnablePatrol(0, IDLE_PATROL_DELAY_MS, true, true)).toBe(false);
    expect(shouldEnablePatrol(0, IDLE_PATROL_DELAY_MS, false, false)).toBe(false);
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
