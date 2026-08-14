/** Task 模块 Portal query key 约定（选型 / 搜索 / 智能清单）。 */

export function taskListsQueryKey(subjectKind: string) {
  return ["task", "lists", subjectKind] as const;
}

export function taskSmartListsQueryKey(subjectKind: string) {
  return ["task", "smartLists", subjectKind] as const;
}

export function taskListItemsQueryKey(subjectKind: string, listId: number) {
  return ["task", "items", subjectKind, "list", listId] as const;
}

export function taskSmartItemsQueryKey(subjectKind: string, smartKey: string) {
  return ["task", "items", subjectKind, "smart", smartKey] as const;
}

export function taskSearchItemsQueryKey(subjectKind: string, query: string) {
  return ["task", "items", subjectKind, "search", query] as const;
}
