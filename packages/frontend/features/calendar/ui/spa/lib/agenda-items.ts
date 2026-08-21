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

export type AgendaProjectGroup = {
  projectId: number;
  title: string;
  project: Extract<CalendarRangeItem, { kind: "project" }> | null;
  children: CalendarRangeItem[];
};

export type AgendaDaySections = {
  overdue: CalendarRangeItem[];
  schedule: CalendarRangeItem[];
  projectGroups: AgendaProjectGroup[];
  holidays: CalendarRangeItem[];
  completed: CalendarRangeItem[];
};

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

function agendaAnchorMs(item: CalendarRangeItem): number {
  if (item.kind === "event") {
    if (item.all_day) return 0;
    const ms = Date.parse(item.start_at);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (item.kind === "holiday") return 0;
  if (item.kind === "project") {
    const ms = item.start_at ? Date.parse(item.start_at) : NaN;
    return Number.isFinite(ms) ? ms : 0;
  }
  if (item.status === "completed" && item.completed_at) {
    const ms = Date.parse(item.completed_at);
    return Number.isFinite(ms) ? ms : 0;
  }
  const anchor = item.start_at ?? item.end_at ?? item.due_at ?? item.completed_at ?? null;
  const ms = anchor ? Date.parse(anchor) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function kindRank(item: CalendarRangeItem): number {
  if (item.kind === "event") return 0;
  if (item.kind === "task") return 1;
  if (item.kind === "holiday") return 2;
  return 3;
}

function itemSortId(item: CalendarRangeItem): string {
  return `${item.kind}:${String(item.id)}`;
}

/** 议程组内排序：时间升序 → 同刻优先级 → kind → id */
export function compareAgendaItems(a: CalendarRangeItem, b: CalendarRangeItem): number {
  const byTime = agendaAnchorMs(a) - agendaAnchorMs(b);
  if (byTime !== 0) return byTime;
  const pa = a.kind === "task" ? (PRIORITY_RANK[a.priority] ?? 3) : 3;
  const pb = b.kind === "task" ? (PRIORITY_RANK[b.priority] ?? 3) : 3;
  if (pa !== pb) return pa - pb;
  const byKind = kindRank(a) - kindRank(b);
  if (byKind !== 0) return byKind;
  return itemSortId(a).localeCompare(itemSortId(b));
}

function compareCompletedItems(a: CalendarRangeItem, b: CalendarRangeItem): number {
  const ca = a.kind === "task" && a.completed_at ? Date.parse(a.completed_at) : agendaAnchorMs(a);
  const cb = b.kind === "task" && b.completed_at ? Date.parse(b.completed_at) : agendaAnchorMs(b);
  const aMs = Number.isFinite(ca) ? ca : 0;
  const bMs = Number.isFinite(cb) ? cb : 0;
  if (aMs !== bMs) return aMs - bMs;
  return itemSortId(a).localeCompare(itemSortId(b));
}

function compareProjectChildren(a: CalendarRangeItem, b: CalendarRangeItem): number {
  const aDone = a.kind === "task" && a.status === "completed";
  const bDone = b.kind === "task" && b.status === "completed";
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (aDone && bDone) return compareCompletedItems(a, b);
  return compareAgendaItems(a, b);
}

function resolveProjectTitle(
  projectId: number,
  projectById: Map<number, Extract<CalendarRangeItem, { kind: "project" }>>,
  allItems: CalendarRangeItem[],
): string {
  const hit = projectById.get(projectId);
  if (hit) return hit.title;
  for (const item of allItems) {
    if (item.kind === "project" && item.id === projectId) return item.title;
  }
  return "项目";
}

/**
 * 日议程分段：逾期 → 安排（事件+无项目 pending）→ 项目嵌套 → 节日 → 无项目已完成。
 * 逾期任务永不进入项目折叠。
 */
export function structureAgendaDay(
  items: CalendarRangeItem[],
  day: string,
  todayKey: string,
): AgendaDaySections {
  const { overdue, dayItems } = partitionAgendaDay(items, day, todayKey);
  const overdueSorted = overdue.toSorted(compareAgendaItems);

  const schedule: CalendarRangeItem[] = [];
  const holidays: CalendarRangeItem[] = [];
  const completed: CalendarRangeItem[] = [];
  const projectById = new Map<number, Extract<CalendarRangeItem, { kind: "project" }>>();
  const nestedByProject = new Map<number, CalendarRangeItem[]>();

  const ensureNested = (projectId: number): CalendarRangeItem[] => {
    const existing = nestedByProject.get(projectId);
    if (existing) return existing;
    const next: CalendarRangeItem[] = [];
    nestedByProject.set(projectId, next);
    return next;
  };

  for (const item of dayItems) {
    if (item.kind === "holiday") {
      holidays.push(item);
      continue;
    }
    if (item.kind === "project") {
      projectById.set(item.id, item);
      if (!nestedByProject.has(item.id)) nestedByProject.set(item.id, []);
      continue;
    }
    if (item.kind === "event") {
      schedule.push(item);
      continue;
    }
    // task
    if (item.status === "completed") {
      if (item.project_id != null) {
        ensureNested(item.project_id).push(item);
      } else {
        completed.push(item);
      }
      continue;
    }
    // pending
    if (item.project_id != null) {
      ensureNested(item.project_id).push(item);
    } else {
      schedule.push(item);
    }
  }

  const projectGroups: AgendaProjectGroup[] = [...nestedByProject.entries()]
    .map(([projectId, children]) => {
      const project = projectById.get(projectId) ?? null;
      return {
        projectId,
        title: resolveProjectTitle(projectId, projectById, items),
        project,
        children: children.toSorted(compareProjectChildren),
      };
    })
    .toSorted((a, b) => {
      const aMs = a.project?.start_at ? Date.parse(a.project.start_at) : NaN;
      const bMs = b.project?.start_at ? Date.parse(b.project.start_at) : NaN;
      const aKey = Number.isFinite(aMs) ? aMs : Number.POSITIVE_INFINITY;
      const bKey = Number.isFinite(bMs) ? bMs : Number.POSITIVE_INFINITY;
      if (aKey !== bKey) return aKey - bKey;
      return a.title.localeCompare(b.title) || a.projectId - b.projectId;
    });

  return {
    overdue: overdueSorted,
    schedule: schedule.toSorted(compareAgendaItems),
    projectGroups,
    holidays: holidays.toSorted(
      (a, b) => a.title.localeCompare(b.title) || itemSortId(a).localeCompare(itemSortId(b)),
    ),
    completed: completed.toSorted(compareCompletedItems),
  };
}

export function agendaDayHasItems(sections: AgendaDaySections): boolean {
  return (
    sections.overdue.length > 0 ||
    sections.schedule.length > 0 ||
    sections.projectGroups.length > 0 ||
    sections.holidays.length > 0 ||
    sections.completed.length > 0
  );
}
