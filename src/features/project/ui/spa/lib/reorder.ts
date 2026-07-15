/** 仅返回 sort_order 实际变化的项，减少无谓 patch。 */
export function sortOrderUpdates<T extends { id: number; sort_order: number }>(
  ordered: T[],
): Array<{ id: number; sort_order: number }> {
  const updates: Array<{ id: number; sort_order: number }> = [];
  ordered.forEach((item, index) => {
    if (item.sort_order !== index) {
      updates.push({ id: item.id, sort_order: index });
    }
  });
  return updates;
}
