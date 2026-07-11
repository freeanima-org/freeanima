/// <reference lib="dom" />
import { resolveHubCacheScope } from "@freeanima/frontend/shell-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache-first";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub";

import { registerPomodoroOfflineModule } from "./pomodoro-offline-adapter.ts";

export type PomodoroSubjectKind = "user" | "agent";

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
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index?: number;
};

function hub() {
  return getTypedSatelliteHubClient();
}

let pomodoroModuleRegistered = false;

function ensurePomodoroOfflineModule(): void {
  if (pomodoroModuleRegistered) return;
  registerPomodoroOfflineModule();
  pomodoroModuleRegistered = true;
}

export async function fetchPomodoroConfig(
  subjectKind: PomodoroSubjectKind,
): Promise<PomodoroConfigRow> {
  ensurePomodoroOfflineModule();
  const scope = resolveHubCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `config:${subjectKind}`,
    fetch: async () => {
      const data = await hub().call("pomodoro.config.get", { subject_kind: subjectKind });
      return data.config;
    },
    offlineError: "pomodoro.config unavailable offline",
  });
}

export async function updatePomodoroConfig(
  subjectKind: PomodoroSubjectKind,
  patch: Partial<PomodoroConfigRow>,
): Promise<PomodoroConfigRow> {
  const data = await hub().call("pomodoro.config.update", { subject_kind: subjectKind, ...patch });
  return data.config;
}

export async function completePomodoroSession(
  subjectKind: PomodoroSubjectKind,
  input: {
    phase: PomodoroSessionRow["phase"];
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: PomodoroTaskFocusSegmentInput[];
  },
): Promise<PomodoroSessionRow> {
  const data = await hub().call("pomodoro.session.complete", {
    subject_kind: subjectKind,
    ...input,
  });
  return data.item;
}

export async function abortPomodoroSession(
  subjectKind: PomodoroSubjectKind,
  input: {
    phase: PomodoroSessionRow["phase"];
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: PomodoroTaskFocusSegmentInput[];
  },
): Promise<PomodoroSessionRow> {
  const data = await hub().call("pomodoro.session.abort", {
    subject_kind: subjectKind,
    ...input,
  });
  return data.item;
}

export async function fetchPomodoroSessions(
  subjectKind: PomodoroSubjectKind,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: PomodoroSessionRow[]; total: number }> {
  ensurePomodoroOfflineModule();
  const scope = resolveHubCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `sessions:${subjectKind}`,
    fetch: async () =>
      hub().call("pomodoro.session.list", {
        subject_kind: subjectKind,
        limit: opts?.limit ?? 20,
        offset: opts?.offset ?? 0,
      }),
    offlineError: "pomodoro.session.list unavailable offline",
  });
}

export async function fetchPomodoroStats(
  subjectKind: PomodoroSubjectKind,
  period: "today" | "week" = "today",
): Promise<PomodoroStats> {
  ensurePomodoroOfflineModule();
  const scope = resolveHubCacheScope();
  return withOfflineCache({
    scope,
    namespace: "pomodoro",
    id: `stats:${subjectKind}:${period}`,
    fetch: async () => hub().call("pomodoro.session.stats", { subject_kind: subjectKind, period }),
    offlineError: "pomodoro.session.stats unavailable offline",
  });
}

export async function fetchPomodoroTaskFocus(
  subjectKind: PomodoroSubjectKind,
  opts?: {
    task_item_id?: number;
    pomodoro_session_id?: number;
    session_local_id?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ items: PomodoroTaskFocusRow[]; total: number }> {
  return hub().call("pomodoro.focus.list", {
    subject_kind: subjectKind,
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
  session_local_id: string;
  phase_started_at: string;
  focus_segments: Array<{
    task_item_id: number | null;
    started_at: string;
    ended_at: string | null;
  }>;
  device_id: string;
  updated_at_ms: number;
};

export async function fetchPomodoroActive(
  subjectKind: PomodoroSubjectKind,
): Promise<PomodoroActiveRemote | null> {
  const data = await hub().call("pomodoro.active.get", { subject_kind: subjectKind });
  return data.active;
}

export async function putPomodoroActiveRemote(
  subjectKind: PomodoroSubjectKind,
  active: PomodoroActiveRemote,
): Promise<PomodoroActiveRemote | null> {
  const data = await hub().call("pomodoro.active.put", { subject_kind: subjectKind, active });
  return data.active;
}

export async function clearPomodoroActiveRemote(subjectKind: PomodoroSubjectKind): Promise<void> {
  await hub().call("pomodoro.active.clear", { subject_kind: subjectKind });
}
