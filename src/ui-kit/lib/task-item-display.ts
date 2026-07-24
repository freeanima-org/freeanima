export type TaskItemPriority = "high" | "medium" | "low" | "none";
export type TaskItemStatus = "pending" | "completed";

/** 任务列表/详情 UI 的最小字段集（feature 层 row 类型可结构兼容） */
export type TaskItemDisplay = {
  id: number;
  title: string;
  content: string;
  tag_ids: number[];
  status: TaskItemStatus;
  priority: TaskItemPriority;
  due_at: string | null;
};

export function priorityDot(priority: TaskItemPriority): string {
  switch (priority) {
    case "high":
      return "text-error";
    case "medium":
      return "text-warning";
    case "low":
      return "text-info";
    default:
      return "text-base-content/30";
  }
}

export function cloneTaskItemDisplay<T extends TaskItemDisplay>(item: T): T {
  return { ...item, tag_ids: [...(item.tag_ids ?? [])] };
}

export function isTaskItemDisplayEqual(a: TaskItemDisplay, b: TaskItemDisplay): boolean {
  const aTags = a.tag_ids ?? [];
  const bTags = b.tag_ids ?? [];
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.due_at === b.due_at &&
    aTags.length === bTags.length &&
    aTags.every((t, i) => t === bTags[i])
  );
}

export function isTaskItemDisplayDirty(
  current: TaskItemDisplay,
  baseline: TaskItemDisplay,
): boolean {
  return !isTaskItemDisplayEqual(current, baseline);
}

/** 列表行标签条默认最多展示的 chip 数；超出显示 +N */
export const TASK_ROW_TAG_MAX_VISIBLE = 2;

/** 从 tag_ids + 标题映射解析可读标签名（缺失 id 跳过；tagIds 缺省视为空） */
export function resolveTaskTagTitles(
  tagIds: readonly number[] | null | undefined,
  titleById: ReadonlyMap<number, string> | null | undefined,
): string[] {
  if (!titleById || !tagIds?.length) return [];
  const out: string[] = [];
  for (const id of tagIds) {
    const title = titleById.get(id);
    if (title) out.push(title);
  }
  return out;
}

/** 行内展示：可见标题 + 溢出数量 */
export function splitTaskTagTitlesForDisplay(
  titles: readonly string[],
  maxVisible: number = TASK_ROW_TAG_MAX_VISIBLE,
): { visible: string[]; overflowCount: number } {
  const limit = Math.max(0, maxVisible);
  if (titles.length <= limit) {
    return { visible: [...titles], overflowCount: 0 };
  }
  return {
    visible: titles.slice(0, limit),
    overflowCount: titles.length - limit,
  };
}
