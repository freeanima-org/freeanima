import { describe, expect, test } from "bun:test";

import {
  formatPomodoroClock,
  formatPomodoroNavLabel,
  pomodoroPhaseLabel,
  pomodoroRemainingMs,
} from "./pomodoro-remaining.ts";
import type { PomodoroActiveState } from "./pomodoro-active-types.ts";

function base(overrides: Partial<PomodoroActiveState> = {}): PomodoroActiveState {
  return {
    phase: "work",
    runState: "running",
    phasePlannedMs: 25 * 60_000,
    phaseEndsAt: 1_000_000,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId: null,
    calendarEventId: null,
    habitId: null,
    sessionLocalId: "s1",
    phaseStartedAt: new Date(0).toISOString(),
    focusSegments: [],
    ...overrides,
  };
}

describe("pomodoro-remaining", () => {
  test("formatPomodoroClock", () => {
    expect(formatPomodoroClock(65_000)).toBe("01:05");
    expect(formatPomodoroClock(999)).toBe("00:01");
  });

  test("running remaining", () => {
    expect(pomodoroRemainingMs(base({ phaseEndsAt: 1_000_000 }), 940_000)).toBe(60_000);
  });

  test("paused remaining", () => {
    expect(
      pomodoroRemainingMs(
        base({ runState: "paused", phaseEndsAt: null, pausedRemainingMs: 12_000 }),
      ),
    ).toBe(12_000);
  });

  test("nav label", () => {
    expect(formatPomodoroNavLabel(base({ phaseEndsAt: 1_000_000 }), 940_000)).toBe("专注 · 01:00");
    expect(pomodoroPhaseLabel("short_break")).toBe("短休");
  });
});
