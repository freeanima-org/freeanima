import { updateTaskItem } from "./api.ts";

/** 将任务批量移动到目标清单（按顺序追加 sort_order） */
export async function moveTaskItemsToList(
  itemIds: number[],
  targetListId: number,
  baseSortOrder = 0,
): Promise<void> {
  await Promise.all(
    itemIds.map((id, index) =>
      updateTaskItem(id, { list_id: targetListId, sort_order: baseSortOrder + index }),
    ),
  );
}
