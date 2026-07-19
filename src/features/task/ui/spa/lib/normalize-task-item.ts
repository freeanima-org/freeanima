import type { TaskItemRowPayload } from "@freeanima/shared/sap-contract/frames/task.ts";

/** Hub / 缓存行可能缺 tag_ids；渲染前归一成数组。 */
export function normalizeTaskItemRow<T extends TaskItemRowPayload>(row: T): T {
  return { ...row, tag_ids: row.tag_ids ?? [] };
}

/** items 缺省或非数组时返回 []，并对每行补齐 tag_ids。 */
export function normalizeTaskItemRows(
  items: readonly TaskItemRowPayload[] | null | undefined,
): TaskItemRowPayload[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeTaskItemRow);
}
