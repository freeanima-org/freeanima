import {
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  asTaskList,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  countEntitiesSearch,
  countPendingTaskItemsGroupedByListId,
  listEntities,
} from "@freeanima/habitat/core/db/pg/entity";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";
import type { TaskItemSearchFilters } from "@freeanima/habitat/core/db/schema";

import { countCompletedActivity, shouldListCompletedActivity } from "./completed-activity.ts";
import { type SmartListPreset } from "./smart-list-presets.ts";
import { listSmartListsMerged } from "./smart-list-store.ts";

function withListContainerDefault(filters: TaskItemSearchFilters): TaskItemSearchFilters {
  if (filters.project_id != null || filters.container != null || filters.in_backlog != null) {
    return filters;
  }
  return { ...filters, container: TaskContainer.LIST };
}

export type TaskListCountRow = {
  id: number;
  item_count: number;
};

export type SmartListCountRow = {
  id?: number;
  preset?: SmartListPreset;
  item_count: number;
};

/** 清单 pending 任务数（次要数据；不经 tasklist.list） */
export async function listTaskListStats(
  worldId: number,
  opts?: { includeClosed?: boolean },
): Promise<TaskListCountRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  const counts = await countPendingTaskItemsGroupedByListId(worldId);
  const result: TaskListCountRow[] = [];
  for (const row of rows) {
    const parsed = asTaskList(row);
    if (!parsed) continue;
    if (!opts?.includeClosed && (parsed.closed ?? false)) continue;
    if (parsed.is_folder ?? false) continue;
    result.push({
      id: parsed.id,
      item_count: counts.get(parsed.id) ?? 0,
    });
  }
  return result;
}

/** 智能清单匹配条数（与打开该视图可见条数一致） */
export async function listSmartListStats(worldId: number): Promise<SmartListCountRow[]> {
  const smartLists = await listSmartListsMerged(worldId);
  const result: SmartListCountRow[] = [];
  for (const row of smartLists) {
    const filters = withListContainerDefault(row.filters);
    const item_count = shouldListCompletedActivity(filters)
      ? await countCompletedActivity(worldId, filters)
      : await countEntitiesSearch({
          world_id: worldId,
          component: TASK_ITEM_COMPONENT,
          filters,
          mode: "filter_only",
        });
    if (row.preset != null) {
      result.push({ preset: row.preset, item_count });
    } else if (row.id != null) {
      result.push({ id: row.id, item_count });
    }
  }
  return result;
}
