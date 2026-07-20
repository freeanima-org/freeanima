export type TaskTagFilterRow = { id: number; title: string };

/** 从任务行收集去重 tag，按 title/id 排序。 */
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
    .map((id) => ({ id, title: titleById.get(id) ?? String(id) }))
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

/** null = 全部 */
export function matchTaskItemByTag(
  row: { tag_ids?: number[] },
  tagFilterId: number | null,
): boolean {
  return tagFilterId == null || row.tag_ids?.includes(tagFilterId) === true;
}
