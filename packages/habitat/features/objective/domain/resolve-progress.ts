import {
  OBJECTIVE_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asObjective,
  asPomodoroSession,
  asProject,
  asTaskItem,
  type ObjectiveCompletion,
  type ObjectiveBody,
} from "@freeanima/habitat/core/db/schema/entity";
import { getEntity, listEntities } from "@freeanima/habitat/core/db/pg/entity";

import type { ObjectiveResolvedProgress } from "./types.ts";

function ratioOf(current: number, target: number): number | null {
  if (target === 0) return null;
  return current / target;
}

function inWindow(
  iso: string | null | undefined,
  startAt: string | null,
  endAt: string | null,
): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (startAt) {
    const s = Date.parse(startAt);
    if (!Number.isNaN(s) && t < s) return false;
  }
  if (endAt) {
    const e = Date.parse(endAt);
    if (!Number.isNaN(e) && t > e) return false;
  }
  return true;
}

async function countTasksCompleted(worldId: number, taskIds: number[]): Promise<number> {
  if (taskIds.length === 0) return 0;
  let count = 0;
  for (const id of taskIds) {
    const row = await getEntity(id);
    if (!row || row.world_id !== worldId) continue;
    const task = asTaskItem(row);
    if (task?.status === "completed") count += 1;
  }
  return count;
}

async function countProjectsCompleted(worldId: number, projectIds: number[]): Promise<number> {
  if (projectIds.length === 0) return 0;
  let count = 0;
  for (const id of projectIds) {
    const row = await getEntity(id);
    if (!row || row.world_id !== worldId) continue;
    const project = asProject(row);
    if (project?.status === "completed") count += 1;
  }
  return count;
}

async function countChildrenCompleted(
  worldId: number,
  parentId: number,
): Promise<{ current: number; target: number }> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: OBJECTIVE_COMPONENT,
    limit: 1000,
  });
  let target = 0;
  let current = 0;
  for (const row of rows) {
    const child = asObjective(row);
    if (!child) continue;
    if ((child.parent_id ?? null) !== parentId) continue;
    // 已取消不计入分母
    if (child.status === "cancelled") continue;
    target += 1;
    if (child.status === "completed") current += 1;
  }
  return { current, target };
}

async function resolvePomodoroCurrent(
  worldId: number,
  filter: { task_ids?: number[]; count_by: "sessions" | "minutes" },
  startAt: string | null,
  endAt: string | null,
): Promise<number> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: POMODORO_SESSION_COMPONENT,
    limit: 2000,
  });
  const taskFilter =
    filter.task_ids && filter.task_ids.length > 0 ? new Set(filter.task_ids) : null;

  let sessions = 0;
  let minutes = 0;
  for (const row of rows) {
    const session = asPomodoroSession(row);
    if (!session) continue;
    if (session.interrupted) continue;
    if (!session.finished_at) continue;
    if (!inWindow(session.finished_at, startAt, endAt)) continue;
    if (taskFilter) {
      if (session.task_item_id == null || !taskFilter.has(session.task_item_id)) continue;
    }
    sessions += 1;
    const ms = session.actual_duration_ms ?? session.planned_duration_ms;
    minutes += Math.max(0, Math.round(ms / 60_000));
  }
  return filter.count_by === "minutes" ? minutes : sessions;
}

export async function resolveObjectiveProgress(
  worldId: number,
  body: Pick<ObjectiveBody, "completion" | "start_at" | "end_at">,
  opts?: { objectiveId?: number },
): Promise<ObjectiveResolvedProgress | undefined> {
  const completion: ObjectiveCompletion = body.completion;

  if (completion.kind === "qualitative") {
    return undefined;
  }

  if (completion.kind === "metric_manual") {
    return {
      current: completion.current,
      target: completion.target,
      unit: completion.unit,
      ratio: ratioOf(completion.current, completion.target),
      source: "manual",
    };
  }

  const { unit, source } = completion;
  if (source.type === "habit") {
    throw new Error("习惯模块未落地");
  }

  if (source.type === "tasks_completed") {
    const current = await countTasksCompleted(worldId, source.task_ids);
    return {
      current,
      target: completion.target,
      unit,
      ratio: ratioOf(current, completion.target),
      source: "tasks_completed",
    };
  }

  if (source.type === "projects_completed") {
    const current = await countProjectsCompleted(worldId, source.project_ids);
    return {
      current,
      target: completion.target,
      unit,
      ratio: ratioOf(current, completion.target),
      source: "projects_completed",
    };
  }

  if (source.type === "children_completed") {
    const objectiveId = opts?.objectiveId;
    if (objectiveId == null) {
      return {
        current: 0,
        target: 0,
        unit: unit || "个",
        ratio: null,
        source: "children_completed",
      };
    }
    const { current, target } = await countChildrenCompleted(worldId, objectiveId);
    return {
      current,
      target,
      unit: unit || "个",
      ratio: ratioOf(current, target),
      source: "children_completed",
    };
  }

  // pomodoro
  const pomodoroFilter = {
    count_by: source.filter.count_by,
    ...(source.filter.task_ids != null ? { task_ids: source.filter.task_ids } : {}),
  };
  const current = await resolvePomodoroCurrent(
    worldId,
    pomodoroFilter,
    body.start_at ?? null,
    body.end_at ?? null,
  );
  return {
    current,
    target: completion.target,
    unit,
    ratio: ratioOf(current, completion.target),
    source: "pomodoro",
  };
}

export function assertCompletionSupported(completion: ObjectiveCompletion): void {
  if (completion.kind === "metric_auto" && completion.source.type === "habit") {
    throw new Error("习惯模块未落地");
  }
}

/** 供测试：确认组件常量可被引用 */
export const OBJECTIVE_PROGRESS_COMPONENT_HINT = {
  objective: OBJECTIVE_COMPONENT,
  task: TASK_ITEM_COMPONENT,
  project: PROJECT_COMPONENT,
  pomodoro: POMODORO_SESSION_COMPONENT,
} as const;
