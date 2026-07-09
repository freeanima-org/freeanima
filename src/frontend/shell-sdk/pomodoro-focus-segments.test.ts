import { describe, expect, test } from "bun:test";

import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import { buildTaskFocusSegmentPayloads, switchWorkFocusTask } from "./pomodoro-focus-segments.ts";

function workState(taskItemId: number | null = 1): PomodoroActiveState {
  return {
    phase: "work",
    runState: "running",
    phasePlannedMs: 25 * 60_000,
    phaseEndsAt: 2_000_000,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId,
    sessionLocalId: "session-1",
    phaseStartedAt: new Date(1_000_000).toISOString(),
    focusSegments: [
      { task_item_id: taskItemId, started_at: new Date(1_000_000).toISOString(), ended_at: null },
    ],
  };
}

describe("pomodoro-focus-segments", () => {
  test("switchWorkFocusTask closes previous segment and opens a new one", () => {
    const switched = switchWorkFocusTask(workState(1), 2, 1_500_000);
    expect(switched.focusSegments).toHaveLength(2);
    expect(switched.focusSegments[0]?.task_item_id).toBe(1);
    expect(switched.focusSegments[0]?.ended_at).not.toBeNull();
    expect(switched.focusSegments[1]?.task_item_id).toBe(2);
    expect(switched.focusSegments[1]?.ended_at).toBeNull();
  });

  test("buildTaskFocusSegmentPayloads emits closed segments for persistence", () => {
    const state = switchWorkFocusTask(workState(1), 2, 1_500_000);
    const payloads = buildTaskFocusSegmentPayloads(state, 2_000_000);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]?.task_item_id).toBe(1);
    expect(payloads[1]?.task_item_id).toBe(2);
    expect(payloads.every((segment) => segment.duration_ms > 0)).toBe(true);
  });
});
