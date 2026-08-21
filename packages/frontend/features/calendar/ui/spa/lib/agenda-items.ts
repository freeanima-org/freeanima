import type { TaskItemSearchFiltersPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";
import type { CalendarRangeItem } from "./api.ts";
import { dayKeyFromIso, dayRangeIso } from "./format-calendar.ts";

export function dueFiltersForAgenda(
  viewMode: string,
  selectedDay: string,
  today: string,
): TaskItemSearchFiltersPayload | null {
  // TaskContainer.ANY：与 calendar.range 一致，含项目内仅有截止的任务
  const base: TaskItemSearchFiltersPayload = {
    status: "pending",
    has_due_at: true,
    roots_only: true,
    container: TaskContainer.ANY,
  };
  if (viewMode === "day") {
    if (selectedDay === today) return { ...base, due_on_or_before_days: 0 };
    const range = dayRangeIso(selectedDay);
    return { ...base, due_after: range.from, due_before: range.to };
  }
  if (viewMode === "next3") return { ...base, due_on_or_before_days: 2 };
  if (viewMode === "next7") return { ...base, due_on_or_before_days: 6 };
  return null;
}

/** 议程今日「逾期」区：计划已结束（结束日早于今天）的 pending 根任务 */
export function planOverdueFiltersForAgenda(
  viewMode: string,
  selectedDay: string,
  today: string,
): TaskItemSearchFiltersPayload | null {
  const showsTodayOverdue =
    viewMode === "next3" || viewMode === "next7" || (viewMode === "day" && selectedDay === today);
  if (!showsTodayOverdue) return null;
  return {
    status: "pending",
    roots_only: true,
    container: TaskContainer.ANY,
    plan_before: dayRangeIso(today).from,
  };
}

export function calendarItemKey(item: CalendarRangeItem): string {
  if (item.kind === "task") {
    return `${item.kind}-${item.id}-${item.end_at ?? item.start_at ?? item.due_at ?? ""}-${item.virtual ? "v" : "l"}`;
  }
  return `${item.kind}-${item.id}`;
}

export function mergeCalendarItems(
  base: CalendarRangeItem[],
  extra: CalendarRangeItem[],
): CalendarRangeItem[] {
  const seen = new Set<string>();
  const out: CalendarRangeItem[] = [];
  for (const item of [...base, ...extra]) {
    const liveKey =
      item.kind === "task" && !item.virtual ? `task-live-${item.id}` : calendarItemKey(item);
    if (seen.has(liveKey)) continue;
    seen.add(liveKey);
    out.push(item);
  }
  return out;
}

/** 计划时钟日历日（COALESCE(end_at, start_at)） */
function taskPlanEndDay(item: Extract<CalendarRangeItem, { kind: "task" }>): string {
  const clock = item.end_at ?? item.start_at;
  return clock ? dayKeyFromIso(clock) : "";
}

export function isOverdueTask(item: CalendarRangeItem, todayKey: string): boolean {
  if (item.kind !== "task" || item.virtual) return false;
  if (item.status === "completed") return false;
  if (item.due_at) {
    const dueDay = dayKeyFromIso(item.due_at);
    if (dueDay !== "" && dueDay < todayKey) return true;
  }
  const planDay = taskPlanEndDay(item);
  return planDay !== "" && planDay < todayKey;
}

export function isEndedEvent(item: CalendarRangeItem, now: Date, todayKey: string): boolean {
  if (item.kind !== "event" && item.kind !== "holiday") return false;
  if (item.all_day) {
    const last = dayKeyFromIso(item.end_at ?? item.start_at);
    return last !== "" && last < todayKey;
  }
  const endMs = Date.parse(item.end_at ?? item.start_at);
  return Number.isFinite(endMs) && endMs < now.getTime();
}

export function shouldHideEndedEvents(
  viewMode: string,
  selectedDay: string,
  todayKey: string,
): boolean {
  if (viewMode === "next3" || viewMode === "next7") return true;
  if (viewMode === "day") return selectedDay === todayKey;
  return false;
}

export function filterEndedEvents(
  items: CalendarRangeItem[],
  now: Date,
  todayKey: string,
): CalendarRangeItem[] {
  return items.filter((item) => !isEndedEvent(item, now, todayKey));
}

export function itemOverlapsDay(item: CalendarRangeItem, day: string): boolean {
  if (item.kind === "event" || item.kind === "holiday") {
    const start = dayKeyFromIso(item.start_at);
    const end = dayKeyFromIso(item.end_at ?? item.start_at);
    return start !== "" && start <= day && day <= end;
  }
  if (item.kind === "task") {
    if (item.status === "completed" && item.completed_at) {
      const done = dayKeyFromIso(item.completed_at);
      if (done === day) return true;
    }
    if (item.start_at) {
      const start = dayKeyFromIso(item.start_at);
      if (start) {
        const end = (item.end_at ? dayKeyFromIso(item.end_at) : start) || start;
        if (start <= day && day <= end) return true;
      }
    }
    if (item.due_at && item.status !== "completed") {
      const due = dayKeyFromIso(item.due_at);
      if (due === day) return true;
    }
    return false;
  }
  const start = dayKeyFromIso(item.start_at ?? "");
  const end = dayKeyFromIso(item.end_at ?? item.start_at ?? "");
  if (!start) return false;
  return start <= day && day <= (end || start);
}

/** 同日同 live 任务去重（计划日与完成日重合时只留一条） */
export function dedupeAgendaItemsForDay(items: CalendarRangeItem[]): CalendarRangeItem[] {
  const seen = new Set<string>();
  const out: CalendarRangeItem[] = [];
  for (const item of items) {
    const key =
      item.kind === "task"
        ? `task-${item.id}-${item.occurrence_id ?? "live"}`
        : calendarItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function partitionAgendaDay(
  items: CalendarRangeItem[],
  day: string,
  todayKey: string,
): { overdue: CalendarRangeItem[]; dayItems: CalendarRangeItem[] } {
  const showOverdue = day === todayKey;
  const overdue = showOverdue ? items.filter((item) => isOverdueTask(item, todayKey)) : [];
  const overdueIds = new Set(overdue.filter((item) => item.kind === "task").map((item) => item.id));
  const dayItems = items.filter((item) => {
    if (item.kind === "task" && overdueIds.has(item.id) && !item.virtual) return false;
    return itemOverlapsDay(item, day);
  });
  return { overdue, dayItems: dedupeAgendaItemsForDay(dayItems) };
}
