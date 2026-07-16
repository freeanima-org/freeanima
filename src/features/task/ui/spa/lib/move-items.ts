import { moveTaskItemToList, moveTaskItemToProject } from "./api.ts";

/** 将任务批量移动到目标清单（按顺序追加 sort_order） */
export async function moveTaskItemsToList(
  itemIds: number[],
  targetListId: number,
  baseSortOrder = 0,
): Promise<void> {
  await Promise.all(
    itemIds.map((id, index) => moveTaskItemToList(id, targetListId, baseSortOrder + index)),
  );
}

/** 将任务批量移入项目 */
export async function moveTaskItemsToProject(itemIds: number[], projectId: number): Promise<void> {
  await Promise.all(itemIds.map((id) => moveTaskItemToProject(id, projectId)));
}
