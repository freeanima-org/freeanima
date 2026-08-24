import {
  POMODORO_SESSION_COMPONENT,
  asPomodoroSession,
  type PomodoroPhase,
} from "@freeanima/habitat/core/db/schema/entity";
import { createEntity, searchEntities } from "@freeanima/habitat/core/db/pg/entity";
import { formatCstIso } from "@freeanima/habitat/core/util";

import { createPomodoroTaskFocusSegments } from "./focus-store.ts";
import type {
  PomodoroSessionListOpts,
  PomodoroSessionRow,
  PomodoroSessionWriteInput,
  PomodoroStats,
  PomodoroStatsPeriod,
  PomodoroStoreContext,
} from "./types.ts";

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: "专注",
  short_break: "短休",
  long_break: "长休",
};

function toSessionRow(
  row: NonNullable<ReturnType<typeof asPomodoroSession>>,
  meta: { created_at: Date; updated_at: Date },
): PomodoroSessionRow {
  return {
    id: row.id,
    title: row.title,
    phase: row.phase,
    started_at: row.started_at,
    finished_at: row.finished_at,
    planned_duration_ms: row.planned_duration_ms,
    actual_duration_ms: row.actual_duration_ms,
    task_item_id: row.task_item_id,
    calendar_event_id: row.calendar_event_id ?? null,
    cycle_index: row.cycle_index,
    interrupted: row.interrupted,
    client_op_id: row.client_op_id,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function defaultSessionTitle(phase: PomodoroPhase, cycleIndex: number): string {
  if (phase === "work") return `番茄钟 #${cycleIndex + 1}`;
  return PHASE_LABEL[phase];
}

function sortByStartedDesc(a: PomodoroSessionRow, b: PomodoroSessionRow): number {
  const at = Date.parse(a.started_at);
  const bt = Date.parse(b.started_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

export async function listPomodoroSessions(
  ctx: PomodoroStoreContext,
  opts: PomodoroSessionListOpts = {},
): Promise<{ items: PomodoroSessionRow[]; total: number }> {
  const filters: Record<string, unknown> = {};
  if (opts.started_after) filters.started_after = opts.started_after;
  if (opts.started_before) filters.started_before = opts.started_before;
  if (opts.phase) filters.phase = opts.phase;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: POMODORO_SESSION_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  const items = result.results
    .map((row) => {
      const parsed = asPomodoroSession(row);
      return parsed
        ? toSessionRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is PomodoroSessionRow => row != null)
    .toSorted(sortByStartedDesc);

  return { items, total: items.length };
}

async function findSessionByClientOpId(
  ctx: PomodoroStoreContext,
  clientOpId: string,
): Promise<PomodoroSessionRow | null> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: POMODORO_SESSION_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asPomodoroSession(row);
  if (!parsed) return null;
  return toSessionRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

async function persistSessionWithFocus(
  ctx: PomodoroStoreContext,
  input: PomodoroSessionWriteInput,
  interrupted: boolean,
): Promise<PomodoroSessionRow> {
  if (input.client_op_id) {
    const existing = await findSessionByClientOpId(ctx, input.client_op_id);
    if (existing) return existing;
  }
  const cycleIndex = input.cycle_index ?? 0;
  const title = input.title?.trim() || defaultSessionTitle(input.phase, cycleIndex);
  const created = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    primary_component: POMODORO_SESSION_COMPONENT,
    components: [POMODORO_SESSION_COMPONENT],
    title,
    body: {
      phase: input.phase,
      started_at: input.started_at,
      finished_at: input.finished_at,
      planned_duration_ms: input.planned_duration_ms,
      actual_duration_ms: input.actual_duration_ms,
      task_item_id: input.task_item_id ?? null,
      calendar_event_id: input.task_item_id != null ? null : (input.calendar_event_id ?? null),
      cycle_index: cycleIndex,
      interrupted,
      client_op_id: input.client_op_id ?? null,
    },
  });
  const parsed = asPomodoroSession(created);
  if (!parsed) throw new Error("failed to persist pomodoro session");

  const segments = input.task_focus_segments ?? [];
  if (segments.length > 0) {
    await createPomodoroTaskFocusSegments(ctx, segments, parsed.id);
  }

  return toSessionRow(parsed, {
    created_at: created.created_at,
    updated_at: created.updated_at,
  });
}

export async function completePomodoroSession(
  ctx: PomodoroStoreContext,
  input: PomodoroSessionWriteInput,
): Promise<PomodoroSessionRow> {
  return persistSessionWithFocus(ctx, input, false);
}

export async function abortPomodoroSession(
  ctx: PomodoroStoreContext,
  input: PomodoroSessionWriteInput,
): Promise<PomodoroSessionRow> {
  return persistSessionWithFocus(ctx, input, true);
}

function periodRange(period: PomodoroStatsPeriod): { started_after: string } {
  const now = new Date();
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { started_after: start.toISOString() };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { started_after: start.toISOString() };
}

export async function getPomodoroStats(
  ctx: PomodoroStoreContext,
  period: PomodoroStatsPeriod,
): Promise<PomodoroStats> {
  const { items } = await listPomodoroSessions(ctx, {
    ...periodRange(period),
    limit: 1000,
  });

  let completedWork = 0;
  let totalFocusMs = 0;
  let interrupted = 0;

  for (const item of items) {
    if (item.interrupted) {
      interrupted += 1;
      continue;
    }
    if (item.phase !== "work") continue;
    completedWork += 1;
    totalFocusMs += item.actual_duration_ms ?? item.planned_duration_ms;
  }

  return {
    completed_work_sessions: completedWork,
    total_focus_minutes: Math.round(totalFocusMs / 60_000),
    interrupted_count: interrupted,
  };
}

export function nowIso(): string {
  return formatCstIso(new Date());
}
