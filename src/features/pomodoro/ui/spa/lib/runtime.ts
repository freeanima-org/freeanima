import {
  buildTaskFocusSegmentPayloads,
  primaryTaskItemIdFromSegments,
} from "@freeanima/frontend/portal-sdk/pomodoro-focus-segments.ts";
import type { PomodoroActiveState } from "@freeanima/frontend/portal-sdk/pomodoro-active-types.ts";
import {
  actualDurationMs,
  effectiveFinishedAtIso,
} from "@freeanima/frontend/portal-sdk/pomodoro-phase-timing.ts";

import { phaseCompletionKey } from "./timer-engine.ts";
import type { PomodoroTaskFocusSegmentInput } from "./api.ts";

export type PhaseEndPayload = {
  phase: PomodoroActiveState["phase"];
  started_at: string;
  finished_at: string;
  planned_duration_ms: number;
  actual_duration_ms: number;
  task_item_id: number | null;
  cycle_index: number;
  session_local_id: string;
  client_op_id: string;
  task_focus_segments?: PomodoroTaskFocusSegmentInput[];
};

export function buildPhaseEndPayload(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): PhaseEndPayload {
  const segments = buildTaskFocusSegmentPayloads(state, nowMs);
  return {
    phase: state.phase,
    started_at: state.phaseStartedAt,
    finished_at: effectiveFinishedAtIso(state, nowMs),
    planned_duration_ms: state.phasePlannedMs,
    actual_duration_ms: actualDurationMs(state, nowMs),
    task_item_id: primaryTaskItemIdFromSegments(segments) ?? state.taskItemId,
    cycle_index: state.cycleIndex,
    session_local_id: state.sessionLocalId,
    client_op_id: phaseCompletionKey(state),
    ...(segments.length > 0 ? { task_focus_segments: segments } : {}),
  };
}
