import { describe, expect, test } from "bun:test";

import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import {
  buildTaskFocusSegmentPayloads,
  switchWorkFocusLink,
  switchWorkFocusTask,
} from "./pomodoro-focus-segments.ts";

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
    calendarEventId: null,
    habitId: null,
    sessionLocalId: "session-1",
    phaseStartedAt: new Date(1_000_000).toISOString(),
    focusSegments: [
      {
        task_item_id: taskItemId,
        calendar_event_id: null,
        habit_id: null,
        started_at: new Date(1_000_000).toISOString(),
        ended_at: null,
      },
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

  test("switchWorkFocusLink 任务与事件互斥", () => {
    const withEvent = switchWorkFocusLink(
      workState(1),
      { taskItemId: null, calendarEventId: 9, habitId: null },
      1_500_000,
    );
    expect(withEvent.taskItemId).toBeNull();
    expect(withEvent.calendarEventId).toBe(9);
    expect(withEvent.focusSegments.at(-1)?.calendar_event_id).toBe(9);
    expect(withEvent.focusSegments.at(-1)?.task_item_id).toBeNull();

    const bothClearedToTask = switchWorkFocusLink(
      withEvent,
      { taskItemId: 3, calendarEventId: 9, habitId: null },
      1_600_000,
    );
    expect(bothClearedToTask.taskItemId).toBe(3);
    expect(bothClearedToTask.calendarEventId).toBeNull();
  });

  test("buildTaskFocusSegmentPayloads emits closed segments for persistence", () => {
    const state = switchWorkFocusTask(workState(1), 2, 1_500_000);
    const payloads = buildTaskFocusSegmentPayloads(state, 2_000_000);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]?.task_item_id).toBe(1);
    expect(payloads[1]?.task_item_id).toBe(2);
    expect(payloads.every((segment) => segment.duration_ms > 0)).toBe(true);
  });

  test("buildTaskFocusSegmentPayloads caps total duration to planned phase length", () => {
    const planned = 25 * 60_000;
    const started = 1_000_000;
    const state = workState(1);
    const overdueState: PomodoroActiveState = {
      ...state,
      phasePlannedMs: planned,
      phaseEndsAt: started + planned,
    };
    const nowMs = started + 3 * 60 * 60_000;
    const payloads = buildTaskFocusSegmentPayloads(overdueState, nowMs);
    expect(payloads).toHaveLength(1);
    const total = payloads.reduce((sum, s) => sum + s.duration_ms, 0);
    expect(total).toBe(planned);
  });
});
