import type { PomodoroActiveState, PomodoroPhase } from "./pomodoro-active-types.ts";

export type PomodoroTaskFocusSegmentPayload = {
  session_local_id: string;
  phase: PomodoroPhase;
  phase_started_at: string;
  task_item_id: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index: number;
};

function isoNow(ms: number = Date.now()): string {
  return new Date(ms).toISOString();
}

function segmentDurationMs(startedAt: string, endedAtMs: number): number {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, endedAtMs - started);
}

export function ensureWorkFocusSegments(state: PomodoroActiveState) {
  if (state.phase !== "work") return [];
  if (state.focusSegments.length > 0) return state.focusSegments;
  return [{ task_item_id: state.taskItemId, started_at: state.phaseStartedAt, ended_at: null }];
}

export function openWorkFocusSegment(
  state: PomodoroActiveState,
  taskItemId: number | null,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  if (state.phase !== "work") return { ...state, taskItemId, focusSegments: [] };
  const startedAt = isoNow(nowMs);
  return {
    ...state,
    taskItemId,
    focusSegments: [{ task_item_id: taskItemId, started_at: startedAt, ended_at: null }],
  };
}

export function switchWorkFocusTask(
  state: PomodoroActiveState,
  taskItemId: number | null,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  if (state.phase !== "work") {
    return { ...state, taskItemId };
  }
  const nowIso = isoNow(nowMs);
  const segments = ensureWorkFocusSegments(state);
  const closed = segments.map((segment, index) => {
    const isOpen = segment.ended_at == null;
    const isLast = index === segments.length - 1;
    if (!isOpen || !isLast) return segment;
    return { ...segment, ended_at: nowIso };
  });
  return {
    ...state,
    taskItemId,
    focusSegments: [...closed, { task_item_id: taskItemId, started_at: nowIso, ended_at: null }],
  };
}

export function closeOpenWorkFocusSegments(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  if (state.phase !== "work") return state;
  const nowIso = isoNow(nowMs);
  const segments = ensureWorkFocusSegments(state);
  const closed = segments.map((segment) =>
    segment.ended_at == null ? { ...segment, ended_at: nowIso } : segment,
  );
  return { ...state, focusSegments: closed };
}

export function buildTaskFocusSegmentPayloads(
  state: PomodoroActiveState,
  finishedAtMs: number = Date.now(),
): PomodoroTaskFocusSegmentPayload[] {
  if (state.phase !== "work") return [];
  const closed = closeOpenWorkFocusSegments(state, finishedAtMs).focusSegments;
  return closed
    .map((segment) => {
      const endedAt = segment.ended_at ?? isoNow(finishedAtMs);
      const durationMs = segmentDurationMs(segment.started_at, Date.parse(endedAt));
      return {
        session_local_id: state.sessionLocalId,
        phase: state.phase,
        phase_started_at: state.phaseStartedAt,
        task_item_id: segment.task_item_id,
        started_at: segment.started_at,
        ended_at: endedAt,
        duration_ms: durationMs,
        cycle_index: state.cycleIndex,
      };
    })
    .filter((segment) => segment.duration_ms > 0);
}

export function normalizeRestoredActiveState(state: PomodoroActiveState): PomodoroActiveState {
  const focusSegments = state.focusSegments ?? [];
  if (focusSegments.length > 0) return { ...state, focusSegments };
  if (state.phase !== "work") return { ...state, focusSegments: [] };
  return {
    ...state,
    focusSegments: [
      { task_item_id: state.taskItemId, started_at: state.phaseStartedAt, ended_at: null },
    ],
  };
}

export function primaryTaskItemIdFromSegments(
  segments: PomodoroTaskFocusSegmentPayload[],
): number | null {
  let best: PomodoroTaskFocusSegmentPayload | null = null;
  for (const segment of segments) {
    if (segment.task_item_id == null) continue;
    if (!best || segment.duration_ms > best.duration_ms) best = segment;
  }
  return best?.task_item_id ?? null;
}
