import { omitUndefined } from "@freeanima/habitat/core/util";

import {
  getPomodoroConfig,
  updatePomodoroConfig,
  abortPomodoroSession,
  completePomodoroSession,
  getPomodoroStats,
  listPomodoroSessions,
  listPomodoroTaskFocus,
  resolvePomodoroWorldId,
  getPomodoroActive,
  putPomodoroActive,
  clearPomodoroActive,
} from "../domain/index.ts";
import type { PomodoroActiveBody } from "@freeanima/habitat/core/db/schema/entity";
import type { RuntimeDeps } from "./runtime-deps.ts";

import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps, subjectId: number) {
  const worldId = await resolvePomodoroWorldId(subjectId);
  return { worldId };
}

export async function servicePomodoroConfigGet(deps: RuntimeDeps, input: { subject_id: number }) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const config = await getPomodoroConfig(ctx);
  return { config };
}

export async function servicePomodoroConfigUpdate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    work_minutes?: number;
    short_break_minutes?: number;
    long_break_minutes?: number;
    cycles_before_long_break?: number;
    auto_start_break?: boolean;
    auto_start_work?: boolean;
    notify_on_phase_end?: boolean;
    sound_enabled?: boolean;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { subject_id: _sid, ...patch } = input;
  const config = await updatePomodoroConfig(ctx, omitUndefined(patch));
  return { config };
}

export async function servicePomodoroSessionComplete(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    phase: "work" | "short_break" | "long_break";
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    calendar_event_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: Array<{
      session_local_id: string;
      phase: "work" | "short_break" | "long_break";
      phase_started_at: string;
      task_item_id?: number | null;
      calendar_event_id?: number | null;
      started_at: string;
      ended_at: string;
      duration_ms: number;
      cycle_index?: number;
    }>;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { subject_id: _sid, ...body } = input;
  const item = await completePomodoroSession(ctx, body);
  return { item };
}

export async function servicePomodoroSessionAbort(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    phase: "work" | "short_break" | "long_break";
    started_at: string;
    finished_at: string;
    planned_duration_ms: number;
    actual_duration_ms: number;
    task_item_id?: number | null;
    calendar_event_id?: number | null;
    cycle_index?: number;
    title?: string;
    session_local_id?: string;
    client_op_id?: string;
    task_focus_segments?: Array<{
      session_local_id: string;
      phase: "work" | "short_break" | "long_break";
      phase_started_at: string;
      task_item_id?: number | null;
      calendar_event_id?: number | null;
      started_at: string;
      ended_at: string;
      duration_ms: number;
      cycle_index?: number;
    }>;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { subject_id: _sid, ...body } = input;
  const item = await abortPomodoroSession(ctx, body);
  return { item };
}

export async function servicePomodoroSessionList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    started_after?: string;
    started_before?: string;
    phase?: "work" | "short_break" | "long_break";
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { subject_id: _sid, ...opts } = input;
  return listPomodoroSessions(ctx, omitUndefined(opts));
}

export async function servicePomodoroSessionStats(
  deps: RuntimeDeps,
  input: { subject_id: number; period?: "today" | "week" },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const stats = await getPomodoroStats(ctx, input.period ?? "today");
  return stats;
}

export async function servicePomodoroFocusList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    task_item_id?: number;
    calendar_event_id?: number;
    session_local_id?: string;
    pomodoro_session_id?: number;
    phase_started_at?: string;
    started_after?: string;
    started_before?: string;
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const { subject_id: _sid, ...opts } = input;
  return listPomodoroTaskFocus(ctx, omitUndefined(opts));
}

export async function servicePomodoroActiveGet(deps: RuntimeDeps, input: { subject_id: number }) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const active = await getPomodoroActive(ctx);
  return { active: active ? omitEntityId(active) : null };
}

export async function servicePomodoroActivePut(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    active: PomodoroActiveBody;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  const row = await putPomodoroActive(ctx, input.active);
  return { active: row ? omitEntityId(row) : null };
}

export async function servicePomodoroActiveClear(deps: RuntimeDeps, input: { subject_id: number }) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_id);
  await clearPomodoroActive(ctx);
  return { ok: true as const };
}

function omitEntityId<T extends { id: number }>(row: T): Omit<T, "id"> {
  const { id: _id, ...rest } = row;
  return rest;
}
