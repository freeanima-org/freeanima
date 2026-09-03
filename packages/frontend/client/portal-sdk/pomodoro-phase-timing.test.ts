import { describe, expect, test } from "bun:test";

import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import {
  actualDurationMs,
  effectiveFinishedAtIso,
  effectivePhaseFinishedAtMs,
} from "./pomodoro-phase-timing.ts";

function workState(phaseEndsAt: number, phasePlannedMs = 25 * 60_000): PomodoroActiveState {
  const phaseStartedAt = new Date(1_000_000).toISOString();
  return {
    phase: "work",
    runState: "running",
    phasePlannedMs,
    phaseEndsAt,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId: null,
    calendarEventId: null,
    habitId: null,
    sessionLocalId: "session-1",
    phaseStartedAt,
    focusSegments: [
      {
        task_item_id: null,
        calendar_event_id: null,
        habit_id: null,
        started_at: phaseStartedAt,
        ended_at: null,
      },
    ],
  };
}

describe("pomodoro-phase-timing", () => {
  test("overdue running uses phaseEndsAt not wall clock", () => {
    const planned = 25 * 60_000;
    const started = 1_000_000;
    const state = workState(started + planned, planned);
    const nowMs = started + 3 * 60 * 60_000;
    expect(effectivePhaseFinishedAtMs(state, nowMs)).toBe(started + planned);
    expect(actualDurationMs(state, nowMs)).toBe(planned);
    expect(effectiveFinishedAtIso(state, nowMs)).toBe(new Date(started + planned).toISOString());
  });

  test("paused uses elapsed without counting pause wall time", () => {
    const planned = 25 * 60_000;
    const started = 1_000_000;
    const state: PomodoroActiveState = {
      ...workState(started + planned, planned),
      runState: "paused",
      phaseEndsAt: null,
      pausedRemainingMs: 20 * 60_000,
    };
    const nowMs = started + 2 * 60 * 60_000;
    expect(actualDurationMs(state, nowMs)).toBe(5 * 60_000);
  });
});
