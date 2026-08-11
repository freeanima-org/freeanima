import type { TaskItemSearchFilters } from "@freeanima/host/core/db/schema";

import { listTaskItems } from "./item-store.ts";
import { listTaskOccurrencesByFilters } from "./occurrence-store.ts";
import type { TaskItemRow } from "./types.ts";

function isCompletedActivityFilter(filters: TaskItemSearchFilters): boolean {
  if (filters.status !== "completed") return false;
  return filters.completed_on != null || filters.completed_on_or_after_days != null;
}

/**
 * 智能清单「已完成」：普通 completed task_item ∪ task_occurrence。
 * occurrence 行：id = series_task_id（点开 live）；occurrence_id 标明历史快照。
 */
export async function listCompletedActivity(
  worldId: number,
  filters: TaskItemSearchFilters,
  opts: { limit?: number; offset?: number } = {},
): Promise<TaskItemRow[]> {
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;

  const itemFilters: TaskItemSearchFilters = { ...filters };
  const occurrenceFilters: Record<string, unknown> = {};
  if (filters.completed_on != null) occurrenceFilters.completed_on = filters.completed_on;
  if (filters.completed_on_or_after_days != null) {
    occurrenceFilters.completed_on_or_after_days = filters.completed_on_or_after_days;
  }
  if (filters.in_backlog === true) occurrenceFilters.in_backlog = true;
  if (filters.list_id != null) occurrenceFilters.list_id = filters.list_id;
  if (filters.list_ids != null) occurrenceFilters.list_ids = filters.list_ids;
  if (filters.project_id != null) occurrenceFilters.project_id = filters.project_id;

  const [items, occurrences] = await Promise.all([
    listTaskItems(worldId, {
      filters: itemFilters,
      limit: limit + offset,
      offset: 0,
      // listTaskItems 对显式 filters 仍可能加 in_backlog；与 filters 一致
    }),
    listTaskOccurrencesByFilters(worldId, occurrenceFilters, {
      limit: limit + offset,
      offset: 0,
    }),
  ]);

  const fromItems: TaskItemRow[] = items.map((row) => ({ ...row }));
  const fromOcc: TaskItemRow[] = occurrences.map((occ) => ({
    id: occ.series_task_id,
    title: occ.title,
    content: occ.content,
    tag_ids: [],
    status: "completed" as const,
    priority: "none" as const,
    due_at: occ.due_at,
    remind_at: null,
    list_id: occ.list_id,
    project_id: occ.project_id,
    sort_order: 0,
    completed_at: occ.completed_at,
    recurrence: null,
    occurrence_id: occ.id,
    primary_component: "task_item",
    created_at: occ.created_at,
    updated_at: occ.updated_at,
  }));

  const merged = [...fromItems, ...fromOcc].toSorted((a, b) => {
    const ac = a.completed_at ?? "";
    const bc = b.completed_at ?? "";
    const cmp = bc.localeCompare(ac);
    if (cmp !== 0) return cmp;
    return (b.occurrence_id ?? b.id) - (a.occurrence_id ?? a.id);
  });

  return merged.slice(offset, offset + limit);
}

export function shouldListCompletedActivity(filters: TaskItemSearchFilters | undefined): boolean {
  return filters != null && isCompletedActivityFilter(filters);
}

export async function countCompletedActivity(
  worldId: number,
  filters: TaskItemSearchFilters,
): Promise<number> {
  // 粗算：拉合并后长度（智能清单 stats 上限与列表一致量级）
  const rows = await listCompletedActivity(worldId, filters, { limit: 5000, offset: 0 });
  return rows.length;
}
