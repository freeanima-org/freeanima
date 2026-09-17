export {
  SORT_ORDER_STEP,
  applySortOrderUpdates,
  nextPrependSortOrder,
  sortOrderUpdates,
} from "@freeanima/shared/task/sort-order.ts";
export type { SortOrderPatch, SortOrderRow } from "@freeanima/shared/task/sort-order.ts";

/** 将 draggedId 插入到 targetId 之前（targetId 为空则放到末尾） */
export function reorderIds<T extends { id: number }>(
  items: T[],
  draggedId: number,
  targetId: number | null,
): T[] {
  const from = items.findIndex((item) => item.id === draggedId);
  if (from < 0) return items;

  const dragged = items[from];
  if (!dragged) return items;

  const next = items.filter((item) => item.id !== draggedId);
  if (targetId == null) {
    next.push(dragged);
    return next;
  }

  const to = next.findIndex((item) => item.id === targetId);
  if (to < 0) {
    next.push(dragged);
    return next;
  }

  next.splice(to, 0, dragged);
  return next;
}
