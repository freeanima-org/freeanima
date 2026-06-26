/** Shift 连续选择：将 anchor 与 target 之间（含）的 id 并入已有选中集 */
export function applyShiftRangeSelect(
  selected: ReadonlySet<number>,
  orderedIds: readonly number[],
  anchorId: number | null,
  targetId: number,
): Set<number> {
  const next = new Set(selected);
  if (anchorId == null) {
    next.add(targetId);
    return next;
  }

  const from = orderedIds.indexOf(anchorId);
  const to = orderedIds.indexOf(targetId);
  if (from < 0 || to < 0) {
    next.add(targetId);
    return next;
  }

  const [start, end] = from < to ? [from, to] : [to, from];
  for (let i = start; i <= end; i++) {
    next.add(orderedIds[i]!);
  }
  return next;
}
