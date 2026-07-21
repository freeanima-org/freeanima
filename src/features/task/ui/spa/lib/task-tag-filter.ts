export type TaskTagFilterRow = { id: number; title: string };

/** 任务上出现、但 title 映射里没有的 tag id（用于触发补拉标签池）。 */
export function findUnresolvedTaskTagIds(
  items: ReadonlyArray<{ tag_ids?: number[] }>,
  titleById: ReadonlyMap<number, string>,
): number[] {
  const missing = new Set<number>();
  for (const item of items) {
    for (const id of item.tag_ids ?? []) {
      if (!titleById.has(id)) missing.add(id);
    }
  }
  return [...missing].toSorted((a, b) => a - b);
}

/** 从任务行收集去重 tag，按 title/id 排序。标题未知的 id 跳过（避免筛选项显示裸数字）。 */
export function collectTagsFromTaskItems(
  items: ReadonlyArray<{ tag_ids?: number[] }>,
  titleById: ReadonlyMap<number, string>,
): TaskTagFilterRow[] {
  const ids = new Set<number>();
  for (const item of items) {
    for (const id of item.tag_ids ?? []) {
      ids.add(id);
    }
  }
  return [...ids]
    .flatMap((id) => {
      const title = titleById.get(id);
      return title ? [{ id, title }] : [];
    })
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

/** null = 全部 */
export function matchTaskItemByTag(
  row: { tag_ids?: number[] },
  tagFilterId: number | null,
): boolean {
  return tagFilterId == null || row.tag_ids?.includes(tagFilterId) === true;
}
