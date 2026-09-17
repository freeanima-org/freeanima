/** Task 模块 Portal query key 约定（选型 / 搜索 / 智能清单）。 */

export function taskListsQueryKey(subjectId: number) {
  return ["task", "lists", subjectId] as const;
}

export function taskSmartListsQueryKey(subjectId: number) {
  return ["task", "smartLists", subjectId] as const;
}

export function taskListItemsQueryKey(subjectId: number, listId: number) {
  return ["task", "items", subjectId, "list", listId] as const;
}

export function taskSmartItemsQueryKey(subjectId: number, smartKey: string) {
  return ["task", "items", subjectId, "smart", smartKey] as const;
}

export function taskSearchItemsQueryKey(subjectId: number, query: string) {
  return ["task", "items", subjectId, "search", query] as const;
}
