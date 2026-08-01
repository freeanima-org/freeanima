export type TaskItemPriority = "high" | "medium" | "low" | "none";
export type TaskItemStatus = "pending" | "completed";

export type TaskRecurrenceSkip = "none" | "weekend" | "holiday" | "weekend_and_holiday";
export type TaskRecurrenceCalendar = "gregorian" | "lunar";

export type TaskItemRecurrenceDisplay = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  anchor: "due" | "completion";
  weekdays?: number[] | undefined;
  until?: string | null | undefined;
  count?: number | null | undefined;
  schedule_at: string;
  skip?: TaskRecurrenceSkip | undefined;
  workdays_only?: boolean | undefined;
  calendar?: TaskRecurrenceCalendar | undefined;
  lunar_month?: number | undefined;
  lunar_day?: number | undefined;
};

export type TaskItemReminderDisplay = {
  at: string;
};

/** 任务列表/详情 UI 的最小字段集（feature 层 row 类型可结构兼容） */
export type TaskItemDisplay = {
  id: number;
  title: string;
  content: string;
  tag_ids: number[];
  status: TaskItemStatus;
  priority: TaskItemPriority;
  due_at: string | null;
  remind_at?: string | null | undefined;
  reminders?: TaskItemReminderDisplay[] | undefined;
  /** 缺省/undefined = 非重复；null 显式清除 */
  recurrence?: TaskItemRecurrenceDisplay | null | undefined;
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

function normalizeRemindersForEqual(item: TaskItemDisplay): {
  remind_at: string | null;
  reminders: TaskItemReminderDisplay[];
} {
  const fromArray = (item.reminders ?? []).filter((r) => r.at);
  if (fromArray.length > 0) {
    return { remind_at: fromArray[0]?.at ?? null, reminders: fromArray };
  }
  const single = item.remind_at ?? null;
  return { remind_at: single, reminders: single ? [{ at: single }] : [] };
}

export function cloneTaskItemDisplay<T extends TaskItemDisplay>(item: T): T {
  return {
    ...item,
    tag_ids: [...(item.tag_ids ?? [])],
    reminders: item.reminders ? item.reminders.map((r) => ({ ...r })) : undefined,
  };
}

export function isTaskItemDisplayEqual(a: TaskItemDisplay, b: TaskItemDisplay): boolean {
  const aTags = a.tag_ids ?? [];
  const bTags = b.tag_ids ?? [];
  const aRem = normalizeRemindersForEqual(a);
  const bRem = normalizeRemindersForEqual(b);
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.due_at === b.due_at &&
    aRem.remind_at === bRem.remind_at &&
    JSON.stringify(aRem.reminders) === JSON.stringify(bRem.reminders) &&
    JSON.stringify(a.recurrence ?? null) === JSON.stringify(b.recurrence ?? null) &&
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
