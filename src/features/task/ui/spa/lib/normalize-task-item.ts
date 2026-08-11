import { TASK_ITEM_COMPONENT } from "@freeanima/host/core/db/schema/entity";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";

/** Habitat / 缓存行可能缺 tag_ids / primary_component；渲染前补齐。 */
export function normalizeTaskItemRow<T extends TaskItemRowPayload>(row: T): T {
  return {
    ...row,
    tag_ids: row.tag_ids ?? [],
    primary_component: row.primary_component ?? TASK_ITEM_COMPONENT,
  };
}

/** items 缺省或非数组时返回 []，并对每行补齐 tag_ids。 */
export function normalizeTaskItemRows(
  items: readonly TaskItemRowPayload[] | null | undefined,
): TaskItemRowPayload[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeTaskItemRow);
}
