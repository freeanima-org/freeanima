import type {
  PomodoroActiveState,
  PomodoroFocusLink,
  PomodoroPhase,
} from "./pomodoro-active-types.ts";
import { effectivePhaseFinishedAtMs } from "./pomodoro-phase-timing.ts";

export type PomodoroTaskFocusSegmentPayload = {
  session_local_id: string;
  phase: PomodoroPhase;
  phase_started_at: string;
  task_item_id: number | null;
  calendar_event_id: number | null;
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

function normalizeLink(link: PomodoroFocusLink): PomodoroFocusLink {
  const taskItemId = link.taskItemId ?? null;
  const calendarEventId = link.calendarEventId ?? null;
  if (taskItemId != null && calendarEventId != null) {
    return { taskItemId, calendarEventId: null };
  }
  return { taskItemId, calendarEventId };
}

function linkFromState(state: PomodoroActiveState): PomodoroFocusLink {
  return normalizeLink({
    taskItemId: state.taskItemId,
    calendarEventId: state.calendarEventId,
  });
}

function draftFromLink(link: PomodoroFocusLink, startedAt: string, endedAt: string | null) {
  const normalized = normalizeLink(link);
  return {
    task_item_id: normalized.taskItemId,
    calendar_event_id: normalized.calendarEventId,
    started_at: startedAt,
    ended_at: endedAt,
  };
}

export function ensureWorkFocusSegments(state: PomodoroActiveState) {
  if (state.phase !== "work") return [];
  if (state.focusSegments.length > 0) return state.focusSegments;
  return [draftFromLink(linkFromState(state), state.phaseStartedAt, null)];
}

export function openWorkFocusSegment(
  state: PomodoroActiveState,
  link: PomodoroFocusLink | number | null,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  const normalized =
    typeof link === "number" || link === null
      ? normalizeLink({ taskItemId: link, calendarEventId: null })
      : normalizeLink(link);
  if (state.phase !== "work") {
    return {
      ...state,
      taskItemId: normalized.taskItemId,
      calendarEventId: normalized.calendarEventId,
      focusSegments: [],
    };
  }
  const startedAt = isoNow(nowMs);
  return {
    ...state,
    taskItemId: normalized.taskItemId,
    calendarEventId: normalized.calendarEventId,
    focusSegments: [draftFromLink(normalized, startedAt, null)],
  };
}

/** @deprecated 使用 switchWorkFocusLink */
export function switchWorkFocusTask(
  state: PomodoroActiveState,
  taskItemId: number | null,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  return switchWorkFocusLink(state, { taskItemId, calendarEventId: null }, nowMs);
}

export function switchWorkFocusLink(
  state: PomodoroActiveState,
  link: PomodoroFocusLink,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  const normalized = normalizeLink(link);
  if (state.phase !== "work") {
    return {
      ...state,
      taskItemId: normalized.taskItemId,
      calendarEventId: normalized.calendarEventId,
    };
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
    taskItemId: normalized.taskItemId,
    calendarEventId: normalized.calendarEventId,
    focusSegments: [...closed, draftFromLink(normalized, nowIso, null)],
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

function capSegmentDurations(
  segments: Array<
    { duration_ms: number; ended_at: string } & Omit<PomodoroTaskFocusSegmentPayload, "duration_ms">
  >,
  maxTotalMs: number,
): PomodoroTaskFocusSegmentPayload[] {
  const total = segments.reduce((sum, s) => sum + s.duration_ms, 0);
  if (total <= maxTotalMs || total <= 0) return segments;
  const scale = maxTotalMs / total;
  let allocated = 0;
  return segments.map((segment, index) => {
    if (index === segments.length - 1) {
      return { ...segment, duration_ms: Math.max(0, maxTotalMs - allocated) };
    }
    const capped = Math.floor(segment.duration_ms * scale);
    allocated += capped;
    return { ...segment, duration_ms: capped };
  });
}

export function buildTaskFocusSegmentPayloads(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): PomodoroTaskFocusSegmentPayload[] {
  if (state.phase !== "work") return [];
  const effectiveFinishMs = effectivePhaseFinishedAtMs(state, nowMs);
  const closed = closeOpenWorkFocusSegments(state, effectiveFinishMs).focusSegments;
  const raw = closed
    .map((segment) => {
      const endedAt = segment.ended_at ?? isoNow(effectiveFinishMs);
      const endedMs = Math.min(Date.parse(endedAt), effectiveFinishMs);
      const durationMs = segmentDurationMs(segment.started_at, endedMs);
      return {
        session_local_id: state.sessionLocalId,
        phase: state.phase,
        phase_started_at: state.phaseStartedAt,
        task_item_id: segment.task_item_id,
        calendar_event_id: segment.calendar_event_id ?? null,
        started_at: segment.started_at,
        ended_at: new Date(endedMs).toISOString(),
        duration_ms: durationMs,
        cycle_index: state.cycleIndex,
      };
    })
    .filter((segment) => segment.duration_ms > 0);
  return capSegmentDurations(raw, state.phasePlannedMs);
}

export function normalizeRestoredActiveState(state: PomodoroActiveState): PomodoroActiveState {
  const focusSegments = (state.focusSegments ?? []).map((segment) => ({
    task_item_id: segment.task_item_id,
    calendar_event_id: segment.calendar_event_id ?? null,
    started_at: segment.started_at,
    ended_at: segment.ended_at,
  }));
  const calendarEventId = state.calendarEventId ?? null;
  const normalizedState = normalizeLink({
    taskItemId: state.taskItemId,
    calendarEventId,
  });
  if (focusSegments.length > 0) {
    return {
      ...state,
      taskItemId: normalizedState.taskItemId,
      calendarEventId: normalizedState.calendarEventId,
      focusSegments,
    };
  }
  if (state.phase !== "work") {
    return {
      ...state,
      taskItemId: normalizedState.taskItemId,
      calendarEventId: normalizedState.calendarEventId,
      focusSegments: [],
    };
  }
  return {
    ...state,
    taskItemId: normalizedState.taskItemId,
    calendarEventId: normalizedState.calendarEventId,
    focusSegments: [draftFromLink(normalizedState, state.phaseStartedAt, null)],
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

export function primaryCalendarEventIdFromSegments(
  segments: PomodoroTaskFocusSegmentPayload[],
): number | null {
  let best: PomodoroTaskFocusSegmentPayload | null = null;
  for (const segment of segments) {
    if (segment.calendar_event_id == null) continue;
    if (!best || segment.duration_ms > best.duration_ms) best = segment;
  }
  return best?.calendar_event_id ?? null;
}
