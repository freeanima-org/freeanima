import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import type { PomodoroActiveBody } from "@freeanima/shared/entity-shapes";

export type PomodoroActiveHabitatRow = PomodoroActiveBody & { id: number };

export function activeStateToHabitatBody(
  state: PomodoroActiveState,
  deviceId: string,
  updatedAtMs: number,
): PomodoroActiveBody {
  if (state.runState === "idle") {
    throw new Error("cannot sync idle pomodoro state");
  }
  return {
    phase: state.phase,
    run_state: state.runState,
    phase_planned_ms: state.phasePlannedMs,
    phase_ends_at: state.phaseEndsAt,
    paused_remaining_ms: state.pausedRemainingMs,
    cycle_index: state.cycleIndex,
    completed_work_in_cycle: state.completedWorkInCycle,
    task_item_id: state.taskItemId,
    calendar_event_id: state.calendarEventId,
    session_local_id: state.sessionLocalId,
    phase_started_at: state.phaseStartedAt,
    focus_segments: state.focusSegments.map((segment) => ({
      task_item_id: segment.task_item_id,
      calendar_event_id: segment.calendar_event_id,
      started_at: segment.started_at,
      ended_at: segment.ended_at,
    })),
    device_id: deviceId,
    updated_at_ms: updatedAtMs,
  };
}

export function habitatBodyToActiveState(body: PomodoroActiveBody): PomodoroActiveState {
  return {
    phase: body.phase,
    runState: body.run_state,
    phasePlannedMs: body.phase_planned_ms,
    phaseEndsAt: body.phase_ends_at,
    pausedRemainingMs: body.paused_remaining_ms,
    cycleIndex: body.cycle_index,
    completedWorkInCycle: body.completed_work_in_cycle,
    taskItemId: body.task_item_id,
    calendarEventId: body.calendar_event_id ?? null,
    sessionLocalId: body.session_local_id,
    phaseStartedAt: body.phase_started_at,
    focusSegments: body.focus_segments.map((segment) => ({
      task_item_id: segment.task_item_id,
      calendar_event_id: segment.calendar_event_id ?? null,
      started_at: segment.started_at,
      ended_at: segment.ended_at,
    })),
  };
}

export function habitatRowMeta(row: PomodoroActiveHabitatRow): {
  device_id: string;
  updated_at_ms: number;
} {
  return { device_id: row.device_id, updated_at_ms: row.updated_at_ms };
}
