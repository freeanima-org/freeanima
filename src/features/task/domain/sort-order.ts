/** 任务 / 清单 / 项目等拖拽排序的间隔步长；新建 prepend 为 min - STEP。 */
export const SORT_ORDER_STEP = 10;

export type SortOrderRow = { id: number; sort_order: number };

export type SortOrderPatch = { id: number; sort_order: number };

/** 未显式 sort_order 时：取 pending 的 min - STEP（允许负值）；空列表为 0。 */
export function nextPrependSortOrder(existingSortOrders: readonly number[]): number {
  if (existingSortOrders.length === 0) return 0;
  return Math.min(...existingSortOrders) - SORT_ORDER_STEP;
}

/**
 * 根据「仍带旧 sort_order」的新顺序，计算最少 patch。
 * 单次搬移且邻居间有整数空隙 → 只改搬移项；否则按 0, STEP, 2*STEP… 整表 densify。
 */
export function sortOrderUpdates<T extends SortOrderRow>(ordered: T[]): SortOrderPatch[] {
  if (ordered.length === 0) return [];

  let strictlyIncreasing = true;
  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (cur == null || prev == null || cur.sort_order <= prev.sort_order) {
      strictlyIncreasing = false;
      break;
    }
  }
  if (strictlyIncreasing) return [];

  const byOld = ordered.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const movedId = findSingleMovedId(
    byOld.map((row) => row.id),
    ordered.map((row) => row.id),
  );
  if (movedId != null) {
    const idx = ordered.findIndex((row) => row.id === movedId);
    const moved = ordered[idx];
    if (moved == null) {
      return densifySortOrderUpdates(ordered);
    }
    const prevRow = idx > 0 ? ordered[idx - 1] : undefined;
    const nextRow = idx < ordered.length - 1 ? ordered[idx + 1] : undefined;
    const candidate = midpointSortOrder(
      prevRow == null ? null : prevRow.sort_order,
      nextRow == null ? null : nextRow.sort_order,
    );
    if (candidate != null) {
      if (candidate === moved.sort_order) return [];
      return [{ id: movedId, sort_order: candidate }];
    }
  }

  return densifySortOrderUpdates(ordered);
}

function densifySortOrderUpdates<T extends SortOrderRow>(ordered: T[]): SortOrderPatch[] {
  const updates: SortOrderPatch[] = [];
  ordered.forEach((item, index) => {
    const next = index * SORT_ORDER_STEP;
    if (item.sort_order !== next) updates.push({ id: item.id, sort_order: next });
  });
  return updates;
}

/** 把 patch 叠回行上（未出现在 patch 里的保持旧 sort_order）。 */
export function applySortOrderUpdates<T extends SortOrderRow>(
  ordered: T[],
  updates: readonly SortOrderPatch[],
): T[] {
  if (updates.length === 0) return ordered;
  const map = new Map(updates.map((u) => [u.id, u.sort_order]));
  return ordered.map((row) => {
    const next = map.get(row.id);
    return next === undefined ? row : { ...row, sort_order: next };
  });
}

function midpointSortOrder(prev: number | null, next: number | null): number | null {
  if (prev == null && next == null) return 0;
  if (prev == null) {
    if (next == null) return 0;
    return next - SORT_ORDER_STEP;
  }
  if (next == null) return prev + SORT_ORDER_STEP;
  if (next - prev <= 1) return null;
  return Math.floor((prev + next) / 2);
}

/** 若 after 相对 before 只搬移了一个元素，返回该 id；否则 null。 */
function findSingleMovedId(before: readonly number[], after: readonly number[]): number | null {
  if (before.length !== after.length || before.length === 0) return null;
  for (const id of after) {
    const beforeRest = before.filter((x) => x !== id);
    const afterRest = after.filter((x) => x !== id);
    if (
      beforeRest.every((x, i) => x === afterRest[i]) &&
      before.indexOf(id) !== after.indexOf(id)
    ) {
      return id;
    }
  }
  return null;
}
