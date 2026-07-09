import {
  POMODORO_TASK_FOCUS_COMPONENT,
  asPomodoroTaskFocus,
  type PomodoroPhase,
} from "@freeanima/core/db/schema/entity";
import { createEntity, searchEntities } from "@freeanima/core/db/pg/entity";

import type {
  PomodoroStoreContext,
  PomodoroTaskFocusRow,
  PomodoroTaskFocusWriteInput,
} from "./types.ts";

function toFocusRow(
  row: NonNullable<ReturnType<typeof asPomodoroTaskFocus>>,
  meta: { created_at: Date; updated_at: Date },
): PomodoroTaskFocusRow {
  return {
    id: row.id,
    session_local_id: row.session_local_id,
    pomodoro_session_id: row.pomodoro_session_id,
    phase: row.phase,
    phase_started_at: row.phase_started_at,
    task_item_id: row.task_item_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    cycle_index: row.cycle_index,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function sortByStartedDesc(a: PomodoroTaskFocusRow, b: PomodoroTaskFocusRow): number {
  const at = Date.parse(a.started_at);
  const bt = Date.parse(b.started_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

function focusTitle(taskItemId: number | null, phase: PomodoroPhase): string {
  if (taskItemId != null) return `专注 · 任务 #${taskItemId}`;
  if (phase === "work") return "专注";
  return phase;
}

export type PomodoroTaskFocusListOpts = {
  task_item_id?: number;
  session_local_id?: string;
  pomodoro_session_id?: number;
  phase_started_at?: string;
  started_after?: string;
  started_before?: string;
  limit?: number;
  offset?: number;
};

export async function listPomodoroTaskFocus(
  ctx: PomodoroStoreContext,
  opts: PomodoroTaskFocusListOpts = {},
): Promise<{ items: PomodoroTaskFocusRow[]; total: number }> {
  const filters: Record<string, unknown> = {};
  if (opts.task_item_id != null) filters.task_item_id = opts.task_item_id;
  if (opts.session_local_id) filters.session_local_id = opts.session_local_id;
  if (opts.pomodoro_session_id != null) filters.pomodoro_session_id = opts.pomodoro_session_id;
  if (opts.phase_started_at) filters.phase_started_at = opts.phase_started_at;
  if (opts.started_after) filters.started_after = opts.started_after;
  if (opts.started_before) filters.started_before = opts.started_before;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: POMODORO_TASK_FOCUS_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  const items = result.results
    .map((row) => {
      const parsed = asPomodoroTaskFocus(row);
      return parsed
        ? toFocusRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is PomodoroTaskFocusRow => row != null)
    .toSorted(sortByStartedDesc);

  return { items, total: items.length };
}

export async function createPomodoroTaskFocusSegments(
  ctx: PomodoroStoreContext,
  segments: PomodoroTaskFocusWriteInput[],
  pomodoroSessionId: number | null,
): Promise<PomodoroTaskFocusRow[]> {
  const created: PomodoroTaskFocusRow[] = [];
  for (const segment of segments) {
    if (segment.duration_ms <= 0) continue;
    const row = await createEntity({
      type: "content",
      world_id: ctx.worldId,
      primary_component: POMODORO_TASK_FOCUS_COMPONENT,
      components: [POMODORO_TASK_FOCUS_COMPONENT],
      title: focusTitle(segment.task_item_id ?? null, segment.phase),
      body: {
        session_local_id: segment.session_local_id,
        pomodoro_session_id: pomodoroSessionId,
        phase: segment.phase,
        phase_started_at: segment.phase_started_at,
        task_item_id: segment.task_item_id ?? null,
        started_at: segment.started_at,
        ended_at: segment.ended_at,
        duration_ms: segment.duration_ms,
        cycle_index: segment.cycle_index ?? 0,
      },
    });
    const parsed = asPomodoroTaskFocus(row);
    if (!parsed) throw new Error("failed to persist pomodoro task focus segment");
    created.push(toFocusRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return created;
}
