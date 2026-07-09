/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getPomodoroHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}

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
  return getPomodoroHubClient();
}

export async function fetchPomodoroConfig(
  subjectKind: PomodoroSubjectKind,
): Promise<PomodoroConfigRow> {
  const data = await hub().call("pomodoro.config.get", { subject_kind: subjectKind });
  return data.config;
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
  return hub().call("pomodoro.session.list", {
    subject_kind: subjectKind,
    limit: opts?.limit ?? 20,
    offset: opts?.offset ?? 0,
  });
}

export async function fetchPomodoroStats(
  subjectKind: PomodoroSubjectKind,
  period: "today" | "week" = "today",
): Promise<PomodoroStats> {
  return hub().call("pomodoro.session.stats", { subject_kind: subjectKind, period });
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
