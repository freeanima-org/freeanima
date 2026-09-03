/// <reference lib="dom" />
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { registerPomodoroOfflineModule } from "./pomodoro-offline-adapter.ts";

/** @deprecated 历史别名；现为 subject 实体 id（number） */
export type PomodoroSubjectKind = number;

export type PomodoroConfigRow = {
  work_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  cycles_before_long_break: number;
  auto_start_break: boolean;
  auto_start_work: boolean;
  notify_on_phase_end: boolean;
  sound_enabled: boolean;
};

export type PomodoroSessionRow = {
  id: number;
  title: string;
  phase: "work" | "short_break" | "long_break";
  started_at: string;
  finished_at: string | null;
  planned_duration_ms: number;
  actual_duration_ms: number | null;
  task_item_id: number | null;
  calendar_event_id: number | null;
  habit_id: number | null;
  cycle_index: number;
  interrupted: boolean;
  created_at: string;
  updated_at: string;
};

export type PomodoroStats = {
  completed_work_sessions: number;
  total_focus_minutes: number;
  interrupted_count: number;
};

export type PomodoroTaskFocusRow = {
  id: number;
  session_local_id: string;
  pomodoro_session_id: number | null;
  phase: PomodoroSessionRow["phase"];
  phase_started_at: string;
  task_item_id: number | null;
  calendar_event_id: number | null;
  habit_id: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index: number;
  created_at: string;
  updated_at: string;
};

export type PomodoroTaskFocusSegmentInput = {
  session_local_id: string;
  phase: PomodoroSessionRow["phase"];
  phase_started_at: string;
  task_item_id?: number | null;
  calendar_event_id?: number | null;
  habit_id?: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index?: number;
};

function habitat() {
  return getTypedHabitatClient();
}

let pomodoroModuleRegistered = false;

function ensurePomodoroOfflineModule(): void {
  if (pomodoroModuleRegistered) return;
  registerPomodoroOfflineModule();
  pomodoroModuleRegistered = true;
}

export async function fetchPomodoroConfig(subjectId: number): Promise<PomodoroConfigRow> {
  ensurePomodoroOfflineModule();
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `config:${subjectId}`,
    fetch: async () => {
      const data = await habitat().call("pomodoro.config.get", { subject_id: subjectId });
      return data.config;
    },
    offlineError: "pomodoro.config unavailable offline",
  });
}

export async function updatePomodoroConfig(
  subjectId: number,
  patch: Partial<PomodoroConfigRow>,
): Promise<PomodoroConfigRow> {
  const data = await habitat().call("pomodoro.config.update", {
    subject_id: subjectId,
    ...patch,
  });
  return data.config;
}

export async function completePomodoroSession(
  subjectId: number,
  input: {
    phase: PomodoroSessionRow["phase"];
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    calendar_event_id?: number | null;
    habit_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: PomodoroTaskFocusSegmentInput[];
  },
): Promise<PomodoroSessionRow> {
  const data = await habitat().call("pomodoro.session.complete", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function abortPomodoroSession(
  subjectId: number,
  input: {
    phase: PomodoroSessionRow["phase"];
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    calendar_event_id?: number | null;
    habit_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: PomodoroTaskFocusSegmentInput[];
  },
): Promise<PomodoroSessionRow> {
  const data = await habitat().call("pomodoro.session.abort", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function fetchPomodoroSessions(
  subjectId: number,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: PomodoroSessionRow[]; total: number }> {
  ensurePomodoroOfflineModule();
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `sessions:${subjectId}`,
    fetch: async () =>
      habitat().call("pomodoro.session.list", {
        subject_id: subjectId,
        limit: opts?.limit ?? 20,
        offset: opts?.offset ?? 0,
      }),
    offlineError: "pomodoro.session.list unavailable offline",
  });
}

export async function fetchPomodoroStats(
  subjectId: number,
  period: "today" | "week" = "today",
): Promise<PomodoroStats> {
  ensurePomodoroOfflineModule();
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `stats:${subjectId}:${period}`,
    fetch: async () => habitat().call("pomodoro.session.stats", { subject_id: subjectId, period }),
    offlineError: "pomodoro.session.stats unavailable offline",
  });
}

export async function fetchPomodoroTaskFocus(
  subjectId: number,
  opts?: {
    task_item_id?: number;
    pomodoro_session_id?: number;
    session_local_id?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ items: PomodoroTaskFocusRow[]; total: number }> {
  return habitat().call("pomodoro.focus.list", {
    subject_id: subjectId,
    task_item_id: opts?.task_item_id,
    pomodoro_session_id: opts?.pomodoro_session_id,
    session_local_id: opts?.session_local_id,
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
  });
}

export type PomodoroActiveRemote = {
  phase: PomodoroSessionRow["phase"];
  run_state: "running" | "paused";
  phase_planned_ms: number;
  phase_ends_at: number | null;
  paused_remaining_ms: number | null;
  cycle_index: number;
  completed_work_in_cycle: number;
  task_item_id: number | null;
  calendar_event_id: number | null;
  habit_id: number | null;
  session_local_id: string;
  phase_started_at: string;
  focus_segments: Array<{
    task_item_id: number | null;
    calendar_event_id: number | null;
    habit_id: number | null;
    started_at: string;
    ended_at: string | null;
  }>;
  device_id: string;
  updated_at_ms: number;
};

export async function fetchPomodoroActive(subjectId: number): Promise<PomodoroActiveRemote | null> {
  const data = await habitat().call("pomodoro.active.get", { subject_id: subjectId });
  return data.active;
}

export async function putPomodoroActiveRemote(
  subjectId: number,
  active: PomodoroActiveRemote,
): Promise<PomodoroActiveRemote | null> {
  const data = await habitat().call("pomodoro.active.put", { subject_id: subjectId, active });
  return data.active;
}

export async function clearPomodoroActiveRemote(subjectId: number): Promise<void> {
  await habitat().call("pomodoro.active.clear", { subject_id: subjectId });
}
